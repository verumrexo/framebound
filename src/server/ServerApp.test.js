import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { get as httpGet } from 'node:http';
import { io as connectSocket } from 'socket.io-client';

const { createFrameboundServer } = await import('./ServerApp.js');
const { GameRoom } = await import('./GameRoom.js');

class FakeRoom {
    constructor(id, io, name) {
        this.id = id;
        this.io = io;
        this.name = name;
        this.clients = new Map();
        this.destroyed = false;
        this.maxPlayers = 8;
    }

    addPlayer(socket) {
        if (this.clients.size >= this.maxPlayers) return false;
        this.clients.set(socket.id, { socket });
        socket.join(this.id);
        return true;
    }

    removePlayer(socket) {
        this.clients.delete(socket.id);
        socket.leave(this.id);
        return true;
    }

    getPlayerCount() {
        return this.clients.size;
    }

    destroy() {
        this.destroyed = true;
    }
}

function waitForEvent(socket, event, predicate = () => true) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off(event, onEvent);
            reject(new Error(`Timed out waiting for ${event}`));
        }, 2000);

        const onEvent = (data) => {
            if (!predicate(data)) return;
            clearTimeout(timeout);
            socket.off(event, onEvent);
            resolve(data);
        };

        socket.on(event, onEvent);
    });
}

async function connectClient(url) {
    const socket = connectSocket(url, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false
    });
    await waitForEvent(socket, 'connect');
    return socket;
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        const request = httpGet(url, response => {
            let raw = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                raw += chunk;
            });
            response.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                } catch (error) {
                    reject(error);
                }
            });
        });
        request.on('error', reject);
    });
}

test('lobby server enforces caps, preserves valid sessions, and cleans switched rooms', async () => {
    const server = createFrameboundServer({
        maxPlayers: 2,
        maxRooms: 10,
        roomFactory: (id, io, name) => new FakeRoom(id, io, name)
    });
    const clients = [];

    try {
        const address = await server.start(0, '127.0.0.1');
        const url = `http://127.0.0.1:${address.port}`;
        clients.push(
            await connectClient(url),
            await connectClient(url),
            await connectClient(url)
        );
        const [host, peer, overflow] = clients;

        const createdPromise = waitForEvent(host, 'lobby_created');
        host.emit('create_lobby', { name: 'test sector' });
        const created = await createdPromise;
        const firstRoom = server.roomRegistry.get(created.roomId);

        const joinedPromise = waitForEvent(peer, 'lobby_joined');
        peer.emit('join_lobby', created.roomId.toLowerCase());
        assert.equal((await joinedPromise).roomId, created.roomId);

        const fullPromise = waitForEvent(overflow, 'lobby_error');
        overflow.emit('join_lobby', created.roomId);
        assert.equal(await fullPromise, 'Room is full');

        const invalidPromise = waitForEvent(peer, 'lobby_error');
        peer.emit('join_lobby', 'not-a-room');
        assert.equal(await invalidPromise, 'Invalid room id');
        assert.equal(firstRoom.clients.has(peer.id), true);

        const soloCreatedPromise = waitForEvent(overflow, 'lobby_created');
        overflow.emit('create_lobby', { name: 'solo one' });
        const soloCreated = await soloCreatedPromise;
        const abandonedRoom = server.roomRegistry.get(soloCreated.roomId);

        const replacementPromise = waitForEvent(overflow, 'lobby_created');
        overflow.emit('create_lobby', { name: 'solo two' });
        await replacementPromise;

        assert.equal(abandonedRoom.destroyed, true);
        assert.equal(server.roomRegistry.has(soloCreated.roomId), false);

        const listPromise = waitForEvent(host, 'lobby_list');
        host.emit('list_lobbies');
        const list = await listPromise;
        assert.equal(list.length, 2);
        assert.equal(list.every(lobby => lobby.maxPlayers === 2), true);
    } finally {
        for (const client of clients) client.disconnect();
        await server.stop();
    }
});

