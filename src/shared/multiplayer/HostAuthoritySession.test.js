import test from 'node:test';
import assert from 'node:assert/strict';
import { HostAuthoritySession } from './HostAuthoritySession.js';
import { LoopbackTransport } from './LoopbackTransport.js';
import { PeerSessionClient } from './PeerSessionClient.js';
import { encodePeerMessage } from './PeerProtocol.js';

function createSimulation() {
    const calls = [];
    const players = new Map();
    return {
        calls,
        players,
        addPeer(id, profile) {
            calls.push(['add', id, profile]);
            players.set(id, {
                x: 0,
                input: null,
                shots: 0
            });
            return true;
        },
        removePeer(id, reason) {
            calls.push(['remove', id, reason]);
            players.delete(id);
        },
        applyInput(id, input, sequence) {
            calls.push(['input', id, input, sequence]);
            players.get(id).input = input;
        },
        requestAction(id, action, payload, sequence) {
            calls.push(['action', id, action, payload, sequence]);
            if (action !== 'shoot' || payload.active !== true) {
                return false;
            }
            players.get(id).shots++;
            return {
                type: 'fire_intent',
                payload: {
                    peerId: id,
                    aimAngle: payload.aimAngle
                }
            };
        },
        step(dt) {
            calls.push(['step', dt]);
            for (const player of players.values()) {
                if (player.input?.right) player.x += dt * 100;
            }
        },
        snapshotFor() {
            return {
                players: [...players.entries()].map(([id, state]) => ({
                    id,
                    x: state.x,
                    shots: state.shots
                }))
            };
        },
        fullStateFor(id) {
            return {
                self: id,
                players: [...players.keys()]
            };
        }
    };
}

async function flushMessages() {
    await Promise.resolve();
    await Promise.resolve();
}

test('loopback client joins, sends input, and receives host snapshots with ack', async () => {
    const simulation = createSimulation();
    const [hostTransport, clientTransport] = LoopbackTransport.createPair();
    const host = new HostAuthoritySession(simulation);
    host.attachPeer('peer-a', hostTransport);
    const client = new PeerSessionClient(clientTransport, {
        displayName: 'ace'
    });
    const resyncs = [];
    const snapshots = [];
    client.onFullResync = state => resyncs.push(state);
    client.onSnapshot = (state, message) =>
        snapshots.push([state, message.ack]);

    client.start();
    await flushMessages();
    assert.equal(client.connected, true);
    assert.deepEqual(resyncs, [{
        self: 'peer-a',
        players: ['peer-a']
    }]);

    client.sendInput({
        up: false,
        down: false,
        left: false,
        right: true,
        shift: false
    });
    await flushMessages();
    host.update(0.05);
    await flushMessages();

    assert.equal(simulation.players.get('peer-a').x, 5);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0][1], 1);
});

test('host can flush authoritative state before a paused team wipe', () => {
    const simulation = createSimulation();
    simulation.players.set('ready', { x: 7, shots: 0 });
    const sent = [];
    const host = new HostAuthoritySession(simulation);
    host.tick = 12;
    host.peers.set('ready', {
        ready: true,
        playerId: 'ready',
        lastSequence: 4,
        transport: {
            send: message => {
                sent.push(JSON.parse(message));
                return true;
            }
        }
    });
    host.peers.set('waiting', {
        ready: false,
        playerId: null,
        lastSequence: 0,
        transport: {
            send: () => {
                throw new Error('unready peer received a snapshot');
            }
        }
    });

    assert.equal(host.flushSnapshots(), true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, 'snapshot');
    assert.equal(sent[0].tick, 12);
    assert.equal(sent[0].ack, 4);
    assert.equal(sent[0].state.players[0].x, 7);
});

test('oversized snapshots reject one peer without escaping the host frame', () => {
    const simulation = createSimulation();
    simulation.snapshotFor = () => ({
        payload: 'x'.repeat(1_000_001)
    });
    const sent = [];
    const closed = [];
    const host = new HostAuthoritySession(simulation);
    host.peers.set('ready', {
        ready: true,
        playerId: 'ready',
        lastSequence: 0,
        transport: {
            send: message => {
                sent.push(JSON.parse(message));
                return true;
            },
            close: reason => closed.push(reason)
        }
    });

    assert.doesNotThrow(() => host.flushSnapshots());
    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, 'error');
    assert.equal(sent[0].code, 'state_too_large');
    assert.equal(sent[0].recoverable, false);
    assert.deepEqual(closed, ['state_too_large']);
});

