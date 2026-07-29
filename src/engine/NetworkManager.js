
import { io } from "socket.io-client";
import { RemotePlayer } from "./RemotePlayer.js";
import { PartsLibrary } from "../shared/parts/Part.js";
import {
    normalizeAngle,
    PROTOCOL_LIMITS,
    sanitizePlayerShot,
    sanitizeShipManifest
} from "../shared/ProtocolValidation.js";
import { APP_CONFIG } from "./AppConfig.js";

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasFinitePosition(value) {
    const max = PROTOCOL_LIMITS.maxWorldCoordinate;
    return isRecord(value) &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y) &&
        Math.abs(value.x) <= max &&
        Math.abs(value.y) <= max;
}

function sanitizeRemoteInput(input) {
    if (!isRecord(input)) return undefined;
    const result = {};
    for (const key of ['up', 'down', 'left', 'right', 'shift']) {
        if (typeof input[key] === 'boolean') result[key] = input[key];
    }
    for (const key of ['analogX', 'analogY']) {
        if (
            Number.isFinite(input[key]) &&
            input[key] >= -1 &&
            input[key] <= 1
        ) {
            result[key] = input[key];
        }
    }
    return result;
}

function sanitizeWorldSnapshot(data) {
    if (
        !hasFinitePosition(data) ||
        typeof data.id !== 'string' ||
        normalizeAngle(data.rotation) === null
    ) {
        return null;
    }

    const snapshot = {
        id: data.id,
        x: data.x,
        y: data.y,
        rotation: normalizeAngle(data.rotation)
    };
    const input = sanitizeRemoteInput(data.input);
    if (input) snapshot.input = input;
    if (Number.isFinite(data.hp)) snapshot.hp = data.hp;
    if (Number.isFinite(data.maxHp)) snapshot.maxHp = data.maxHp;
    return snapshot;
}

function sanitizeLobbyList(list) {
    if (!Array.isArray(list)) return null;
    return list.flatMap(lobby => {
        if (
            !isRecord(lobby) ||
            typeof lobby.id !== 'string' ||
            typeof lobby.name !== 'string' ||
            !Number.isInteger(lobby.players) ||
            !Number.isInteger(lobby.maxPlayers)
        ) {
            return [];
        }
        return [{
            id: lobby.id,
            name: lobby.name,
            players: lobby.players,
            maxPlayers: lobby.maxPlayers
        }];
    });
}

export class NetworkManager {
    constructor(game, { socketFactory = io } = {}) {
        this.game = game;
        this.socketFactory = socketFactory;
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
        this.otherPlayers = new Map(); // id -> {x, y, rotation}

        // Callbacks for UI
        this.onLobbyListUpdate = null;
        this.onLobbyJoined = null;
        this.onLobbyError = null;

        this.customServerUrl = null;

        // Do NOT connect automatically
        // this.connect();
    }

    setServerUrl(url) {
        this.customServerUrl = url;
        this.disconnect();
        // Force new connection creation
        this.socket = null;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.isConnected = false;
        this.playerId = null;
        this.otherPlayers.clear();
    }

