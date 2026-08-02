import test from 'node:test';
import assert from 'node:assert/strict';
import { PeerConnectionCoordinator } from './PeerConnectionCoordinator.js';

class FakeSignaling {
    constructor() {
        this.calls = [];
        this.code = null;
    }

    connect() {
        this.calls.push(['connect']);
    }

    host() {
        this.calls.push(['host']);
    }

    join(code) {
        this.calls.push(['join', code]);
        return /^[A-Z0-9]{6}$/.test(code);
    }

    sendSignal(peerId, signal) {
        this.calls.push(['signal', peerId, signal]);
        return true;
    }

    leave() {
        this.calls.push(['leave']);
    }
}

class FakeLink {
    constructor({ initiator }) {
        this.initiator = initiator;
        this.closed = false;
        this.signals = [];
        this.transport = {
            send() {},
            onMessage() {
                return () => {};
            },
            onClose() {
                return () => {};
            },
            close() {}
        };
    }

    async createOffer() {
        return {
            description: { type: 'offer', sdp: 'offer' }
        };
    }

    async acceptSignal(signal) {
        this.signals.push(signal);
        if (signal.description?.type === 'offer') {
            return {
                description: { type: 'answer', sdp: 'answer' }
            };
        }
        return null;
    }

    open() {
        this.onTransport?.(this.transport);
    }

    close() {
        this.closed = true;
    }
}

test('host creates offers and attaches opened peers to authority', async () => {
    const signaling = new FakeSignaling();
    const attached = [];
    const hostSession = {
        attachPeer: (...args) => attached.push(args),
        detachPeer() {},
        update() {}
    };
    const links = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        hostSession,
        createLink: options => {
            const link = new FakeLink(options);
            links.push(link);
            return link;
        }
    });

    coordinator.host();
    signaling.onHosted({ code: 'ABC123', expiresAt: 9999 });
    signaling.onPeerJoined({ code: 'ABC123', peerId: 'guest-a' });
    await Promise.resolve();

    assert.equal(coordinator.role, 'host');
    assert.equal(coordinator.code, 'ABC123');
    assert.equal(links[0].initiator, true);
    assert.deepEqual(signaling.calls.at(-1), [
        'signal',
        'guest-a',
        { description: { type: 'offer', sdp: 'offer' } }
    ]);

    links[0].open();
    assert.deepEqual(attached, [['guest-a', links[0].transport]]);
});

test('host shutdown closes authority before tearing down peer links', async () => {
    const signaling = new FakeSignaling();
    const calls = [];
    const links = [];
    const hostSession = {
        attachPeer() {},
        detachPeer: (peerId, reason) =>
            calls.push(['detach', peerId, reason]),
        close: reason => calls.push(['close', reason])
    };
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        hostSession,
        createLink: options => {
            const link = new FakeLink(options);
            const originalClose = link.close.bind(link);
            link.close = () => {
                calls.push(['link_close']);
                originalClose();
            };
            links.push(link);
            return link;
        }
    });

    coordinator.host();
    signaling.onHosted({ code: 'ABC123', expiresAt: 9999 });
    signaling.onPeerJoined({ code: 'ABC123', peerId: 'guest-a' });
    await Promise.resolve();

    coordinator.disconnect('host_quit');

    assert.equal(links[0].closed, true);
    assert.deepEqual(calls, [
        ['close', 'host_quit'],
        ['detach', 'guest-a', 'host_quit'],
        ['link_close']
    ]);
});

test('guest answers the host and starts its protocol client after channel open', async () => {
    const signaling = new FakeSignaling();
    const starts = [];
    const links = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        createLink: options => {
            const link = new FakeLink(options);
            links.push(link);
            return link;
        },
        createClient: transport => ({
            transport,
            start: () => starts.push('start'),
            close() {}
        })
    });

    assert.equal(coordinator.join('ABC123'), true);
    signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
    await signaling.onSignal({
        code: 'ABC123',
        fromId: 'host-a',
        signal: {
            description: { type: 'offer', sdp: 'offer' }
        }
    });
    await Promise.resolve();

    assert.equal(links[0].initiator, false);
    assert.deepEqual(signaling.calls.at(-1), [
        'signal',
        'host-a',
        { description: { type: 'answer', sdp: 'answer' } }
    ]);
    links[0].open();
    assert.deepEqual(starts, ['start']);
});

