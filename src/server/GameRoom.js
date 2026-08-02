
import { LevelGenerator } from '../game/environment/LevelGenerator.js';
import { Ship } from '../shared/entities/Ship.js';
import { Projectile } from '../shared/entities/Projectile.js';
import { Collision } from '../shared/CollisionSystem.js';
import { PartsLibrary, PartType } from '../shared/parts/Part.js';
import {
    FixedWindowRateLimiter,
    sanitizePlayerInput,
    sanitizePlayerShot,
    sanitizeShipManifest
} from '../shared/ProtocolValidation.js';

export class GameRoom {
    constructor(id, io, name = "Unknown Sector") {
        this.id = id;
        this.io = io;
        this.name = name;
        this.clients = new Map(); // socket.id -> { socket, ship, input }
        this.seed = Math.floor(Math.random() * 2147483647);

        this.enemies = [];
        this.projectiles = [];
        this.asteroids = [];
        this.lootCrates = [];
        this.bosses = [];
        this.shipwrecks = []; // Need to populate if generated
        this.xpOrbs = [];
        this.goldOrbs = [];
        this.hpOrbs = [];
        this.floor = 1;
        this.maxPlayers = 8;
        this.maxDeltaTime = 0.05;

        this.running = false;

        console.log(`[Room ${this.id}] Created. Seed: ${this.seed}`);

        // Generate Level
        this.levelGen = new LevelGenerator();
        this.rooms = this.levelGen.generate(15, this.seed);

        // Physics Loop
        this.running = true;
        this.interval = setInterval(() => this.update(), 1000 / 60);
        this.lastTime = Date.now();

        this.socketHandlers = new Map();
    }

    addPlayer(socket) {
        if (!this.clients.has(socket.id) && this.clients.size >= this.maxPlayers) {
            return false;
        }

        console.log(`[Room ${this.id}] Player joined: ${socket.id}`);

        // Create Ship Entity
        const ship = new Ship();
        ship.x = 1000; // Spawn point
        ship.y = 1000;

        const client = {
            id: socket.id,
            socket: socket,
            ship: ship,
            input: {},
            rateLimiter: new FixedWindowRateLimiter()
        };
        this.clients.set(socket.id, client);

        socket.join(this.id);

        // Send Init
        const deadEnemyIds = this.enemies.filter(e => e.isDead).map(e => e.id);
        socket.emit('init', {
            id: socket.id,
            seed: this.seed,
            deadEnemies: deadEnemyIds,
            roomId: this.id,
            x: ship.x,
            y: ship.y
        });

        this.setupSocketHandlers(socket);
        return true;
    }

    removePlayer(socket) {
        if (this.clients.has(socket.id)) {
            const client = this.clients.get(socket.id);
            if (client.rateLimiter) client.rateLimiter.clear();
            this.teardownSocketHandlers(socket);
            this.clients.delete(socket.id);
            socket.leave(this.id);
            this.io.to(this.id).emit('player_leave', { id: socket.id });
            return true;
        }
        return false;
    }

    setupSocketHandlers(socket) {
        if (!this.socketHandlers) this.socketHandlers = new Map();
        this.teardownSocketHandlers(socket);

        const handlers = new Map();
        const register = (event, handler) => {
            const safeHandler = (payload) => {
                try {
                    handler(payload);
                } catch (error) {
                    console.warn(`[Room ${this.id}] Rejected ${event} from ${socket.id}:`, error);
                }
            };
            handlers.set(event, safeHandler);
            socket.on(event, safeHandler);
        };

        const getClientLimiter = (client) => {
            if (!client.rateLimiter) client.rateLimiter = new FixedWindowRateLimiter();
            return client.rateLimiter;
        };

        register('player_input', (inputState) => {
            const client = this.clients.get(socket.id);
            if (!client) return;
            if (!getClientLimiter(client).allow('player_input', 240, 1000)) return;

            const input = sanitizePlayerInput(inputState);
            if (input) client.input = input;
        });

        register('player_shoot', (data) => {
            const client = this.clients.get(socket.id);
            if (!client) return;
            if (!getClientLimiter(client).allow('player_shoot', 300, 1000)) return;

            const shot = sanitizePlayerShot(data);
            if (!shot) return;

            const def = PartsLibrary[shot.partId];
            if (def && def.type === PartType.WEAPON) {
                // Spawn Projectile
                // Logic mirrored from Game.js spawnProjectile
                const speed = def.stats.projectileSpeed || 600; // Simplified
                // Note: Missing rocket speed mult logic from ship stats here

                const p = new Projectile(shot.x, shot.y, shot.angle, def.stats.projectileType || 'bullet', speed, 'player', def.stats.damage || 10, def.stats.lifetime);

                if (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'beam_freeze') p.isBeam = true;

                // Add to list
                this.projectiles.push(p);

                // The shooter already spawned locally with its live weapon state.
                socket.to(this.id).emit('player_shoot', { id: socket.id, ...shot });
            }
        });

        register('join_game', (data) => {
            const client = this.clients.get(socket.id);
            if (!client || !client.ship) return;
            if (!getClientLimiter(client).allow('join_game', 10, 10_000)) return;

            const parts = sanitizeShipManifest(data, PartsLibrary);
            if (!parts) return;

            const previousParts = client.ship.parts;
            client.ship.parts = new Map();

            const accepted = parts.every(part => (
                client.ship.addPart(part.x, part.y, part.partId, part.rotation)
            ));

            if (!accepted) {
                client.ship.parts = previousParts;
                client.ship.recalculateStats();
                return;
            }

            client.ship.recalculateStats();

            // Broadcast appearance
            socket.to(this.id).emit('player_join', {
                id: socket.id,
                parts
            });

            // Send existing players
            const others = [];
            for (const [oid, oc] of this.clients) {
                if (oid === socket.id) continue;
                const oparts = [];
                for (const p of oc.ship.getUniqueParts()) {
                    oparts.push({ x: p.x, y: p.y, partId: p.partId, rotation: p.rotation });
                }
                others.push({
                    id: oid,
                    x: oc.ship.x,
                    y: oc.ship.y,
                    rotation: oc.ship.rotation,
                    parts: oparts
                });
            }
            socket.emit('players_list', others);
        });

        this.socketHandlers.set(socket.id, handlers);
    }