    connect() {
        if (this.socket) {
            if (!this.socket.connected) {
                this.socket.connect();
            }
            return;
        }

        const serverUrl = (
            this.customServerUrl ||
            APP_CONFIG.serverUrl ||
            undefined
        );

        // In production (e.g. GitHub Pages), if no server URL is set, do not attempt to connect.
        // This prevents the client from trying to connect to the static host as a WebSocket server.
        if (import.meta.env?.PROD && !serverUrl) {
            console.warn("[Network] Offline Mode: No server URL configured (static host detected).");
            return;
        }

        this.socket = this.socketFactory(serverUrl, {
            transports: ['websocket'],
            upgrade: false
        });

        this.socket.on("connect", () => {
            console.log("Connected to server");
            this.isConnected = true;
        });

        this.socket.on("disconnect", () => {
            console.log("Disconnected from server");
            this.isConnected = false;
            this.otherPlayers.clear();
        });

        // --- LOBBY EVENTS ---
        this.socket.on("lobby_list", (list) => {
            const sanitized = sanitizeLobbyList(list);
            if (sanitized && this.onLobbyListUpdate) {
                this.onLobbyListUpdate(sanitized);
            }
        });

        this.socket.on("lobby_created", (data) => {
            if (!isRecord(data) || typeof data.roomId !== 'string') return;
            console.log(`[Network] Lobby Created: ${data.roomId}`);
            if (this.onLobbyJoined) this.onLobbyJoined(data);
        });

        this.socket.on("lobby_joined", (data) => {
            if (!isRecord(data) || typeof data.roomId !== 'string') return;
            console.log(`[Network] Joined Lobby: ${data.roomId}`);
            if (this.onLobbyJoined) this.onLobbyJoined(data);
        });

        this.socket.on("lobby_error", (msg) => {
            if (typeof msg !== 'string') return;
            console.error(`[Network] Lobby Error: ${msg}`);
            if (this.onLobbyError) this.onLobbyError(msg);
        });

        // --- GAME EVENTS ---
        this.socket.on("init", (data) => {
            if (
                !isRecord(data) ||
                typeof data.id !== 'string' ||
                (data.x !== undefined && !Number.isFinite(data.x)) ||
                (data.y !== undefined && !Number.isFinite(data.y)) ||
                Math.abs(data.x ?? 0) > PROTOCOL_LIMITS.maxWorldCoordinate ||
                Math.abs(data.y ?? 0) > PROTOCOL_LIMITS.maxWorldCoordinate
            ) {
                return;
            }
            console.log("My ID:", data.id);
            console.log("Game Seed:", data.seed);
            this.playerId = data.id;

            // The legacy socket server provides the online player's initial identity and seed.
            this.game.createLocalPlayer(data);

            if (Number.isInteger(data.seed)) {
                this.game.startGame(data.seed);
            }
            const deadEnemies = Array.isArray(data.deadEnemies)
                ? data.deadEnemies.filter(id => typeof id === 'string')
                : [];
            if (deadEnemies.length > 0) {
                console.log(`[Network] Removing ${deadEnemies.length} dead enemies`);
                deadEnemies.forEach(id => {
                    const e = this.game.enemies.find(en => en.id === id);
                    if (e) {
                        e.isDead = true;
                        e.hp = 0;
                    }
                });
            }
        });

        this.socket.on("player_join", (data) => {
            if (!isRecord(data) || typeof data.id !== 'string') return;
            console.log("Player joined:", data.id);
            if (data.id === this.playerId) return;

            // Create a visual representation for the other player
            const rp = new RemotePlayer(data.id);
            const parts = sanitizeShipManifest(
                { parts: data.parts },
                PartsLibrary
            );
            if (parts) rp.setShipData(parts);
            rp.x = 0; // Will be updated by next packet or interpolate
            rp.y = 0;
            this.otherPlayers.set(data.id, rp);
        });

        this.socket.on("player_leave", (data) => {
            if (!isRecord(data) || typeof data.id !== 'string') return;
            console.log("Player left:", data.id);
            this.otherPlayers.delete(data.id);
        });

        this.socket.on("world_update", (snapshot) => {
            if (!Array.isArray(snapshot)) return;
            for (const data of snapshot) {
                const cleanSnapshot = sanitizeWorldSnapshot(data);
                if (!cleanSnapshot) continue;
                // Skip local player for now (client prediction) 
                // OR snap if deviation is too large (reconciliation)
                if (cleanSnapshot.id === this.playerId) {
                    // Basic Reconciliation: Snap if too far
                    const dx = this.game.x - cleanSnapshot.x;
                    const dy = this.game.y - cleanSnapshot.y;
                    if (Math.sqrt(dx * dx + dy * dy) > 100) {
                        this.game.x = cleanSnapshot.x;
                        this.game.y = cleanSnapshot.y;
                    }
                    continue;
                }

                if (this.otherPlayers.has(cleanSnapshot.id)) {
                    const p = this.otherPlayers.get(cleanSnapshot.id);
                    if (p.addSnapshot) {
                         p.addSnapshot(cleanSnapshot);
                    } else {
                        // Fallback: Direct Snap
                        p.x = cleanSnapshot.x;
                        p.y = cleanSnapshot.y;
                        p.rotation = cleanSnapshot.rotation;
                        if (cleanSnapshot.input) p.input = cleanSnapshot.input;
                        if (cleanSnapshot.hp !== undefined) p.hp = cleanSnapshot.hp;
                        if (cleanSnapshot.maxHp !== undefined) {
                            p.maxHp = cleanSnapshot.maxHp;
                        }
                    }
                } else {
                    // New player found in snapshot
                    const rp = new RemotePlayer(cleanSnapshot.id);
                    // Initialize with snapshot data
                    rp.x = cleanSnapshot.x;
                    rp.y = cleanSnapshot.y;
                    rp.rotation = cleanSnapshot.rotation;
                    if (cleanSnapshot.input) rp.input = cleanSnapshot.input;
                    if (cleanSnapshot.hp !== undefined) rp.hp = cleanSnapshot.hp;
                    if (cleanSnapshot.maxHp !== undefined) {
                        rp.maxHp = cleanSnapshot.maxHp;
                    }

                    if (rp.addSnapshot) {
                        rp.addSnapshot(cleanSnapshot);
                    }
                    this.otherPlayers.set(cleanSnapshot.id, rp);
                }
            }
        });

        this.socket.on("player_shoot", (data) => {
            const shot = sanitizePlayerShot(data);
            if (!shot) return;
            // The local shooter predicts immediately; this event is for peer shots.
            if (!Object.hasOwn(PartsLibrary, shot.partId)) return;
            const def = PartsLibrary[shot.partId];
            if (def) {
                this.game.spawnProjectile(
                    def,
                    shot.x,
                    shot.y,
                    shot.angle,
                    null
                );
            }
        });

        this.socket.on("enemy_hit", (data) => {
            if (
                !isRecord(data) ||
                typeof data.id !== 'string' ||
                !Number.isFinite(data.damage) ||
                data.damage < 0 ||
                data.damage > 1_000_000
            ) {
                return;
            }
            // Find enemy by ID
            const enemy = this.game.enemies.find(e => e.id === data.id);
            if (enemy) {
                // Apply damage locally
                enemy.takeDamage(data.damage);
                if (data.killed === true && !enemy.isDead) { // Force kill if server says so (or other client)
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
            if (!Array.isArray(list)) return;
            // Clear existing remote players not in list?
            // Actually this is usually sent on join, so just add them.
            for (const p of list) {
                if (
                    !hasFinitePosition(p) ||
                    typeof p.id !== 'string' ||
                    normalizeAngle(p.rotation) === null
                ) {
                    continue;
                }
                const rp = new RemotePlayer(p.id);
                rp.x = p.x;
                rp.y = p.y;
                rp.rotation = normalizeAngle(p.rotation);
                const parts = sanitizeShipManifest(
                    { parts: p.parts },
                    PartsLibrary
                );
                if (parts) rp.setShipData(parts);
                this.otherPlayers.set(p.id, rp);
            }
        });

        this.socket.on("enemy_update", (updates) => {
            if (
                !this.game ||
                !this.game.enemies ||
                !Array.isArray(updates)
            ) {
                return;
            }

            // Map for O(1) lookup
            const enemyMap = new Map(this.game.enemies.map(e => [e.id, e]));

            for (const update of updates) {
                if (
                    !hasFinitePosition(update) ||
                    typeof update.id !== 'string' ||
                    normalizeAngle(update.r) === null ||
                    !Number.isFinite(update.hp)
                ) {
                    continue;
                }
                const enemy = enemyMap.get(update.id);
                if (enemy) {
                    const cleanUpdate = {
                        id: update.id,
                        x: update.x,
                        y: update.y,
                        r: normalizeAngle(update.r),
                        hp: update.hp
                    };
                    if (typeof update.w === 'boolean') {
                        cleanUpdate.w = update.w;
                    }
                    if (enemy.addSnapshot) {
                         enemy.addSnapshot(cleanUpdate);
                    } else {
                        // Fallback: Snap position (naive interpolation later)
                        enemy.x = cleanUpdate.x;
                        enemy.y = cleanUpdate.y;
                        enemy.rotation = cleanUpdate.r;
                        enemy.hp = cleanUpdate.hp;
                    }

                    if (cleanUpdate.w !== undefined) {
                        enemy.isWarpingIn = cleanUpdate.w;
                    }

                    // The legacy socket path supplies enemy snapshots.
                    // The peer-to-peer replacement will use the host-authoritative protocol.
                }
                // Ignore unknown enemies to prevent crash or erratic behavior
            }
        });

        this.socket.on("enemy_shoots", (shoots) => {
            if (!this.game || !Array.isArray(shoots)) return;
            for (const data of shoots) {
                const angle = normalizeAngle(data?.angle);
                if (
                    !hasFinitePosition(data) ||
                    typeof data.type !== 'string' ||
                    data.type.length === 0 ||
                    data.type.length > 80 ||
                    angle === null ||
                    !Number.isFinite(data.speed) ||
                    data.speed < 0 ||
                    data.speed > 10_000 ||
                    !Number.isFinite(data.damage) ||
                    data.damage < 0 ||
                    data.damage > 1_000_000
                ) {
                    continue;
                }
                this.game.spawnEnemyProjectile({
                    x: data.x,
                    y: data.y,
                    angle,
                    type: data.type,
                    speed: data.speed,
                    damage: data.damage
                });
            }
        });
    }

    createLobby(name) {
        if (!this.isConnected) return;
        this.socket.emit('create_lobby', { name });
    }

    joinLobby(roomId) {
        if (!this.isConnected) return;
        this.socket.emit('join_lobby', roomId);
    }

    listLobbies() {
        if (!this.isConnected) return;
        this.socket.emit('list_lobbies');
    }

    leaveLobby() {
        if (!this.isConnected) return;
        this.socket.emit('leave_lobby');
        this.otherPlayers.clear();
    }

    update(dt) {
        if (this.otherPlayers) {
            for (const player of this.otherPlayers.values()) {
                if (player.update) player.update(dt);
            }
        }

        this.sendUpdate(
            this.game.x,
            this.game.y,
            this.game.rotation
        );
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
