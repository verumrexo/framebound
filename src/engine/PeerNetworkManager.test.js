import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { PeerNetworkManager } = await import('./PeerNetworkManager.js');

class CoordinatorStub {
    constructor(options) {
        this.options = options;
        this.calls = [];
    }

    host() {
        this.calls.push(['host']);
    }

    join(code) {
        this.calls.push(['join', code]);
        return code === 'ABC123';
    }

    update(dt) {
        this.calls.push(['update', dt]);
    }

    disconnect(reason) {
        this.calls.push(['disconnect', reason]);
    }

    failPeer(peerId, error) {
        this.calls.push(['fail-peer', peerId, error.message]);
    }
}

function createHarness(overrides = {}) {
    const calls = [];
    const legacy = {
        disconnect: () => calls.push(['legacy-disconnect'])
    };
    const game = {
        networkManager: legacy,
        network: legacy,
        levelUpManager: {
            generateChoices: () => ['choices']
        }
    };
    const coordinators = [];
    const signaling = {
        disconnect: () => calls.push(['signal-disconnect'])
    };
    const replicator = {
        remotePlayers: new Map(),
        applyFullState: () => true,
        applySnapshot: () => true
    };
    const simulation = {
        peers: new Map(),
        resurrectDeadPlayers: () => [],
        beginPeerLevelUps: factory => {
            calls.push(['begin-level-up', factory()]);
            return true;
        },
        completeHostLevelUp: () => {
            calls.push(['complete-level-up']);
            return false;
        }
    };
    const authority = {
        flushSnapshots: () => {
            calls.push(['flush-snapshots']);
            return true;
        }
    };
    const manager = new PeerNetworkManager(game, {
        createSignaling: () => signaling,
        createSimulation: () => simulation,
        createAuthority: () => authority,
        createReplicator: () => replicator,
        createCoordinator: options => {
            const coordinator = new CoordinatorStub(options);
            coordinators.push(coordinator);
            return coordinator;
        },
        createClient: () => ({
            connected: true,
            resumeToken: 'resume',
            sendInput: input => calls.push(['input', input]),
            requestAction: (...args) => calls.push(['action', ...args]),
            requestResync: () => calls.push(['resync'])
        }),
        ...overrides
    });
    return {
        calls,
        coordinators,
        game,
        legacy,
        manager,
        authority,
        replicator,
        simulation
    };
}

test('hosting replaces legacy networking and advances host authority', () => {
    const { calls, coordinators, game, manager } = createHarness();
    const ready = [];
    manager.onReady = data => ready.push(data);

    assert.equal(manager.host(), true);
    assert.equal(manager.isHost, true);
    assert.equal(game.network, manager);
    assert.deepEqual(calls, [['legacy-disconnect']]);
    assert.deepEqual(coordinators[0].calls, [['host']]);

    manager.updateHost(0.05);
    assert.deepEqual(coordinators[0].calls.at(-1), ['update', 0.05]);

    assert.equal(manager.flushAuthoritativeState(), true);
    assert.deepEqual(calls.at(-1), ['flush-snapshots']);

    coordinators[0].onConnected({ peerId: 'guest_1' });
    assert.deepEqual(ready, [{
        role: 'host',
        peerId: 'guest_1'
    }]);
});

test('peer liveness selects a spectator target and boss victory resurrects host state', () => {
    const { game, manager, simulation } = createHarness();
    manager.host();
    const dead = { isDead: true, suspended: false };
    const living = { isDead: false, suspended: false, x: 20, y: 30 };
    simulation.peers.set('dead', { ship: dead, suspended: false });
    simulation.peers.set('living', { ship: living, suspended: false });

    assert.equal(manager.spectatorTarget, living);
    assert.equal(manager.canSpectateLocalDeath(), true);

    game.isSpectating = true;
    game.isGameOver = true;
    game.paused = true;
    simulation.resurrectDeadPlayers = () => ['host', 'dead'];

    assert.deepEqual(manager.handleBossDefeated(), ['host', 'dead']);
    assert.equal(game.isSpectating, false);
    assert.equal(game.isGameOver, false);
    assert.equal(game.paused, false);
});

test('guest sends movement and deduplicated fire intent without legacy shot data', () => {
    const { calls, coordinators, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);
    const client = coordinators[0].options.createClient({});
    client.onFullResync({}, { tick: 1 });
    client.connected = true;

    manager.sendInput({ right: true });
    manager.sendFireIntent(true, 0.5);
    manager.sendFireIntent(true, 0.5);
    manager.sendAbility('blink', 1.25);
    manager.sendShoot({
        x: 999,
        y: 999,
        damage: 999,
        partId: 'fake'
    });

    assert.deepEqual(calls.filter(call => call[0] === 'input'), [
        ['input', { right: true }]
    ]);
    assert.deepEqual(calls.filter(call => call[0] === 'action'), [
        ['action', 'shoot', { active: true, aimAngle: 0.5 }],
        ['action', 'ability', { abilityId: 'blink', aimAngle: 1.25 }]
    ]);
});

