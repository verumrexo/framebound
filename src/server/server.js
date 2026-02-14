
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import './setup.js'; // Must be first to handle hoisting

import { LevelGenerator } from '../game/environment/LevelGenerator.js';
import { Enemy } from '../game/entities/Enemy.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

// Serve static files from dist if we want to run production style
// app.use(express.static(join(__dirname, '../../dist')));

const PORT = process.env.PORT || 3000;

// Game State Access
const clients = new Map(); // socket.id -> player data
const GAME_SEED = Math.floor(Math.random() * 2147483647);
console.log(`[Server] Game Seed: ${GAME_SEED}`);

// Generate Level (Server Side)
// Generate Level (Server Side)
const levelGen = new LevelGenerator();
const serverRooms = levelGen.generate(15, GAME_SEED);
const serverEnemies = [];

// Mock Game Object for spawning
const mockGame = {
    enemies: [],
    asteroids: [],
    lootCrates: [],
    bosses: []
};

// Spawn entities in all rooms
console.log('[Server] Spawning entities...');
serverRooms.forEach(room => {
    // We strictly use the room methods to populate
    // Room.js expects 'game' to push global lists, but also populates 'this.enemies' etc.
    // For Boss room, it spawns boss.

    // We try to spawn in all rooms. Room.js handles internal logic (if cleared, etc - but this is new gen)
    // Actually Room.js spawnEnemies checks this.type etc internally? 
    // No, Room.js has spawnEnemies/spawnBoss methods.

    if (room.type === 4) { // RoomType.BOSS = 4? We need to look up or just try spawnBoss
        // Let's just blindly call spawnEnemies. Does it spawn boss?
        // Room.js:340 suggests spawnEnemies calls boss logic?
        // Let's look at Room.js logic to be sure.
        // But adding bosses to mockGame is safe.
    }

    try {
        room.spawnEnemies(mockGame);
    } catch (e) {
        console.warn(`[Server] Failed to spawn in room ${room.gridX},${room.gridY}: ${e.message}`);
    }
});

// Collect all enemies/bosses from rooms
serverRooms.forEach(room => {
    if (room.enemies) {
        room.enemies.forEach(e => serverEnemies.push(e));
    }
    // Check if room has bosses? Room.js usually pushes to game.bosses, but maybe not room.bosses?
    // references?
});

// Also add game.bosses to serverEnemies for update loop
mockGame.bosses.forEach(b => serverEnemies.push(b));

console.log(`[Server] Generated ${serverEnemies.length} enemies (including bosses).`);

// Physics Constants (Matching Game.js)
const PHYSICS_TICK_RATE = 60; // Updates per second
const DT = 1 / PHYSICS_TICK_RATE;
const ACCELERATION = 2000;
const FRICTION = 0.92;

