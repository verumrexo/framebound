
import { io } from "socket.io-client";
import { RemotePlayer } from "./RemotePlayer.js";
import { PartsLibrary } from "../game/parts/Part.js";

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
        this.otherPlayers = new Map(); // id -> {x, y, rotation}

        this.connect();
    }

    connect() {
        // Connect to the server. If dev, it might be localhost:3000
        // In prod, it should be the same host.
        // We can use a proxy in vite.config.js to map /socket.io to localhost:3000
        // Connect via Vite proxy (forwards /socket.io from 5173 to 3000)
        // This avoids CORS/CSP issues by making it look like a same-origin request
        this.socket = io({
            transports: ['websocket'],
            upgrade: false
        });

        this.socket.on("connect", () => {
            console.log("Connected to server");
            this.isConnected = true;
            // join_game is now sent after init -> createLocalPlayer
        });

        this.socket.on("disconnect", () => {
            console.log("Disconnected from server");
            this.isConnected = false;
        });

        this.socket.on("init", (data) => {
            console.log("My ID:", data.id);
            console.log("Game Seed:", data.seed);
            this.playerId = data.id;

            // Create local player NOW (server authoritative creation)
            this.game.createLocalPlayer(data);

            if (data.seed) {
                this.game.startGame(data.seed);
            }
            if (data.deadEnemies && data.deadEnemies.length > 0) {
                console.log(`[Network] Removing ${data.deadEnemies.length} dead enemies`);
                data.deadEnemies.forEach(id => {
                    const e = this.game.enemies.find(en => en.id === id);
                    if (e) {
                        e.isDead = true;
                        e.hp = 0;
                    }
                });
            }
        });

        this.socket.on("player_join", (data) => {
            console.log("Player joined:", data.id);
            if (data.id === this.playerId) return;

            // Create a visual representation for the other player
            const rp = new RemotePlayer(data.id);
            if (data.parts) rp.setShipData(data.parts);
            rp.x = 0; // Will be updated by next packet or interpolate
            rp.y = 0;
            this.otherPlayers.set(data.id, rp);
        });

        this.socket.on("player_leave", (data) => {
            console.log("Player left:", data.id);
            this.otherPlayers.delete(data.id);
        });

        this.socket.on("world_update", (snapshot) => {
            for (const data of snapshot) {
                // Skip local player for now (client prediction) 
                // OR snap if deviation is too large (reconciliation)
                if (data.id === this.playerId) {
                    // Basic Reconciliation: Snap if too far
                    const dx = this.game.x - data.x;
                    const dy = this.game.y - data.y;
                    if (Math.sqrt(dx * dx + dy * dy) > 100) {
                        this.game.x = data.x;
                        this.game.y = data.y;
                    }
                    continue;
                }

                if (this.otherPlayers.has(data.id)) {
                    const p = this.otherPlayers.get(data.id);
                    if (p.addSnapshot) {
                         p.addSnapshot(data);
                    } else {
                        // Fallback: Direct Snap
                        p.x = data.x;
                        p.y = data.y;
                        p.rotation = data.rotation;
                        if (data.input) p.input = data.input;
                        if (data.hp !== undefined) p.hp = data.hp;
                        if (data.maxHp !== undefined) p.maxHp = data.maxHp;
                    }
                } else {
                    // New player found in snapshot
                    const rp = new RemotePlayer(data.id);
                    // Initialize with snapshot data
                    rp.x = data.x;
                    rp.y = data.y;
                    rp.rotation = data.rotation;
                    if (data.input) rp.input = data.input;
                    if (data.hp !== undefined) rp.hp = data.hp;
                    if (data.maxHp !== undefined) rp.maxHp = data.maxHp;

                    if (rp.addSnapshot) {
                        rp.addSnapshot(data);
                    }
                    this.otherPlayers.set(data.id, rp);
                }
            }
        });

        this.socket.on("player_shoot", (data) => {
            // Server Authoritative Shooting: We process ALL shoot events, including our own.

            // Spawn Projectile
            const def = PartsLibrary[data.partId];
            if (def) {
                // If it's own player, we might want to attach partRef for recoil?
                // But partRef is local state.
                // Currently spawnProjectile accepts partRef for recoil & visual effects.
                // If we pass null, we lose recoil on local ship?
                // Yes, recoil logic in spawnProjectile depends on partRef.

                let partRef = null;
                if (data.id === this.playerId && this.game.playerShip) {
                    // Try to find the local part that shot?
                    // We don't know EXACTLY which part shot (if multiple identical parts).
                    // But we can approximate or ignore recoil for now.
                    // Or we could pass partIndex in the packet?
                    // For now, let's accept losing visual recoil or fix it later.
                }

                this.game.spawnProjectile(def, data.x, data.y, data.angle, partRef);
            }
        });

        this.socket.on("enemy_hit", (data) => {
            // Find enemy by ID
            const enemy = this.game.enemies.find(e => e.id === data.id);
            if (enemy) {
                // Apply damage locally
                enemy.takeDamage(data.damage);
                if (data.killed && !enemy.isDead) { // Force kill if server says so (or other client)
                    enemy.hp = 0;
                    enemy.isDead = true;
                }

                // Show damage number
                this.game.spawnDamageNumber(enemy.x, enemy.y, data.damage);

                // Play hit sound if close enough to be relevant
                const dx = this.game.x - enemy.x;
                const dy = this.game.y - enemy.y;
                if (dx * dx + dy * dy < 2000 * 2000) {
                    this.game.audio.play('hit', { volume: 0.4, pitch: 0.8 + Math.random() * 0.4 });
                }
            }
        });

        this.socket.on("players_list", (list) => {
            for (const p of list) {
                const rp = new RemotePlayer(p.id);
                rp.x = p.x;
                rp.y = p.y;
                rp.rotation = p.rotation;
                if (p.parts) rp.setShipData(p.parts);
                this.otherPlayers.set(p.id, rp);
            }
        });

        this.socket.on("enemy_update", (updates) => {
            if (!this.game || !this.game.enemies) return;

            // Map for O(1) lookup
            const enemyMap = new Map(this.game.enemies.map(e => [e.id, e]));

            for (const update of updates) {
                const enemy = enemyMap.get(update.id);
                if (enemy) {
                    if (enemy.addSnapshot) {
                         enemy.addSnapshot(update);
                    } else {
                        // Fallback: Snap position (naive interpolation later)
                        enemy.x = update.x;
                        enemy.y = update.y;
                        enemy.rotation = update.r;
                        enemy.hp = update.hp;
                    }

                    // Server is authoritative, so we don't need to predict movement
                    // But we might want some smoothing if updates are slow
                    // For now: Snap.
                } else {
                    // Enemy doesn't exist? Might be out of sync or just spawned?
                    // Level generation *should* be deterministic, so it should exist.
                    // Unless it's a dynamic spawn (not implemented yet).
                }
            }
        });
    }

    sendUpdate(x, y, rotation) {
        if (!this.isConnected) return;
        this.socket.emit("update_state", { x, y, rotation });
    }

    sendInput(inputs) {
        if (!this.isConnected) return;
        this.socket.emit("player_input", inputs);
    }

    sendShoot(data) {
        if (!this.isConnected) return;
        this.socket.emit("player_shoot", data);
    }

    sendEnemyHit(id, damage, killed) {
        if (!this.isConnected) return;
        this.socket.emit("enemy_hit", { id, damage, killed });
    }

    sendJoinGame() {
        if (!this.isConnected || !this.game.playerShip) return;

        // Serialize Ship Data
        const parts = [];
        for (const p of this.game.playerShip.getUniqueParts()) {
            parts.push({
                x: p.x,
                y: p.y,
                partId: p.partId,
                rotation: p.rotation
            });
        }
        this.socket.emit('join_game', { parts: parts });
    }
}