    teardownSocketHandlers(socket) {
        if (!this.socketHandlers) return;
        const handlers = this.socketHandlers.get(socket.id);
        if (!handlers) return;

        for (const [event, handler] of handlers) {
            if (socket.off) socket.off(event, handler);
        }
        this.socketHandlers.delete(socket.id);
    }

    update() {
        if (!this.running) return;
        const now = Date.now();
        const elapsed = (now - this.lastTime) / 1000;
        const dt = Math.min(Math.max(elapsed, 0), this.maxDeltaTime || 0.05);
        this.lastTime = now;

        // 1. Update Players
        const playerSnapshots = [];
        for (const client of this.clients.values()) {
            // Apply Input
            client.ship.update(dt, client.input);

            // Lazy Room Activation
            const currentRoom = this.levelGen.getRoomAtWorldPos(client.ship.x, client.ship.y);
            if (currentRoom && !currentRoom.visited) {
                currentRoom.onEnter(this);
            }

            // Wall Collision & Room Constraints
            const room = currentRoom;
            if (room) {
                // Determine if room is locked (enemies alive in this room)
                // Optimization: Room could cache "cleared" status on server
                // For now, check alive enemies in room bounds
                // Note: this.enemies contains ALL enemies.
                let isLocked = false;
                if (room.gridX !== 0 || room.gridY !== 0) { // Start room never locked
                    // Simple check: Is there any enemy in this room?
                    // Ideally we track room.enemies list on server, but we flattened it to this.enemies.
                    // We can check room bounds.
                    const hasEnemies = this.enemies.some(e => !e.isDead && room.contains(e.x, e.y));
                    const hasBosses = this.bosses.some(b => !b.isDead && room.contains(b.x, b.y));
                    if (hasEnemies || hasBosses) isLocked = true;
                }

                const margin = 30; // buffer from wall

                if (isLocked) {
                    // Strict Lockdown (Cannot exit room)
                    if (client.ship.x < room.x + margin) { client.ship.x = room.x + margin; client.ship.vx = 0; }
                    else if (client.ship.x > room.x + room.width - margin) { client.ship.x = room.x + room.width - margin; client.ship.vx = 0; }

                    if (client.ship.y < room.y + margin) { client.ship.y = room.y + margin; client.ship.vy = 0; }
                    else if (client.ship.y > room.y + room.height - margin) { client.ship.y = room.y + room.height - margin; client.ship.vy = 0; }
                } else {
                    // World Bounds Check (Cannot flow into void)
                    // Check Left
                    if (client.ship.x < room.x + margin) {
                        const neighbor = this.levelGen.getRoomAtWorldPos(room.x - 10, client.ship.y);
                        if (!neighbor) { client.ship.x = room.x + margin; client.ship.vx = 0; }
                    }
                    // Check Right
                    else if (client.ship.x > room.x + room.width - margin) {
                        const neighbor = this.levelGen.getRoomAtWorldPos(room.x + room.width + 10, client.ship.y);
                        if (!neighbor) { client.ship.x = room.x + room.width - margin; client.ship.vx = 0; }
                    }

                    // Check Top
                    if (client.ship.y < room.y + margin) {
                        const neighbor = this.levelGen.getRoomAtWorldPos(client.ship.x, room.y - 10);
                        if (!neighbor) { client.ship.y = room.y + margin; client.ship.vy = 0; }
                    }
                    // Check Bottom
                    else if (client.ship.y > room.y + room.height - margin) {
                        const neighbor = this.levelGen.getRoomAtWorldPos(client.ship.x, room.y + room.height + 10);
                        if (!neighbor) { client.ship.y = room.y + room.height - margin; client.ship.vy = 0; }
                    }
                }
            }

            playerSnapshots.push({
                id: client.id,
                x: Math.round(client.ship.x),
                y: Math.round(client.ship.y),
                rotation: parseFloat(client.ship.rotation.toFixed(2)),
                hp: client.ship.hp,
                maxHp: client.ship.maxHp,
                input: client.input // Echo input for prediction correction?
            });
        }

        // 2. Update Projectiles & Collisions
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];