test('real game rooms survive malformed gameplay packets and keep snapshotting', async () => {
    const server = createFrameboundServer({
        maxRooms: 2,
        roomFactory: (id, io, name) => new GameRoom(id, io, name)
    });
    let client = null;

    try {
        const address = await server.start(0, '127.0.0.1');
        client = await connectClient(`http://127.0.0.1:${address.port}`);

        const initPromise = waitForEvent(client, 'init');
        const createdPromise = waitForEvent(client, 'lobby_created');
        client.emit('create_lobby', { name: 'runtime smoke' });
        const [init] = await Promise.all([initPromise, createdPromise]);

        client.emit('player_input', { aimAngle: 1e308 });
        client.emit('player_shoot', null);
        client.emit('join_game', null);

        const snapshot = await waitForEvent(
            client,
            'world_update',
            data => Array.isArray(data) && data.some(player => player.id === init.id)
        );

        assert.equal(snapshot.some(player => player.id === init.id), true);
        assert.equal(client.connected, true);
    } finally {
        if (client) client.disconnect();
        await server.stop();
    }
});

test('signaling service relays only session-member webrtc messages', async () => {
    const server = createFrameboundServer({ maxPlayers: 3 });
    const clients = [];

    try {
        const address = await server.start(0, '127.0.0.1');
        const url = `http://127.0.0.1:${address.port}`;
        clients.push(
            await connectClient(url),
            await connectClient(url),
            await connectClient(url)
        );
        const [host, guest, outsider] = clients;

        const hostedPromise = waitForEvent(host, 'p2p_hosted');
        host.emit('p2p_host');
        const hosted = await hostedPromise;

        const peerJoinedPromise = waitForEvent(host, 'p2p_peer_joined');
        const joinedPromise = waitForEvent(guest, 'p2p_joined');
        guest.emit('p2p_join', hosted.code.toLowerCase());
        const joined = await joinedPromise;
        assert.equal(joined.hostId, host.id);
        assert.equal((await peerJoinedPromise).peerId, guest.id);

        const signalPromise = waitForEvent(host, 'p2p_signal');
        guest.emit('p2p_signal', {
            code: hosted.code,
            targetId: host.id,
            signal: { candidate: 'candidate-a' }
        });
        assert.deepEqual(await signalPromise, {
            code: hosted.code,
            fromId: guest.id,
            signal: { candidate: 'candidate-a' }
        });

        outsider.emit('p2p_signal', {
            code: hosted.code,
            targetId: host.id,
            signal: { candidate: 'forged' }
        });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(server.signalingRegistry.get(hosted.code).guests.size, 1);

        const hostLeftPromise = waitForEvent(guest, 'p2p_host_left');
        host.emit('p2p_leave');
        assert.equal((await hostLeftPromise).code, hosted.code);
    } finally {
        for (const client of clients) client.disconnect();
        await server.stop();
    }
});

test('signaling-only deployment reports health and cannot allocate game rooms', async () => {
    const server = createFrameboundServer({
        legacyGameplay: false
    });
    let client = null;

    try {
        const address = await server.start(0, '127.0.0.1');
        const url = `http://127.0.0.1:${address.port}`;
        assert.deepEqual(await getJson(url), {
            service: 'framebound-signaling',
            status: 'ok',
            gameplay: false
        });
        assert.deepEqual(await getJson(`${url}/health`), {
            status: 'ok',
            signaling: true,
            legacyGameplay: false
        });

        client = await connectClient(url);
        client.emit('create_lobby', { name: 'should not exist' });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(server.roomRegistry.size, 0);

        const hostedPromise = waitForEvent(client, 'p2p_hosted');
        client.emit('p2p_host');
        assert.match((await hostedPromise).code, /^[A-Z0-9]{6}$/);
    } finally {
        client?.disconnect();
        await server.stop();
    }
});