test('a transport send race cannot escape snapshot or broadcast delivery', () => {
    const simulation = createSimulation();
    const closed = [];
    const host = new HostAuthoritySession(simulation);
    const peer = {
        ready: true,
        playerId: 'ready',
        lastSequence: 0,
        transport: {
            send: () => {
                throw new Error('channel closed between check and send');
            },
            close: reason => closed.push(reason)
        }
    };
    host.peers.set('ready', peer);

    assert.doesNotThrow(() => host.flushSnapshots());
    assert.doesNotThrow(() => host.broadcast('peer_left', {
        peerId: 'gone'
    }));
    assert.deepEqual(closed, [
        'transport_send_failed',
        'transport_send_failed'
    ]);
});

test('host derives actions and rejects guest-authored outcomes', async () => {
    const simulation = createSimulation();
    const [hostTransport, clientTransport] = LoopbackTransport.createPair();
    const host = new HostAuthoritySession(simulation);
    host.attachPeer('peer-a', hostTransport);
    const client = new PeerSessionClient(clientTransport);
    const events = [];
    const errors = [];
    client.onEvent = event => events.push(event);
    client.onError = error => errors.push(error.code);
    client.start();
    await flushMessages();

    client.requestAction('shoot', {
        aimAngle: 0,
        active: true,
        damage: 1_000_000,
        reward: 'gold'
    });
    await flushMessages();

    assert.equal(simulation.players.get('peer-a').shots, 1);
    assert.equal(events[0].eventType, 'fire_intent');
    assert.deepEqual(
        simulation.calls.find(call => call[0] === 'action')[4],
        1
    );
    assert.equal(
        Object.hasOwn(
            simulation.calls.find(call => call[0] === 'action')[3],
            'damage'
        ),
        false
    );

    client.requestAction('shoot', {
        aimAngle: 0,
        active: false
    });
    await flushMessages();
    assert.deepEqual(errors, ['action_rejected']);
});

test('stale sequences and repeated malformed packets cannot mutate host state', async () => {
    const simulation = createSimulation();
    const [hostTransport, clientTransport] = LoopbackTransport.createPair();
    const host = new HostAuthoritySession(simulation);
    host.attachPeer('peer-a', hostTransport);
    const client = new PeerSessionClient(clientTransport);
    const errors = [];
    client.onError = error => errors.push(error.code);
    client.start();
    await flushMessages();

    client.sendInput({
        up: true,
        down: false,
        left: false,
        right: false,
        shift: false
    });
    await flushMessages();
    clientTransport.send(JSON.stringify({
        version: 1,
        type: 'input',
        sequence: 1,
        input: {
            up: false,
            down: true,
            left: false,
            right: false,
            shift: false
        }
    }));
    await flushMessages();

    assert.equal(simulation.players.get('peer-a').input.up, true);
    assert.ok(errors.includes('stale_sequence'));

    for (let index = 0; index < 8; index++) {
        clientTransport.send('{bad json');
        await flushMessages();
    }
    assert.equal(host.peers.has('peer-a'), false);
});

test('reconnect token restores the same host-owned player and sends a full resync', async () => {
    const simulation = createSimulation();
    const suspended = [];
    const resumed = [];
    simulation.suspendPeer = (...args) => suspended.push(args);
    simulation.resumePeer = (...args) => resumed.push(args);
    const scheduled = [];
    const host = new HostAuthoritySession(simulation, {
        createResumeToken: () => 'resume-token',
        schedule: callback => {
            scheduled.push(callback);
            return callback;
        },
        cancelSchedule() {}
    });

    const [hostTransportA, clientTransportA] =
        LoopbackTransport.createPair();
    host.attachPeer('connection-a', hostTransportA);
    const clientA = new PeerSessionClient(clientTransportA);
    clientA.start();
    await flushMessages();
    const token = clientA.resumeToken;

    clientTransportA.close('network_lost');
    assert.deepEqual(suspended, [['connection-a', 'network_lost']]);

    const [hostTransportB, clientTransportB] =
        LoopbackTransport.createPair();
    host.attachPeer('connection-b', hostTransportB);
    const clientB = new PeerSessionClient(clientTransportB, {
        resumeToken: token
    });
    const resyncs = [];
    clientB.onFullResync = state => resyncs.push(state);
    clientB.start();
    await flushMessages();

    assert.equal(clientB.peerId, 'connection-a');
    assert.deepEqual(resumed, [['connection-a', 'connection-b']]);
    assert.deepEqual(resyncs, [{
        self: 'connection-a',
        players: ['connection-a']
    }]);
    assert.equal(host.suspendedPeers.size, 0);
    assert.equal(scheduled.length, 1);
});