setInterval(() => {
    // Physics Loop
    clients.forEach(player => {
        if (!player.input) return;

        // Apply Input Acceleration
        let inputX = 0;
        let inputY = 0;

        if (player.input.up) inputY -= 1;
        if (player.input.down) inputY += 1;
        if (player.input.left) inputX -= 1;
        if (player.input.right) inputX += 1;

        if (inputX !== 0 || inputY !== 0) {
            const mag = Math.sqrt(inputX * inputX + inputY * inputY);
            // Default stats for now (TODO: Sync stats from client)
            const currentAccel = ACCELERATION;

            player.vx += (inputX / mag) * currentAccel * DT;
            player.vy += (inputY / mag) * currentAccel * DT;
        }

        // Apply Physics
        player.x += player.vx * DT;
        player.y += player.vy * DT;

        // Friction
        player.vx *= FRICTION;
        player.vy *= FRICTION;

        // Rotation
        if (player.input.rotation !== undefined) {
            player.rotation = player.input.rotation;
        }
    });

    // Broadcast State (Snapshot)
    // Send lightweight updates for all players
    const snapshot = [];
    clients.forEach(p => {
        snapshot.push({
            id: p.id,
            x: Math.round(p.x), // Round to save bandwidth
            y: Math.round(p.y),
            rotation: parseFloat(p.rotation.toFixed(2)),
            input: p.input, // Echo input for prediction/visuals
            hp: p.hp,
            maxHp: p.maxHp
        });
    });

    io.emit('world_update', snapshot);

    // --- ENEMY LOGIC ---
    const allPlayers = Array.from(clients.values());
    const enemyUpdates = [];
    const generatedProjectiles = []; // Capture shots this frame

    serverEnemies.forEach(enemy => {
        if (enemy.isDead) return;

        // Find nearest player
        let nearestPlayer = null;
        let minDistSq = Infinity;

        for (const p of allPlayers) {
            const dx = p.x - enemy.x;
            const dy = p.y - enemy.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < minDistSq) {
                minDistSq = dSq;
                nearestPlayer = p;
            }
        }

        // Update Enemy
        try {
            if (nearestPlayer) {
                enemy.update(DT, nearestPlayer.x, nearestPlayer.y, generatedProjectiles, [], [], serverEnemies);
            } else {
                // Idle update if no players
                enemy.update(DT, undefined, undefined, generatedProjectiles, [], [], serverEnemies);
            }
        } catch (e) {
            console.error(`[Server] Enemy Update Error (ID: ${enemy.id}):`, e.message);
        }

        // Prepare Update Packet
        enemyUpdates.push({
            id: enemy.id,
            x: Math.round(enemy.x),
            y: Math.round(enemy.y),
            r: parseFloat(enemy.rotation.toFixed(2)),
            hp: enemy.hp
        });
    });

    if (enemyUpdates.length > 0) {
        io.emit('enemy_update', enemyUpdates);
    }

    if (generatedProjectiles.length > 0) {
        const shoots = generatedProjectiles.map(p => {
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            return {
                x: Math.round(p.x),
                y: Math.round(p.y),
                angle: parseFloat(p.angle.toFixed(4)),
                type: p.type,
                speed: Math.round(speed),
                damage: p.damage
            };
        });
        io.emit('enemy_shoots', shoots);
    }
}, 1000 / PHYSICS_TICK_RATE);

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);
    clients.set(socket.id, {
        id: socket.id,
        x: 0, y: 0,
        vx: 0, vy: 0,
        rotation: 0, map: 'default',
        parts: [], // Ship structure
        input: {},
        hp: 100,
        maxHp: 100
    });

    // Notify client of their ID and the Game Seed
    const deadEnemyIds = [];
    serverEnemies.forEach(e => {
        if (e.isDead) deadEnemyIds.push(e.id);
    });

    socket.emit('init', {
        id: socket.id,
        seed: GAME_SEED,
        deadEnemies: deadEnemyIds
    });

    // Wait for join_game to broadcast
    socket.on('join_game', (data) => {
        const player = clients.get(socket.id);
        if (player) {
            player.parts = data.parts || [];

            // Broadcast new player join with parts
            socket.broadcast.emit('player_join', {
                id: socket.id,
                parts: player.parts
            });

            // Send existing players to new player
            const existingPlayers = Array.from(clients.values()).filter(p => p.id !== socket.id && p.parts);
            socket.emit('players_list', existingPlayers);
        }
    });

    socket.on('update_state', (data) => {
        const player = clients.get(socket.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.rotation = data.rotation;
            // We can still do server-side validation here if needed
        }
    });

    socket.on('player_shoot', (data) => {
        // Broadcast shoot event to all other players
        // We include the sender ID so clients know who shot
        socket.broadcast.emit('player_shoot', {
            id: socket.id,
            ...data
        });
    });

    socket.on('enemy_hit', (data) => {
        // Broadcast enemy hit to all other players
        socket.broadcast.emit('enemy_hit', data);
    });

    socket.on('disconnect', () => {
        console.log(`[Disconnect] ${socket.id}`);
        clients.delete(socket.id);
        io.emit('player_leave', { id: socket.id });
    });

    socket.on('input', (data) => {
        const player = clients.get(socket.id);
        if (player) {
            player.input = data;
            // In a real game loop, we'd apply this input to velocity/pos
            // For now, let's just trust the client's position for the "naive" prototype phase
            // OR we start the real authoritative logic immediately.
            // Let's hold off on full authority until step 2.
        }
    });

    // Temporary: Receive position updates directly (client authoritative for testing)
    // Handle Player Input
    socket.on('player_input', (inputState) => {
        const player = clients.get(socket.id);
        if (player) {
            // Update server-side state (authoritative source)
            // For now, we trust the client's position for hybrid smoothness,
            // but we store inputs for future server-side physics.
            player.x = inputState.x;
            player.y = inputState.y;
            player.rotation = inputState.rotation;
            player.input = inputState; // Store last input

            // Broadcast state to others
            // Optimization: Maybe throttle this? For now, 1:1 relay.
            socket.broadcast.emit('player_update', {
                id: socket.id,
                x: player.x,
                y: player.y,
                rotation: player.rotation,
                input: inputState // Relay inputs too (for prediction)
            });
        }
    });
    socket.on('update_state', (data) => {
        const player = clients.get(socket.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.rotation = data.rotation;
            // Broadcast to others
            socket.broadcast.emit('player_update', {
                id: socket.id,
                x: data.x,
                y: data.y,
                rotation: data.rotation
            });
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
