import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

import {
    FixedWindowRateLimiter,
    sanitizeLobbyName,
    sanitizeRoomId
} from '../shared/ProtocolValidation.js';
import { RoomRegistry } from './RoomRegistry.js';
import { SignalingRegistry } from './SignalingRegistry.js';

export function createFrameboundServer({
    corsOrigin = '*',
    legacyGameplay = true,
    maxPlayers = 4,
    maxRooms = 100,
    signalingRegistry = new SignalingRegistry({
        maxGuests: Math.max(1, maxPlayers - 1)
    }),
    roomFactory = null
} = {}) {
    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: corsOrigin,
            methods: ['GET', 'POST']
        }
    });
    const roomRegistry = new RoomRegistry({ maxPlayers, maxRooms });
    app.disable('x-powered-by');
    app.get('/', (_request, response) => {
        response.json({
            service: 'framebound-signaling',
            status: 'ok',
            gameplay: legacyGameplay
        });
    });
    app.get('/health', (_request, response) => {
        response.json({
            status: 'ok',
            signaling: true,
            legacyGameplay
        });
    });

    function generateRoomId() {
        for (let attempt = 0; attempt < 20; attempt++) {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            if (!roomRegistry.has(roomId)) return roomId;
        }
        throw new Error('Unable to allocate a unique room id');
    }

    function broadcastLobbyList() {
        io.emit('lobby_list', roomRegistry.list());
    }

    function registerSafeHandler(socket, event, handler) {
        socket.on(event, (payload) => {
            try {
                handler(payload);
            } catch (error) {
                console.error(`[Server] ${event} failed for ${socket.id}:`, error);
                socket.emit('lobby_error', 'Request failed');
            }
        });
    }

    io.on('connection', (socket) => {
        console.log(`[Connect] ${socket.id}`);
        const rateLimiter = new FixedWindowRateLimiter();

        registerSafeHandler(socket, 'create_lobby', (data) => {
            if (!legacyGameplay) return;
            if (!rateLimiter.allow('create_lobby', 5, 10_000)) {
                socket.emit('lobby_error', 'Too many lobby requests');
                return;
            }
            if (roomRegistry.size >= roomRegistry.maxRooms) {
                socket.emit('lobby_error', 'Server lobby limit reached');
                return;
            }

            let requestedName = null;
            if (data !== undefined && data !== null) {
                if (typeof data !== 'object' || Array.isArray(data)) {
                    socket.emit('lobby_error', 'Invalid lobby request');
                    return;
                }
                if (data.name !== undefined && data.name !== null) {
                    requestedName = sanitizeLobbyName(data.name);
                    if (!requestedName) {
                        socket.emit('lobby_error', 'Invalid lobby name');
                        return;
                    }
                }
            }

            const roomId = generateRoomId();
            const roomName = requestedName || `Sector ${roomId}`;

            console.log(`[Server] Creating Lobby: ${roomName} (${roomId})`);

            roomRegistry.leaveSocket(socket);
            if (typeof roomFactory !== 'function') {
                socket.emit('lobby_error', 'Legacy gameplay unavailable');
                return;
            }
            const room = roomFactory(roomId, io, roomName);
            if (!roomRegistry.add(room)) {
                room.destroy();
                socket.emit('lobby_error', 'Unable to create lobby');
                return;
            }
            if (!room.addPlayer(socket)) {
                roomRegistry.remove(room.id, { destroy: true });
                socket.emit('lobby_error', 'Unable to create lobby');
                return;
            }

            socket.emit('lobby_created', { roomId, name: roomName });
            broadcastLobbyList();
        });

        registerSafeHandler(socket, 'join_lobby', (rawRoomId) => {
            if (!legacyGameplay) return;
            if (!rateLimiter.allow('join_lobby', 20, 10_000)) {
                socket.emit('lobby_error', 'Too many lobby requests');
                return;
            }

            const roomId = sanitizeRoomId(rawRoomId);
            if (!roomId) {
                socket.emit('lobby_error', 'Invalid room id');
                return;
            }

            const currentRoom = roomRegistry.findBySocketId(socket.id);
            if (currentRoom && currentRoom.id === roomId) {
                socket.emit('lobby_joined', { roomId, name: currentRoom.name });
                return;
            }

            const room = roomRegistry.get(roomId);
            if (!room) {
                socket.emit('lobby_error', 'Room not found');
                return;
            }
            if (!roomRegistry.canJoin(room)) {
                socket.emit('lobby_error', 'Room is full');
                return;
            }

            roomRegistry.leaveSocket(socket);
            console.log(`[Server] Player ${socket.id} joining ${roomId}`);
            if (!room.addPlayer(socket)) {
                socket.emit('lobby_error', 'Room is full');
                return;
            }

            socket.emit('lobby_joined', { roomId, name: room.name });
            broadcastLobbyList();
        });

        registerSafeHandler(socket, 'list_lobbies', () => {
            if (!legacyGameplay) return;
            if (!rateLimiter.allow('list_lobbies', 20, 1000)) return;
            socket.emit('lobby_list', roomRegistry.list());
        });

        registerSafeHandler(socket, 'leave_lobby', () => {
            if (!legacyGameplay) return;
            if (roomRegistry.leaveSocket(socket)) {
                broadcastLobbyList();
            }
        });

        registerSafeHandler(socket, 'p2p_host', () => {
            if (!rateLimiter.allow('p2p_host', 5, 10_000)) {
                socket.emit('p2p_error', 'Too many host requests');
                return;
            }
            notifySignalingDeparture(
                io,
                signalingRegistry.leave(socket.id)
            );
            const session = signalingRegistry.create(socket.id);
            if (!session) {
                socket.emit('p2p_error', 'Unable to create session code');
                return;
            }
            socket.emit('p2p_hosted', {
                code: session.code,
                expiresAt: session.expiresAt
            });
        });

        registerSafeHandler(socket, 'p2p_join', (rawCode) => {
            if (!rateLimiter.allow('p2p_join', 20, 10_000)) {
                socket.emit('p2p_error', 'Too many join requests');
                return;
            }
            const code = sanitizeRoomId(rawCode);
            const targetSession = code
                ? signalingRegistry.get(code)
                : null;
            if (
                !targetSession ||
                (
                    !targetSession.guests.has(socket.id) &&
                    targetSession.guests.size >= signalingRegistry.maxGuests
                )
            ) {
                socket.emit('p2p_error', 'Session not found or full');
                return;
            }
            notifySignalingDeparture(
                io,
                signalingRegistry.leave(socket.id)
            );
            const session = signalingRegistry.join(socket.id, code);
            if (!session) {
                socket.emit('p2p_error', 'Session not found or full');
                return;
            }
            socket.emit('p2p_joined', {
                code: session.code,
                hostId: session.hostId
            });
            io.to(session.hostId).emit('p2p_peer_joined', {
                code: session.code,
                peerId: socket.id
            });
        });

        registerSafeHandler(socket, 'p2p_signal', (data) => {
            if (!rateLimiter.allow('p2p_signal', 240, 10_000)) return;
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                return;
            }
            const relay = signalingRegistry.relay(
                socket.id,
                data.code,
                data.targetId,
                data.signal
            );
            if (!relay) return;
            io.to(relay.targetId).emit('p2p_signal', {
                code: relay.code,
                fromId: relay.fromId,
                signal: relay.signal
            });
        });

        registerSafeHandler(socket, 'p2p_keepalive', (rawCode) => {
            if (!rateLimiter.allow('p2p_keepalive', 10, 60_000)) return;
            signalingRegistry.touch(socket.id, rawCode);
        });

        registerSafeHandler(socket, 'p2p_leave', () => {
            notifySignalingDeparture(io, signalingRegistry.leave(socket.id));
        });

        socket.on('disconnect', () => {
            console.log(`[Disconnect] ${socket.id}`);
            rateLimiter.clear();
            notifySignalingDeparture(io, signalingRegistry.leave(socket.id));
            if (roomRegistry.leaveSocket(socket)) {
                broadcastLobbyList();
            }
        });
    });

    return {
        app,
        httpServer,
        io,
        roomRegistry,
        signalingRegistry,
        start(port, host) {
            return new Promise((resolve, reject) => {
                const onError = (error) => {
                    httpServer.off('listening', onListening);
                    reject(error);
                };
                const onListening = () => {
                    httpServer.off('error', onError);
                    resolve(httpServer.address());
                };
                httpServer.once('error', onError);
                httpServer.once('listening', onListening);
                httpServer.listen(port, host);
            });
        },
        stop() {
            roomRegistry.destroyAll();
            if (!httpServer.listening) return Promise.resolve();
            return new Promise(resolve => io.close(resolve));
        }
    };
}

function notifySignalingDeparture(io, changes) {
    for (const change of changes) {
        if (change.closed) {
            for (const guestId of change.guests) {
                io.to(guestId).emit('p2p_host_left', {
                    code: change.code
                });
            }
        } else {
            io.to(change.hostId).emit('p2p_peer_left', {
                code: change.code,
                peerId: change.guestId
            });
        }
    }
}
