
import { LevelGenerator } from '../game/environment/LevelGenerator.js';
import { Physics } from '../shared/Physics.js';

export class GameRoom {
    constructor(id, io, name = "Unknown Sector") {
        this.id = id;
        this.io = io; // Socket.io Server instance
        this.name = name;
        this.clients = new Map(); // socket.id -> player object
        this.seed = Math.floor(Math.random() * 2147483647);
        this.enemies = [];
        this.running = false;

        console.log(`[Room ${this.id}] Created. Seed: ${this.seed}`);

        // Generate Level
        this.levelGen = new LevelGenerator();
        this.rooms = this.levelGen.generate(15, this.seed);

        // Spawn Enemies
        this.spawnEnemies();

        // Physics Loop
        this.running = true;
        this.interval = setInterval(() => this.update(), 1000 / 60);

        // Track event handlers to remove them later
        this.socketHandlers = new Map(); // socket.id -> { event: handler }
    }

    spawnEnemies() {
        const mockGame = {
            enemies: [],
            asteroids: [],
            lootCrates: [],
            bosses: []
        };

        this.rooms.forEach(room => {
            try {
                room.spawnEnemies(mockGame);
            } catch (e) {
                console.warn(`[Room ${this.id}] Failed to spawn in room ${room.gridX},${room.gridY}: ${e.message}`);
            }
        });

        // Collect all
        this.rooms.forEach(room => {
            if (room.enemies) room.enemies.forEach(e => this.enemies.push(e));
        });
        mockGame.bosses.forEach(b => this.enemies.push(b));

        console.log(`[Room ${this.id}] Spawning ${this.enemies.length} enemies.`);
    }

    addPlayer(socket) {
        console.log(`[Room ${this.id}] Player joined: ${socket.id}`);

        // Initialize Player Data
        const player = {
            id: socket.id,
            socket: socket,
            x: 0, y: 0,
            vx: 0, vy: 0,
            rotation: 0,
            parts: [],
            input: {},
            hp: 100,
            maxHp: 100
        };
        this.clients.set(socket.id, player);

        // Join Socket Room
        socket.join(this.id);

        // Send Init Packet
        const deadEnemyIds = this.enemies.filter(e => e.isDead).map(e => e.id);
        socket.emit('init', {
            id: socket.id,
            seed: this.seed,
            deadEnemies: deadEnemyIds,
            roomId: this.id
        });

        // Setup Handlers
        this.setupSocketHandlers(socket);
    }

    removePlayer(socket) {
        const socketId = socket.id;
        console.log(`[Room ${this.id}] Player left: ${socketId}`);

        if (this.clients.has(socketId)) {
            this.clients.delete(socketId);
            socket.leave(this.id);
            this.io.to(this.id).emit('player_leave', { id: socketId });
        }

        // Cleanup Listeners
        if (this.socketHandlers.has(socketId)) {
            const handlers = this.socketHandlers.get(socketId);
            for (const [event, handler] of Object.entries(handlers)) {
                socket.off(event, handler);
            }
            this.socketHandlers.delete(socketId);
        }
    }

