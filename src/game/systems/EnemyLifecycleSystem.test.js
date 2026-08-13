import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { EnemyLifecycleSystem } = await import('./EnemyLifecycleSystem.js');

class OrbStub {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
    }
}

class PortalStub {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

function createHarness({
    connected = false,
    freezeEnemies = false,
    random = () => 0.5,
    score = 100,
    enemies = [],
    bosses = [],
    resurrected = [],
    playerDead = false
} = {}) {
    const calls = [];
    const game = {
        x: 10,
        y: 20,
        playerShip: { isDead: playerDead },
        score,
        enemies,
        bosses,
        projectiles: [{}],
        asteroids: [{}],
        lootCrates: [{}],
        currentRoom: {},
        xpOrbs: [],
        goldOrbs: [],
        portals: [],
        peerNetwork: {
            handleBossDefeated: () => {
                calls.push(['boss-defeated']);
                return resurrected;
            }
        },
        networkManager: { isConnected: connected },
        devTools: { freezeEnemies },
        spawnExplosion: (...args) => {
            calls.push(['explosion', ...args]);
        },
        showNotification: (...args) => {
            calls.push(['notification', ...args]);
        },
        audio: {
            play: (...args) => calls.push(['audio', ...args])
        }
    };

    return {
        calls,
        game,
        system: new EnemyLifecycleSystem(game, {
            random,
            GoldOrbClass: OrbStub,
            PortalClass: PortalStub,
            XPOrbClass: OrbStub
        })
    };
}

test('offline enemy updates keep the full active argument contract', () => {
    const calls = [];
    const enemy = {
        isDead: false,
        update: (...args) => calls.push(args)
    };
    const { game, system } = createHarness({
        enemies: [enemy]
    });

    system.updateEnemies(0.25);

    assert.deepEqual(calls, [[
        0.25,
        10,
        20,
        game.projectiles,
        game.asteroids,
        game.lootCrates,
        game.enemies,
        game.currentRoom,
        { id: 'host', ship: game.playerShip, x: 10, y: 20 }
    ]]);
});

test('connected enemies interpolate while frozen enemies do neither', () => {
    const connectedCalls = [];
    const connectedEnemy = {
        isDead: false,
        update: () => connectedCalls.push('update'),
        interpolate: (...args) => connectedCalls.push(['interpolate', ...args])
    };
    const connectedHarness = createHarness({
        connected: true,
        enemies: [connectedEnemy]
    });

    connectedHarness.system.updateEnemies(0.1);

    assert.deepEqual(connectedCalls, [['interpolate', 0.1, 10, 20]]);

    const frozenCalls = [];
    const frozenEnemy = {
        isDead: false,
        update: () => frozenCalls.push('update'),
        interpolate: () => frozenCalls.push('interpolate')
    };
    const frozenHarness = createHarness({
        connected: true,
        freezeEnemies: true,
        enemies: [frozenEnemy]
    });

    frozenHarness.system.updateEnemies(0.1);

    assert.deepEqual(frozenCalls, []);
});

test('targetless team-wipe frames do not run enemy or boss ai', () => {
    const calls = [];
    const enemy = {
        x: 100,
        y: 200,
        isDead: false,
        update: () => calls.push('enemy')
    };
    const boss = {
        x: 300,
        y: 400,
        isDead: false,
        update: () => calls.push('boss')
    };
    const { system } = createHarness({
        enemies: [enemy],
        bosses: [boss],
        playerDead: true
    });

    system.updateEnemies(0.1);
    system.updateBosses(0.1);

    assert.deepEqual(calls, []);
    assert.deepEqual([enemy.x, enemy.y, boss.x, boss.y], [
        100, 200, 300, 400
    ]);
});

test('enemy separation preserves the original split penetration', () => {
    const first = {
        x: 100,
        y: 100,
        radius: 20,
        isDead: false
    };
    const second = {
        x: 120,
        y: 100,
        radius: 20,
        isDead: false
    };
    const { system } = createHarness({
        enemies: [first, second]
    });

    system.separateEnemies();

    assert.equal(first.x, 90);
    assert.equal(second.x, 130);
    assert.equal(first.y, 100);
    assert.equal(second.y, 100);
});

test('boss death preserves portal, ten drops, audio, and score doubling', () => {
    const boss = {
        x: 400,
        y: 500,
        isDead: true,
        update() {}
    };
    const { calls, game, system } = createHarness({
        bosses: [boss],
        score: 75
    });

    system.update(0.1);

    assert.deepEqual(game.bosses, []);
    assert.deepEqual(game.portals, [new PortalStub(400, 500)]);
    assert.equal(game.xpOrbs.length, 10);
    assert.ok(game.xpOrbs.every(orb =>
        orb.x === 400 && orb.y === 500 && orb.value === 50
    ));
    assert.equal(game.score, 150);
    assert.deepEqual(calls, [
        ['explosion', 400, 500, 200, 1],
        ['audio', 'explosion', { volume: 0.8, pitch: 0.5 }],
        ['audio', 'enemy_death1', { volume: 0.8, pitch: 0.5 }],
        ['notification', 'portal opened', '#aa00ff'],
        ['boss-defeated'],
        ['notification', 'SCORE DOUBLED! 150', '#ffff00']
    ]);
});

test('boss death restores dead multiplayer ships immediately', () => {
    const boss = {
        x: 400,
        y: 500,
        isDead: true,
        update() {}
    };
    const { calls, system } = createHarness({
        bosses: [boss],
        resurrected: ['host', 'guest_1']
    });

    system.update(0.1);

    assert.deepEqual(
        calls.filter(([type]) =>
            type === 'boss-defeated' ||
            type === 'notification'
        ),
        [
            ['notification', 'portal opened', '#aa00ff'],
            ['boss-defeated'],
            ['notification', '2 systems restored', '#00ffff'],
            ['notification', 'SCORE DOUBLED! 200', '#ffff00']
        ]
    );
});

test('enemy death uses its authored reward profile', () => {
    const striker = {
        x: 50,
        y: 60,
        type: 'striker',
        rewards: { drops: 3, xp: 30, gold: 1, score: 50 },
        isDead: true,
        update() {}
    };
    const { calls, game, system } = createHarness({
        enemies: [striker],
        random: () => 0.6,
        score: 10
    });

    system.update(0.1);

    assert.deepEqual(game.enemies, []);
    assert.equal(game.xpOrbs.length, 3);
    assert.ok(game.xpOrbs.every(orb =>
        orb.x === 52 && orb.y === 62 && orb.value === 10
    ));
    assert.deepEqual(game.goldOrbs, [new OrbStub(50, 60, 1)]);
    assert.equal(game.score, 60);
    assert.deepEqual(calls, [[
        'audio',
        'enemy_death1',
        { volume: 0.5, randomizePitch: 0.2 }
    ]]);
});

test('boss score doubles before same-frame enemy points are awarded', () => {
    const boss = {
        x: 0,
        y: 0,
        isDead: true,
        update() {}
    };
    const enemy = {
        x: 0,
        y: 0,
        type: 'basic',
        isDead: true,
        update() {}
    };
    const { game, system } = createHarness({
        bosses: [boss],
        enemies: [enemy],
        score: 100
    });

    system.update(0.1);

    assert.equal(game.score, 210);
});

test('host enemies target the nearest living player', () => {
    const updates = [];
    const enemy = {
        x: 100,
        y: 100,
        type: 'basic',
        isDead: false,
        update: (...args) => updates.push(args)
    };
    const { game, system } = createHarness({ enemies: [enemy] });
    game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => [
                { id: 'host', x: 0, y: 0 },
                { id: 'guest_1', x: 120, y: 110 }
            ]
        },
        handleBossDefeated: () => []
    };