test('guest authority sync has a bounded timeout that valid resync cancels', () => {
    for (const mode of ['timeout', 'ready']) {
        const scheduled = [];
        const canceled = [];
        const harness = createHarness({
            guestReadyTimeoutMs: 250,
            scheduleTimeout: (callback, delay) => {
                scheduled.push({ callback, delay });
                return callback;
            },
            cancelTimeout: handle => canceled.push(handle)
        });
        const { coordinators, manager } = harness;
        assert.equal(manager.join('ABC123'), true);
        const client = coordinators[0].options.createClient({});

        coordinators[0].onConnected({ peerId: 'host-a' });
        assert.equal(scheduled[0].delay, 250);

        if (mode === 'ready') {
            client.onFullResync({}, { tick: 1 });
            assert.equal(canceled.length, 1);
        }
        scheduled[0].callback();

        assert.deepEqual(
            coordinators[0].calls.filter(call =>
                call[0] === 'fail-peer'
            ),
            mode === 'timeout'
                ? [[
                    'fail-peer',
                    'host-a',
                    'authoritative session timed out'
                ]]
                : []
        );
    }
});

test('guest host-activity watchdog resets safely and retries a silent link', () => {
    const scheduled = [];
    const canceled = [];
    const { coordinators, manager } = createHarness({
        guestReadyTimeoutMs: 250,
        guestLivenessTimeoutMs: 500,
        scheduleTimeout: (callback, delay) => {
            scheduled.push({ callback, delay });
            return callback;
        },
        cancelTimeout: handle => canceled.push(handle)
    });
    assert.equal(manager.join('ABC123'), true);
    const client = coordinators[0].options.createClient({});
    coordinators[0].onConnected({ peerId: 'host-a' });
    client.onFullResync({}, { tick: 1 });

    assert.deepEqual(scheduled.map(entry => entry.delay), [250, 500]);
    client.onActivity({ type: 'ping' });
    assert.deepEqual(scheduled.map(entry => entry.delay), [250, 500, 500]);

    scheduled[1].callback();
    assert.equal(
        coordinators[0].calls.some(call => call[0] === 'fail-peer'),
        false
    );

    scheduled[2].callback();
    assert.deepEqual(coordinators[0].calls.at(-1), [
        'fail-peer',
        'host-a',
        'host stopped responding'
    ]);
    assert.equal(canceled.length, 2);
});

test('guest sends bounded interaction, level-up, and ship-edit requests', () => {
    const { calls, coordinators, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);
    const client = coordinators[0].options.createClient({});
    client.onFullResync({}, { tick: 1 });
    client.connected = true;
    const parts = [{
        x: 0,
        y: 0,
        partId: 'core',
        rotation: 0
    }];

    assert.equal(manager.sendInteraction('shop', 1), 2);
    assert.equal(manager.sendShipEdit(parts), 3);
    assert.equal(manager.sendLevelUpChoice(2), 4);
    assert.deepEqual(calls.filter(call => call[0] === 'action'), [
        ['action', 'interact', {
            targetKind: 'shop',
            targetIndex: 1
        }],
        ['action', 'ship_edit', { parts }],
        ['action', 'level_up', { index: 2 }]
    ]);
});

test('host opens peer choices and holds pause until the crew finishes', () => {
    const { calls, manager } = createHarness();
    manager.host();

    assert.equal(manager.beginSharedLevelUp(), true);
    assert.deepEqual(calls.at(-1), ['begin-level-up', ['choices']]);
    assert.equal(manager.completeLocalLevelUp(), false);
    assert.deepEqual(calls.slice(-2), [
        ['complete-level-up'],
        ['flush-snapshots']
    ]);
});

test('guest cannot flush host-owned authoritative state', () => {
    const { calls, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);

    assert.equal(manager.flushAuthoritativeState(), false);
    assert.equal(
        calls.some(call => call[0] === 'flush-snapshots'),
        false
    );
});

test('guest retries fire intent when transport backpressure rejects it', () => {
    const { coordinators, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);
    const client = coordinators[0].options.createClient({});
    let attempts = 0;
    client.requestAction = () => ++attempts > 1;
    client.onFullResync({}, { tick: 1 });
    client.connected = true;

    assert.equal(manager.sendFireIntent(true, 0.5), false);
    assert.equal(manager.sendFireIntent(true, 0.5), true);
    assert.equal(manager.sendFireIntent(true, 0.5), false);
    assert.equal(attempts, 2);
});

test('guest retries ordered interaction and ship edits after backpressure', () => {
    const { coordinators, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);
    const client = coordinators[0].options.createClient({});
    const delivered = [];
    let blocked = true;
    client.requestAction = (...args) => {
        if (blocked) return false;
        delivered.push(args);
        return true;
    };
    client.onFullResync({}, { tick: 1 });
    client.connected = true;
    const parts = [{
        x: 0,
        y: 0,
        partId: 'core',
        rotation: 0
    }];

    assert.equal(manager.sendInteraction('treasure', 0), true);
    assert.equal(manager.sendShipEdit(parts), true);
    assert.equal(manager.pendingActions.length, 2);

    blocked = false;
    manager.updateGuest(0.05);

    assert.deepEqual(delivered, [
        ['interact', {
            targetKind: 'treasure',
            targetIndex: 0
        }],
        ['ship_edit', { parts }]
    ]);
    assert.equal(manager.pendingActions.length, 0);
});

