import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { PeerWorldReplicator } = await import('./PeerWorldReplicator.js');

class RemotePlayerStub {
    constructor(id) {
        this.id = id;
        this.snapshots = [];
    }

    setShipData(parts) {
        this.parts = parts;
    }

    addSnapshot(snapshot) {
        this.snapshots.push(snapshot);
    }
}

class PortalStub {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

function activeWorld() {
    return {
        enemies: [],
        bosses: [],
        projectiles: [],
        drones: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: [],
        shopItems: [],
        treasureChests: [],
        vaultChests: []
    };
}

function roomSnapshot() {
    return {
        gridX: 0,
        gridY: 0,
        visited: true,
        cleared: true,
        locked: false,
        shopUsed: false,
        ambushStarted: false,
        waveCount: 0,
        maxWaves: 0,
        waveWaiting: false,
        asteroids: [],
        lootCrates: [],
        shipwrecks: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: [],
        shopItems: null,
        treasureChests: null,
        vaultChests: null
    };
}

function permanentStats(overrides = {}) {
    return {
        hpMul: 1,
        regenAdd: 0,
        velocityRateAdd: 0,
        laserRateAdd: 0,
        speedMul: 1,
        turnMul: 1,
        missileSpeedMul: 1,
        ...overrides
    };
}

function player(id, overrides = {}) {
    return {
        id,
        x: 100,
        y: 200,
        vx: 3,
        vy: 4,
        rotation: 0.5,
        hp: 90,
        maxHp: 100,
        permanentStats: permanentStats(),
        isDead: false,
        suspended: false,
        parts: [{
            x: 0,
            y: 0,
            partId: 'core',
            rotation: 0
        }],
        ...overrides
    };
}

function fullState(overrides = {}) {
    return {
        self: 'guest_1',
        seed: 42,
        levelSeed: 42,
        floor: 1,
        level: 2,
        score: 10,
        xp: 5,
        gold: 3,
        xpToNext: 100,
        paused: false,
        levelUp: null,
        inventory: {},
        currentRoom: {
            gridX: 0,
            gridY: 0,
            locked: false,
            cleared: true
        },
        players: [
            player('host'),
            player('guest_1', { x: 300, y: 400 })
        ],
        activeWorld: activeWorld(),
        roomSnapshots: [roomSnapshot()],
        portals: [{ x: 500, y: 600 }],
        ...overrides
    };
}

function createHarness({ stagedShip } = {}) {
    const calls = [];
    const room = {
        gridX: 0,
        gridY: 0,
        locked: false,
        cleared: true
    };
    const staged = stagedShip === undefined ? {
        parts: new Map(),
        stats: {},
        permanentStats: {},
        maxHp: 100
    } : stagedShip;
    const game = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotation: 0,
        playerShip: {
            hp: 100,
            maxHp: 100,
            isDead: false,
            permanentStats: permanentStats(),
            recalculateStats: () => calls.push(['recalculate'])
        },
        hangar: {
            inventory: {},
            updateUI: () => calls.push(['inventory-ui'])
        },
        portals: [],
        paused: false,
        levelUpManager: {
            applyRemoteLevelUp: value =>
                calls.push(['level-up', value])
        },
        pauseMenu: {
            applyRemotePaused: value => {
                game.paused = value;
                calls.push(['pause', value]);
            },
            hide: () => calls.push(['hide-pause'])
        },
        session: {
            resetRunState: () => calls.push(['reset']),
            createLocalPlayer: () => calls.push(['create']),
            startGame: (...args) => calls.push(['start', ...args]),
            stageSavedShip: () => staged
        },
        levelGen: {
            getRoom: () => room
        }
    };
    const replicator = new PeerWorldReplicator(game, {
        RemotePlayerClass: RemotePlayerStub,
        PortalClass: PortalStub,
        restoreRooms: (...args) => calls.push(['rooms', ...args]),
        restoreActive: (...args) => calls.push(['active', ...args])
    });
    return { calls, game, replicator, room };
}