test('closing host authority removes active and suspended players without resume timers', async () => {
    const simulation = createSimulation();
    simulation.suspendPeer = () => {};
    const canceled = [];
    const host = new HostAuthoritySession(simulation, {
        createResumeToken: id => `resume-${id}`,
        schedule: callback => callback,
        cancelSchedule: timeout => canceled.push(timeout)
    });

    const [hostTransportA, clientTransportA] =
        LoopbackTransport.createPair();
    host.attachPeer('active-peer', hostTransportA);
    const clientA = new PeerSessionClient(clientTransportA);
    clientA.start();
    await flushMessages();

    const [hostTransportB, clientTransportB] =
        LoopbackTransport.createPair();
    host.attachPeer('suspended-peer', hostTransportB);
    const clientB = new PeerSessionClient(clientTransportB);
    clientB.start();
    await flushMessages();
    clientTransportB.close('network_lost');

    assert.equal(host.peers.size, 1);
    assert.equal(host.suspendedPeers.size, 1);

    host.close('host_quit');

    assert.equal(host.peers.size, 0);
    assert.equal(host.suspendedPeers.size, 0);
    assert.equal(canceled.length, 1);
    assert.deepEqual(
        simulation.calls.filter(call => call[0] === 'remove'),
        [
            ['remove', 'active-peer', 'host_quit'],
            ['remove', 'suspended-peer', 'host_quit']
        ]
    );
});

test('host heartbeat accepts delayed pong activity and expires silent peers', async () => {
    const simulation = createSimulation();
    const suspended = [];
    simulation.suspendPeer = (...args) => suspended.push(args);
    let now = 0;
    const intervals = [];
    const canceled = [];
    const host = new HostAuthoritySession(simulation, {
        heartbeatIntervalMs: 100,
        peerTimeoutMs: 250,
        now: () => now,
        scheduleInterval: (callback, delay) => {
            intervals.push({ callback, delay });
            return callback;
        },
        cancelInterval: timer => canceled.push(timer)
    });
    const [hostTransport, clientTransport] =
        LoopbackTransport.createPair();
    host.attachPeer('connection-a', hostTransport);
    const client = new PeerSessionClient(clientTransport);
    const activity = [];
    client.onActivity = message => activity.push(message.type);
    client.start();
    await flushMessages();

    assert.equal(intervals[0].delay, 100);
    now = 100;
    intervals[0].callback();
    await flushMessages();
    assert.ok(activity.includes('ping'));
    assert.equal(host.peers.get('connection-a').lastSeenAt, 100);

    clientTransport.send = () => true;
    now = 300;
    intervals[0].callback();
    await flushMessages();
    assert.equal(host.peers.has('connection-a'), true);

    now = 351;
    intervals[0].callback();

    assert.equal(host.peers.size, 0);
    assert.deepEqual(suspended, [['connection-a', 'peer_timeout']]);
    assert.equal(canceled.length, 1);
});

test('dropped and out-of-order snapshots converge on the newest host tick', () => {
    let receive;
    const transport = {
        send: () => true,
        onMessage(listener) {
            receive = listener;
            return () => {};
        },
        close() {}
    };
    const client = new PeerSessionClient(transport);
    const snapshots = [];
    client.onSnapshot = state => snapshots.push(state.value);

    receive(encodePeerMessage('welcome', {
        peerId: 'guest_1',
        tick: 1,
        resumeToken: 'resume'
    }));
    receive(encodePeerMessage('snapshot', {
        tick: 2,
        ack: 1,
        state: { value: 'first' }
    }));
    // Tick three is deliberately dropped. Tick five then overtakes tick four.
    receive(encodePeerMessage('snapshot', {
        tick: 5,
        ack: 3,
        state: { value: 'newest' }
    }));
    receive(encodePeerMessage('snapshot', {
        tick: 4,
        ack: 2,
        state: { value: 'late-stale' }
    }));

    assert.deepEqual(snapshots, ['first', 'newest']);
    assert.equal(client.lastTick, 5);
    assert.equal(client.lastAck, 3);
});