    system.updateEnemies(0.1);

    assert.equal(updates[0][1], 120);
    assert.equal(updates[0][2], 110);
});

test('orbiting profiles lock their target inside orbit range until it dies', () => {
    const circler = {
        x: 0,
        y: 0,
        behaviorProfile: { movementStyle: 'orbit' },
        engagementDist: 300
    };
    const { game, system } = createHarness();
    let players = [
        { id: 'host', x: 400, y: 0 },
        { id: 'guest_1', x: 200, y: 0 }
    ];
    game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => players
        }
    };

    assert.equal(system.targetFor(circler).id, 'guest_1');
    assert.equal(circler.coopTargetId, 'guest_1');
    players = [
        { id: 'host', x: 10, y: 0 },
        { id: 'guest_1', x: 300, y: 0 }
    ];
    assert.equal(system.targetFor(circler).id, 'guest_1');
    players = [{ id: 'host', x: 10, y: 0 }];
    assert.equal(system.targetFor(circler).id, 'host');
});

test('stealth hides players while a viable nearby decoy remains targetable', () => {
    const enemy = {
        x: 0,
        y: 0,
        isDead: false,
        update() {}
    };
    const { game, system } = createHarness({ enemies: [enemy] });
    game.playerShip.stealthTimer = 3;
    game.decoys = [{
        id: 'decoy_1',
        x: 40,
        y: 0,
        life: 5,
        isDead: false
    }];

    assert.equal(system.targetFor(enemy).id, 'decoy_1');
});

test('hacked enemies target the nearest live enemy or boss, never players or decoys', () => {
    const hacked = {
        id: 'hacked',
        x: 0,
        y: 0,
        isDead: false,
        hackTimer: 4,
        hackedByPlayerId: 'host',
        update() {}
    };
    const hostile = {
        id: 'hostile',
        x: 30,
        y: 0,
        isDead: false,
        hackTimer: 0,
        update() {}
    };
    const farther = {
        id: 'farther',
        x: 200,
        y: 0,
        isDead: false,
        hackTimer: 0,
        update() {}
    };
    const hackedAlly = {
        id: 'hacked_ally',
        x: 5,
        y: 0,
        isDead: false,
        hackTimer: 4,
        hackedByPlayerId: 'host',
        update() {}
    };
    const boss = {
        id: 'boss',
        x: 60,
        y: 0,
        isDead: false,
        update() {}
    };
    const { game, system } = createHarness({
        enemies: [hacked, hostile, farther, hackedAlly],
        bosses: [boss]
    });
    game.playerShip.stealthTimer = 0;
    game.decoys = [{ id: 'decoy', x: 1, y: 0, life: 5, isDead: false }];

    assert.equal(system.targetFor(hacked), hostile);
});