test('guest hello startup failure enters bounded reconnect instead of hanging', () => {
    for (const mode of ['reject', 'throw']) {
        const signaling = new FakeSignaling();
        const links = [];
        const scheduled = [];
        const statuses = [];
        const coordinator = new PeerConnectionCoordinator({
            signaling,
            createLink: options => {
                const link = new FakeLink(options);
                links.push(link);
                return link;
            },
            createClient: () => ({
                start() {
                    if (mode === 'throw') {
                        throw new Error('hello exploded');
                    }
                    return false;
                },
                close() {}
            }),
            reconnectDelayMs: 50,
            maxReconnectAttempts: 1,
            schedule: (callback, delay) => {
                scheduled.push({ callback, delay });
                return callback;
            },
            cancelSchedule() {}
        });
        coordinator.onStatus = (...args) => statuses.push(args);

        coordinator.join('ABC123');
        signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
        assert.doesNotThrow(() => links[0].open());

        assert.equal(links[0].closed, true);
        assert.equal(coordinator.hostId, null);
        assert.ok(statuses.some(([status]) => status === 'error'));
        assert.ok(scheduled.some(entry => entry.delay === 50));
        assert.deepEqual(statuses.at(-1), ['reconnecting', 1]);

        scheduled.find(entry => entry.delay === 50).callback();
        signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
        assert.doesNotThrow(() => links[1].open());
        assert.equal(coordinator.role, null);
        assert.ok(statuses.some(([status]) =>
            status === 'connection_lost'
        ));
    }
});

test('host peer attachment failure closes only the rejected link', async () => {
    const signaling = new FakeSignaling();
    const links = [];
    const statuses = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        hostSession: {
            attachPeer() {
                throw new Error('authority attach exploded');
            },
            detachPeer() {}
        },
        createLink: options => {
            const link = new FakeLink(options);
            links.push(link);
            return link;
        }
    });
    coordinator.onStatus = (...args) => statuses.push(args);

    coordinator.host();
    signaling.onHosted({ code: 'ABC123', expiresAt: 9999 });
    signaling.onPeerJoined({ code: 'ABC123', peerId: 'guest-a' });
    await Promise.resolve();
    assert.doesNotThrow(() => links[0].open());

    assert.equal(links[0].closed, true);
    assert.equal(coordinator.role, 'host');
    assert.equal(coordinator.code, 'ABC123');
    assert.ok(statuses.some(([, detail]) =>
        detail === 'authority attach exploded'
    ));
});

test('host departure tears down guest links explicitly', () => {
    const signaling = new FakeSignaling();
    const links = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        createLink: options => {
            const link = new FakeLink(options);
            links.push(link);
            return link;
        }
    });

    coordinator.join('ABC123');
    signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
    signaling.onHostLeft('ABC123');

    assert.equal(coordinator.role, null);
    assert.equal(links[0].closed, true);
});

test('guest retries a failed direct link and preserves the session code', () => {
    const signaling = new FakeSignaling();
    const links = [];
    const scheduled = [];
    const statuses = [];
    const peerStates = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        createLink: options => {
            const link = new FakeLink(options);
            links.push(link);
            return link;
        },
        createClient: () => ({
            start() {},
            close() {}
        }),
        reconnectDelayMs: 100,
        schedule: (callback, delay) => {
            scheduled.push({ callback, delay });
            return callback;
        },
        cancelSchedule() {}
    });
    coordinator.onStatus = (...args) => statuses.push(args);
    coordinator.onPeerState = state => peerStates.push(state);

    coordinator.join('ABC123');
    signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
    links[0].onStateChange('failed');

    assert.equal(links[0].closed, true);
    assert.equal(coordinator.hostId, null);
    assert.deepEqual(peerStates, [{
        peerId: 'host-a',
        state: 'failed'
    }]);
    const reconnect = scheduled.find(entry => entry.delay === 100);
    assert.ok(reconnect);
    assert.deepEqual(statuses.at(-1), ['reconnecting', 1]);

    reconnect.callback();
    assert.deepEqual(signaling.calls.at(-1), ['join', 'ABC123']);

    const reconnectTimeouts = scheduled.filter(entry =>
        entry.delay === 10_000
    );
    assert.equal(reconnectTimeouts.length, 2);
    reconnectTimeouts.at(-1).callback();
    assert.equal(coordinator.role, null);
    assert.ok(statuses.some(([status]) => status === 'join_timeout'));
});