test('invalid join restores the legacy network facade', () => {
    const { calls, game, legacy, manager } = createHarness();

    assert.equal(manager.join('BAD'), false);
    assert.equal(manager.role, null);
    assert.equal(game.network, legacy);
    assert.equal(
        calls.filter(call => call[0] === 'signal-disconnect').length,
        1
    );
});

test('synchronous host and join failures restore the legacy facade', () => {
    for (const mode of ['host', 'join']) {
        const { calls, coordinators, game, legacy, manager } = createHarness();
        const statuses = [];
        manager.onStatus = (...args) => statuses.push(args);
        manager.createCoordinator = options => {
            const coordinator = new CoordinatorStub(options);
            coordinator[mode] = () => {
                throw new Error(`${mode} exploded`);
            };
            coordinators.push(coordinator);
            return coordinator;
        };

        const started = mode === 'host'
            ? manager.host()
            : manager.join('ABC123');

        assert.equal(started, false);
        assert.equal(manager.role, null);
        assert.equal(manager.coordinator, null);
        assert.equal(game.network, legacy);
        assert.deepEqual(statuses, [[
            'error',
            `${mode} exploded`
        ]]);
        assert.equal(
            calls.filter(call => call[0] === 'signal-disconnect').length,
            1
        );
    }
});

test('disconnect releases local state when transport cleanup throws', () => {
    const { game, legacy, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);
    manager.coordinator.disconnect = () => {
        throw new Error('coordinator cleanup failed');
    };
    manager.signaling.disconnect = () => {
        throw new Error('signaling cleanup failed');
    };

    assert.doesNotThrow(() => manager.disconnect());
    assert.equal(manager.role, null);
    assert.equal(manager.coordinator, null);
    assert.equal(manager.signaling, null);
    assert.equal(game.network, legacy);
});

test('terminal coordinator failures restore the legacy network facade', () => {
    const { calls, coordinators, game, legacy, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);

    coordinators[0].onClosed({
        role: 'guest',
        reason: 'join_timeout'
    });

    assert.equal(manager.role, null);
    assert.equal(manager.coordinator, null);
    assert.equal(game.network, legacy);
    assert.equal(
        calls.filter(call => call[0] === 'signal-disconnect').length,
        1
    );
});

test('pre-code host failure releases the provisional paused run', () => {
    const { coordinators, game, legacy, manager } = createHarness();
    Object.assign(game, {
        running: true,
        paused: true,
        isSpectating: true
    });
    assert.equal(manager.host(), true);

    coordinators[0].onClosed({
        role: 'host',
        reason: 'signaling_error'
    });

    assert.equal(game.running, false);
    assert.equal(game.paused, false);
    assert.equal(game.isSpectating, false);
    assert.equal(game.network, legacy);
    assert.equal(manager.role, null);
});

test('coordinator close survives signaling teardown failure', () => {
    const { coordinators, game, legacy, manager } = createHarness();
    Object.assign(game, {
        running: true,
        paused: true,
        isSpectating: true,
        pauseMenu: { hide() {} },
        loop: { stop() {} },
        audio: { stopMusic() {} },
        mainMenu: { show() {} }
    });
    assert.equal(manager.join('ABC123'), true);
    manager.signaling.disconnect = () => {
        throw new Error('signaling teardown failed');
    };

    assert.doesNotThrow(() => coordinators[0].onClosed({
        role: 'guest',
        reason: 'host_left'
    }));
    assert.equal(game.running, false);
    assert.equal(game.paused, false);
    assert.equal(game.network, legacy);
    assert.equal(manager.role, null);
});

test('host departure ends an active guest run without saving it', () => {
    const { calls, coordinators, game, manager } = createHarness();
    Object.assign(game, {
        running: true,
        paused: true,
        isSpectating: true,
        pauseMenu: { hide: () => calls.push(['hide-pause']) },
        loop: { stop: () => calls.push(['stop-loop']) },
        audio: { stopMusic: () => calls.push(['stop-music']) },
        mainMenu: { show: () => calls.push(['show-menu']) }
    });
    const statuses = [];
    manager.onStatus = status => statuses.push(status);
    assert.equal(manager.join('ABC123'), true);

    coordinators[0].onClosed({
        role: 'guest',
        reason: 'host_left'
    });

    assert.equal(game.running, false);
    assert.equal(game.paused, false);
    assert.equal(game.isSpectating, false);
    assert.ok(calls.some(call => call[0] === 'show-menu'));
    assert.deepEqual(statuses, ['host_left']);
});

test('explicit disconnect closes signaling and restores legacy networking', () => {
    const { calls, game, legacy, manager } = createHarness();
    assert.equal(manager.join('ABC123'), true);

    manager.disconnect();

    assert.equal(manager.role, null);
    assert.equal(manager.coordinator, null);
    assert.equal(game.network, legacy);
    assert.equal(
        calls.filter(call => call[0] === 'signal-disconnect').length,
        1
    );
});