            // Mock 'game' object for update(dt, game) if needed by homing missiles
            // We need a way to pass enemies list
            const gameContext = { enemies: this.enemies, bosses: this.bosses };
            p.update(dt, gameContext);

            if (p.owner === 'player') {
                // Vs Enemies
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    // Simple collision check (Radius based for server perf)
                    const distSq = (p.x - enemy.x)**2 + (p.y - enemy.y)**2;
                    const hitDist = (p.radius || 4) + (enemy.radius || 20);
                    if (distSq < hitDist * hitDist) {
                        enemy.takeDamage(p.damage, p.type);
                        if (!p.isBeam) p.isDead = true;

                        // Notify clients of hit?
                        // They usually predict it.
                        // But for health sync, we send enemy updates.
                    }
                }
                // Vs Bosses
                for (const boss of this.bosses) {
                    if (boss.isDead) continue;
                    const distSq = (p.x - boss.x)**2 + (p.y - boss.y)**2;
                    const hitDist = (p.radius || 4) + (boss.radius || 60);
                    if (distSq < hitDist * hitDist) {
                        boss.takeDamage(p.damage, p.type);
                        if (!p.isBeam) p.isDead = true;
                    }
                }
            } else {
                // Enemy Projectile vs Players
                for (const client of this.clients.values()) {
                    if (client.ship.isDead) continue;
                    // Precise check using Ship.checkCollision
                    const col = client.ship.checkCollision(client.ship.x, client.ship.y, client.ship.rotation, p.x, p.y, p.radius || 4, p.isBeam, { angle: p.angle, length: p.beamLength });
                    if (col.hit) {
                        if (!col.blocked) {
                            client.ship.takeDamage(p.damage);
                        }
                        if (!p.isBeam) p.isDead = true;
                    }
                }
            }

            if (p.isDead || p.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }

        // 3. Update Enemies
        const enemyUpdates = [];
        const enemyShoots = [];

        for (const enemy of this.enemies) {
            if (enemy.isDead) continue;

            // Find nearest player
            let nearest = null;
            let minDist = Infinity;
            for (const client of this.clients.values()) {
                if (client.ship.isDead) continue;
                const d = (client.ship.x - enemy.x)**2 + (client.ship.y - enemy.y)**2;
                if (d < minDist) {
                    minDist = d;
                    nearest = client.ship;
                }
            }

            if (nearest) {
                // Pass a mock 'projectiles' array to capture shots
                const generatedShots = [];
                enemy.update(dt, nearest.x, nearest.y, generatedShots, this.asteroids, this.lootCrates, this.enemies);

                // Handle generated shots
                for (const shot of generatedShots) {
                    // shot is Projectile instance
                    this.projectiles.push(shot);
                    enemyShoots.push({
                        x: Math.round(shot.x),
                        y: Math.round(shot.y),
                        angle: parseFloat(shot.angle.toFixed(4)),
                        type: shot.type,
                        speed: Math.round(Math.hypot(shot.vx, shot.vy)),
                        damage: shot.damage
                    });
                }
            } else {
                // Idle update
                enemy.update(dt, undefined, undefined, [], this.asteroids, this.lootCrates, this.enemies);
            }

            enemyUpdates.push({
                id: enemy.id,
                x: Math.round(enemy.x),
                y: Math.round(enemy.y),
                r: parseFloat(enemy.rotation.toFixed(2)),
                hp: enemy.hp,
                w: enemy.isWarpingIn
            });
        }

        // 4. Broadcast
        if (playerSnapshots.length > 0) {
            this.io.to(this.id).emit('world_update', playerSnapshots);
        }
        if (enemyUpdates.length > 0) {
            this.io.to(this.id).emit('enemy_update', enemyUpdates);
        }
        if (enemyShoots.length > 0) {
            this.io.to(this.id).emit('enemy_shoots', enemyShoots);
        }
    }

    destroy() {
        this.running = false;
        clearInterval(this.interval);
    }

    getPlayerCount() {
        return this.clients.size;
    }
}