test('full resync rebuilds the authoritative run and selects the guest ship', () => {
    const { calls, game, replicator } = createHarness();

    assert.equal(replicator.applyFullState(fullState(), 7), true);
    assert.equal(replicator.selfId, 'guest_1');
    assert.equal(replicator.lastTick, 7);
    assert.equal(game.x, 300);
    assert.equal(game.y, 400);
    assert.equal(game.level, 2);
    assert.equal(game.portals[0] instanceof PortalStub, true);
    assert.equal(replicator.remotePlayers.has('host'), true);
    assert.deepEqual(calls.slice(0, 3), [
        ['reset'],
        ['create'],
        ['start', 42, { enterStartRoom: false, roomCount: 15 }]
    ]);
});

test('incremental snapshots reconcile large drift and reject stale ticks', () => {
    const { game, replicator } = createHarness();
    assert.equal(replicator.applyFullState(fullState(), 7), true);
    const snapshot = fullState({
        roomSnapshots: undefined,
        players: [
            player('host', { x: 150 }),
            player('guest_1', { x: 900, y: 400 })
        ]
    });
    delete snapshot.seed;
    delete snapshot.levelSeed;

    assert.equal(replicator.applySnapshot(snapshot, 8), true);
    assert.equal(game.x, 900);
    const host = replicator.remotePlayers.get('host');
    assert.equal(host.isDead, false);
    assert.equal(host.suspended, false);
    assert.equal(replicator.applySnapshot(snapshot, 6), false);
});

test('remote death state updates immediately for spectator selection', () => {
    const { replicator } = createHarness();
    assert.equal(replicator.applyFullState(fullState(), 7), true);
    const snapshot = fullState({
        roomSnapshots: undefined,
        players: [
            player('host', {
                hp: 0,
                isDead: true,
                suspended: true
            }),
            player('guest_1')
        ]
    });
    for (const key of ['seed', 'levelSeed']) {
        delete snapshot[key];
    }

    assert.equal(replicator.applySnapshot(snapshot, 8), true);
    const host = replicator.remotePlayers.get('host');
    assert.equal(host.isDead, true);
    assert.equal(host.suspended, true);
});

test('malformed host snapshots fail closed before mutating the game', () => {
    const { calls, replicator } = createHarness();
    const invalid = fullState({
        activeWorld: {
            ...activeWorld(),
            projectiles: [{}]
        }
    });

    assert.equal(replicator.applyFullState(invalid, 1), false);
    assert.deepEqual(calls, []);
});

test('invalid authoritative ship builds fail before resetting the local run', () => {
    const { calls, replicator } = createHarness({ stagedShip: null });

    assert.equal(replicator.applyFullState(fullState(), 1), false);
    assert.deepEqual(calls, []);
});

test('guest snapshots apply private upgrades and keep the team choice modal', () => {
    const { calls, game, replicator } = createHarness();
    const choice = {
        rarity: {
            id: 'common',
            name: 'common',
            color: '#aaaaaa'
        },
        name: 'afterburner',
        value: 0.1,
        stat: 'mobility',
        mode: 'add',
        desc: 'increases max speed and turn rate'
    };
    const state = fullState({
        paused: true,
        levelUp: { choices: [choice, choice, choice] },
        players: [
            player('host'),
            player('guest_1', {
                x: 300,
                y: 400,
                permanentStats: permanentStats({
                    speedMul: 1.1,
                    turnMul: 1.1
                })
            })
        ]
    });

    assert.equal(replicator.applyFullState(state, 7), true);
    assert.equal(game.playerShip.permanentStats.speedMul, 1.1);
    assert.ok(calls.some(call => call[0] === 'recalculate'));
    assert.ok(calls.some(call =>
        call[0] === 'level-up' &&
        call[1]?.choices.length === 3
    ));
    assert.ok(calls.some(call => call[0] === 'hide-pause'));
    assert.equal(
        calls.some(call => call[0] === 'pause' && call[1] === true),
        false
    );
});
