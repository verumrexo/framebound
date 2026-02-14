
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import './setup.js'; // Must be first to handle hoisting

import { GameRoom } from './GameRoom.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Room Management
const rooms = new Map(); // roomId -> GameRoom

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);

    // Lobby Management Events
    socket.on('create_lobby', (data) => {
        // Leave any existing room first
        rooms.forEach(r => {
            if (r.clients.has(socket.id)) r.removePlayer(socket);
        });

        const roomId = generateRoomId();
        const roomName = (data && data.name) ? data.name : `Sector ${roomId}`;

        console.log(`[Server] Creating Lobby: ${roomName} (${roomId})`);

        const room = new GameRoom(roomId, io, roomName);
        rooms.set(roomId, room);

        room.addPlayer(socket);
        socket.emit('lobby_created', { roomId, name: roomName });
    });

    socket.on('join_lobby', (roomId) => {
        // Leave any existing room
        rooms.forEach(r => {
            if (r.clients.has(socket.id)) r.removePlayer(socket);
        });

        const room = rooms.get(roomId);
        if (room) {
            console.log(`[Server] Player ${socket.id} joining ${roomId}`);
            room.addPlayer(socket);
            socket.emit('lobby_joined', { roomId, name: room.name });
        } else {
            socket.emit('lobby_error', 'Room not found');
        }
    });

    socket.on('list_lobbies', () => {
        const list = [];
        rooms.forEach(r => {
            list.push({
                id: r.id,
                name: r.name,
                players: r.getPlayerCount(),
                maxPlayers: 8
            });
        });
        socket.emit('lobby_list', list);
    });

    socket.on('leave_lobby', () => {
        rooms.forEach(r => {
            if (r.clients.has(socket.id)) {
                r.removePlayer(socket);
                // Check if empty
                if (r.getPlayerCount() === 0) {
                    console.log(`[Server] Room ${r.id} empty. Destroying.`);
                    r.destroy();
                    rooms.delete(r.id);
                }
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`[Disconnect] ${socket.id}`);
        // Remove from any room
        rooms.forEach((r, id) => {
            if (r.clients.has(socket.id)) {
                r.removePlayer(socket);
                if (r.getPlayerCount() === 0) {
                    console.log(`[Server] Room ${id} empty. Destroying.`);
                    r.destroy();
                    rooms.delete(id);
                }
            }
        });
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
