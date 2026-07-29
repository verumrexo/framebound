import test from 'node:test';
import assert from 'node:assert/strict';
import { SocketIOSignalingClient } from './SocketIOSignalingClient.js';

class FakeSocket {
    constructor() {
        this.handlers = new Map();
        this.emitted = [];
        this.connected = false;
    }

    on(event, handler) {
        this.handlers.set(event, handler);
    }

    emit(event, payload) {
        this.emitted.push([event, payload]);
    }

    trigger(event, payload) {
        this.handlers.get(event)?.(payload);
    }

    connect() {
        this.connected = true;
    }

    disconnect() {
        this.connected = false;
    }
}

test('signaling client hosts, joins, and relays bounded signals', () => {
    const socket = new FakeSocket();
    const client = new SocketIOSignalingClient({
        socketFactory: () => socket,
        serverUrl: 'http://signal.test'
    });
    const calls = [];
    client.onHosted = data => calls.push(['hosted', data]);
    client.onJoined = data => calls.push(['joined', data]);
    client.onSignal = data => calls.push(['signal', data]);
    client.connect();

    client.host();
    socket.trigger('p2p_hosted', {
        code: 'abc123',
        expiresAt: 5000
    });
    assert.equal(client.code, 'ABC123');
    assert.equal(client.sendSignal('host-id', {
        description: { type: 'offer', sdp: 'sdp' }
    }), true);

    socket.trigger('p2p_joined', {
        code: 'ABC123',
        hostId: 'host-id'
    });
    socket.trigger('p2p_signal', {
        code: 'ABC123',
        fromId: 'host-id',
        signal: { candidate: 'ice' }
    });

    assert.deepEqual(calls, [
        ['hosted', { code: 'ABC123', expiresAt: 5000 }],
        ['joined', { code: 'ABC123', hostId: 'host-id' }],
        ['signal', {
            code: 'ABC123',
            fromId: 'host-id',
            signal: { candidate: 'ice' }
        }]
    ]);
    assert.deepEqual(socket.emitted.at(-1), [
        'p2p_signal',
        {
            code: 'ABC123',
            targetId: 'host-id',
            signal: {
                description: { type: 'offer', sdp: 'sdp' }
            }
        }
    ]);
    client.disconnect();
});

test('signaling client rejects malformed codes, peers, and oversized signals', () => {
    const socket = new FakeSocket();
    const client = new SocketIOSignalingClient({
        socketFactory: () => socket
    });
    const signals = [];
    client.onSignal = signal => signals.push(signal);
    client.connect();

    assert.equal(client.join('bad'), false);
    socket.trigger('p2p_hosted', {
        code: 'ABC123',
        expiresAt: 5000
    });
    assert.equal(client.sendSignal('', { candidate: 'ice' }), false);
    socket.trigger('p2p_signal', {
        code: 'ABC123',
        fromId: '',
        signal: { candidate: 'ice' }
    });
    assert.deepEqual(signals, []);
    client.disconnect();
});

test('host keeps its short code alive and stops the timer on leave', () => {
    const socket = new FakeSocket();
    const scheduled = [];
    const cancelled = [];
    const client = new SocketIOSignalingClient({
        socketFactory: () => socket,
        keepaliveMs: 50,
        scheduleInterval: (callback, delay) => {
            scheduled.push({ callback, delay });
            return callback;
        },
        cancelInterval: handle => cancelled.push(handle)
    });

    client.host();
    socket.connected = true;
    socket.trigger('p2p_hosted', {
        code: 'ABC123',
        expiresAt: 100
    });
    scheduled[0].callback();

    assert.equal(scheduled[0].delay, 50);
    assert.deepEqual(socket.emitted.at(-1), [
        'p2p_keepalive',
        'ABC123'
    ]);
    client.leave();
    assert.deepEqual(cancelled, [scheduled[0].callback]);
    assert.equal(
        socket.emitted.filter(([event]) => event === 'p2p_leave').length,
        1
    );
    client.disconnect();
    assert.equal(
        socket.emitted.filter(([event]) => event === 'p2p_leave').length,
        1
    );
});