    setupSocketHandlers(socket) {
        const handlers = {};

        handlers['join_game'] = (data) => {
            const player = this.clients.get(socket.id);
            if (player) {
                player.parts = data.parts || [];

                // Broadcast to ROOM
                socket.to(this.id).emit('player_join', {
                    id: socket.id,
                    parts: player.parts
                });

                // Send existing players in ROOM to new player
                const existingPlayers = Array.from(this.clients.values())
                    .filter(p => p.id !== socket.id && p.parts)
                    .map(p => ({
                        id: p.id,
                        x: p.x,
                        y: p.y,
                        rotation: p.rotation,
                        parts: p.parts
                    }));

                socket.emit('players_list', existingPlayers);
            }
        };

        handlers['player_input'] = (inputState) => {
             const player = this.clients.get(socket.id);
             if (player) {
                 player.x = inputState.x;
                 player.y = inputState.y;
                 player.rotation = inputState.rotation;
                 player.input = inputState;

                 socket.to(this.id).emit('player_update', {
                     id: socket.id,
                     x: player.x,
                     y: player.y,
                     rotation: player.rotation,
                     input: inputState
                 });
             }
        };

        handlers['player_shoot'] = (data) => {
            this.io.to(this.id).emit('player_shoot', {
                id: socket.id,
                ...data
            });
        };

        handlers['enemy_hit'] = (data) => {
            socket.to(this.id).emit('enemy_hit', data);

             const enemy = this.enemies.find(e => e.id === data.id);
             if (enemy) {
                 enemy.takeDamage(data.damage);
                 if (data.killed && !enemy.isDead) {
                     enemy.hp = 0;
                     enemy.isDead = true;
                 }
             }
        };

        handlers['update_state'] = (data) => {
            const player = this.clients.get(socket.id);
            if (player) {
                player.x = data.x;
                player.y = data.y;
                player.rotation = data.rotation;
                socket.to(this.id).emit('player_update', {
                    id: socket.id,
                     x: data.x,
                     y: data.y,
                     rotation: data.rotation
                });
            }
        };

        // Bind and store
        for (const [event, handler] of Object.entries(handlers)) {
            socket.on(event, handler);
        }
        this.socketHandlers.set(socket.id, handlers);
    }

    update() {
        if (!this.running) return;
        const DT = 1 / 60;

        // Physics Loop
        this.clients.forEach(player => {
            if (!player.input) return;
            Physics.update(player, player.input, DT);
        });

        // Snapshot (Lightweight)
        const snapshot = [];
        this.clients.forEach(p => {
            snapshot.push({
                id: p.id,
                x: Math.round(p.x),
                y: Math.round(p.y),
                rotation: parseFloat(p.rotation.toFixed(2)),
                input: p.input,
                hp: p.hp,
                maxHp: p.maxHp
            });
        });

        if (snapshot.length > 0) {
            this.io.to(this.id).emit('world_update', snapshot);
        }

        // Enemy Logic
        const allPlayers = Array.from(this.clients.values());
        const enemyUpdates = [];
        const generatedProjectiles = [];

        this.enemies.forEach(enemy => {
            if (enemy.isDead) return;

            let nearestPlayer = null;
            let minDistSq = Infinity;

            if (allPlayers.length > 0) {
                for (const p of allPlayers) {
                    const dx = p.x - enemy.x;
                    const dy = p.y - enemy.y;
                    const dSq = dx * dx + dy * dy;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        nearestPlayer = p;
                    }
                }
            }

            try {
                if (nearestPlayer) {
                    enemy.update(DT, nearestPlayer.x, nearestPlayer.y, generatedProjectiles, [], [], this.enemies);
                } else {
                    enemy.update(DT, undefined, undefined, generatedProjectiles, [], [], this.enemies);
                }
            } catch (e) {
                 // console.error(`[Room ${this.id}] Enemy Update Error: ${e.message}`);
            }

            enemyUpdates.push({
                id: enemy.id,
                x: Math.round(enemy.x),
                y: Math.round(enemy.y),
                r: parseFloat(enemy.rotation.toFixed(2)),
                hp: enemy.hp
            });
        });

        if (enemyUpdates.length > 0) {
            this.io.to(this.id).emit('enemy_update', enemyUpdates);
        }

        if (generatedProjectiles.length > 0) {
            generatedProjectiles.forEach(p => {
                 const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                 this.io.to(this.id).emit('enemy_shoot', {
                    x: Math.round(p.x),
                    y: Math.round(p.y),
                    angle: parseFloat(p.angle.toFixed(4)),
                    type: p.type,
                    speed: Math.round(speed),
                    damage: p.damage
                 });
            });
        }
    }

    destroy() {
        this.running = false;
        clearInterval(this.interval);

        // Kick all players?
        // this.clients.forEach(p => p.socket.disconnect());

        console.log(`[Room ${this.id}] Destroyed.`);
    }

    getPlayerCount() {
        return this.clients.size;
    }
}