test('guest reconnect rejection and exceptions close cleanly', () => {
    for (const mode of ['reject', 'throw']) {
        const signaling = new FakeSignaling();
        const links = [];
        const scheduled = [];
        const statuses = [];
        const closed = [];
        const coordinator = new PeerConnectionCoordinator({
            signaling,
            createLink: options => {
                const link = new FakeLink(options);
                links.push(link);
                return link;
            },
            reconnectDelayMs: 100,
            schedule: (callback, delay) => {
                scheduled.push({ callback, delay });
                return callback;
            },
            cancelSchedule() {}
        });
        coordinator.onStatus = (...args) => statuses.push(args);
        coordinator.onClosed = data => closed.push(data);

        coordinator.join('ABC123');
        signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
        links[0].onStateChange('failed');
        signaling.join = () => {
            if (mode === 'throw') throw new Error('reconnect exploded');
            return false;
        };

        const reconnect = scheduled.find(entry => entry.delay === 100);
        assert.equal(reconnect.callback(), undefined);
        assert.equal(coordinator.role, null);
        assert.ok(statuses.some(([status]) => status === 'error'));
        assert.deepEqual(closed, [{
            role: 'guest',
            reason: 'reconnect_failed'
        }]);
    }
});

test('guest join fails clearly when signaling never answers', () => {
    const signaling = new FakeSignaling();
    const scheduled = [];
    const statuses = [];
    const closed = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        joinTimeoutMs: 250,
        schedule: (callback, delay) => {
            scheduled.push({ callback, delay });
            return callback;
        },
        cancelSchedule() {}
    });
    coordinator.onStatus = (...args) => statuses.push(args);
    coordinator.onClosed = data => closed.push(data);

    assert.equal(coordinator.join('ABC123'), true);
    assert.equal(scheduled[0].delay, 250);
    scheduled[0].callback();

    assert.equal(coordinator.role, null);
    assert.ok(statuses.some(([status]) => status === 'join_timeout'));
    assert.deepEqual(signaling.calls.at(-1), ['leave']);
    assert.deepEqual(closed, [{
        role: 'guest',
        reason: 'join_timeout'
    }]);
});

test('stalled direct negotiation closes the link and schedules reconnect', () => {
    const signaling = new FakeSignaling();
    const links = [];
    const scheduled = [];
    const statuses = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        createLink: options => {
            const link = new FakeLink(options);
            links.push(link);
            return link;
        },
        connectionTimeoutMs: 300,
        reconnectDelayMs: 50,
        schedule: (callback, delay) => {
            scheduled.push({ callback, delay });
            return callback;
        },
        cancelSchedule() {}
    });
    coordinator.onStatus = (...args) => statuses.push(args);

    coordinator.join('ABC123');
    signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
    const connectionTimeout = scheduled.find(entry =>
        entry.delay === 300
    );
    connectionTimeout.callback();

    assert.equal(links[0].closed, true);
    assert.ok(statuses.some(([, detail]) =>
        detail === 'direct peer connection timed out'
    ));
    assert.deepEqual(statuses.at(-1), ['reconnecting', 1]);
});

test('guest gives up after bounded reconnect attempts', () => {
    const signaling = new FakeSignaling();
    const links = [];
    const scheduled = [];
    const statuses = [];
    const closed = [];
    const coordinator = new PeerConnectionCoordinator({
        signaling,
        createLink: options => {
            const link = new FakeLink(options);
            links.push(link);
            return link;
        },
        maxReconnectAttempts: 1,
        reconnectDelayMs: 50,
        schedule: (callback, delay) => {
            scheduled.push({ callback, delay });
            return callback;
        },
        cancelSchedule() {}
    });
    coordinator.onStatus = (...args) => statuses.push(args);
    coordinator.onClosed = data => closed.push(data);

    coordinator.join('ABC123');
    signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
    links[0].onStateChange('failed');
    scheduled.find(entry => entry.delay === 50).callback();

    signaling.onJoined({ code: 'ABC123', hostId: 'host-a' });
    links[1].onStateChange('failed');

    assert.equal(coordinator.role, null);
    assert.ok(statuses.some(([status]) => status === 'connection_lost'));
    assert.deepEqual(closed, [{
        role: 'guest',
        reason: 'connection_lost'
    }]);
});
