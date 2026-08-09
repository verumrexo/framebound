import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceOrbSystem } from './ResourceOrbSystem.js';

function createOrb(name, {
    collected = true,
    value = 1
} = {}) {
    const updates = [];
    return {
        name,
        value,
        forced: false,
        updates,
        update: (...args) => {
            updates.push(args);
            return collected;
        }
    };
}

function createHarness({
    roomCleared = false,
    xp = 0,
    xpToNext = 100,
    level = 1,
    gold = 0,
    hp = 100,
    maxHp = 100,
    xpOrbs = [],
    goldOrbs = [],
    hpOrbs = []
} = {}) {
    const calls = [];
    const game = {
        x: 20,
        y: 30,
        currentRoom: { cleared: roomCleared },
        xp,
        xpToNext,
        level,
        gold,
        playerShip: { hp, maxHp, stats: { pickupRadiusMul: 1 } },
        xpOrbs,
        goldOrbs,
        hpOrbs,
        audio: {
            play: (...args) => calls.push(['audio', ...args])
        },
        showNotification: (...args) => {
            calls.push(['notification', ...args]);
        },
        levelUpManager: {
            triggerLevelUp: () => calls.push(['level-up'])
        }
    };

    return {
        calls,
        game,
        system: new ResourceOrbSystem(game)
    };
}

test('cleared rooms force every resource orb toward the player', () => {
    const xpOrb = createOrb('xp', { collected: false });
    const goldOrb = createOrb('gold', { collected: false });
    const hpOrb = createOrb('hp', { collected: false });
    const { system } = createHarness({
        roomCleared: true,
        xpOrbs: [xpOrb],
        goldOrbs: [goldOrb],
        hpOrbs: [hpOrb]
    });

    system.update(0.25);

    for (const orb of [xpOrb, goldOrb, hpOrb]) {
        assert.equal(orb.forced, true);
        assert.deepEqual(orb.updates, [[0.25, 20, 30, 1]]);
    }
});

test('xp collection keeps its original level-up math and feedback order', () => {
    const orb = createOrb('xp', { value: 20 });
    const { calls, game, system } = createHarness({
        xp: 90,
        xpToNext: 100,
        xpOrbs: [orb]
    });

    system.update(0.1);

    assert.equal(game.xp, 10);
    assert.equal(game.level, 2);
    assert.equal(game.xpToNext, 170);
    assert.deepEqual(game.xpOrbs, []);
    assert.deepEqual(calls, [
        ['audio', 'xp_pickup', { volume: 0.3, randomizePitch: 0.2 }],
        ['notification', 'CORE UPGRADED: LEVEL 2', '#00ffff'],
        ['notification', 'SYSTEM EFFICIENCY +1%', '#44ff44'],
        ['level-up']
    ]);
});

test('gold collection iterates backward without skipping adjacent orbs', () => {
    const first = createOrb('first', { value: 2 });
    const second = createOrb('second', { value: 3 });
    const { calls, game, system } = createHarness({
        gold: 5,
        goldOrbs: [first, second]
    });

    system.update(0.1);

    assert.equal(game.gold, 10);
    assert.deepEqual(game.goldOrbs, []);
    assert.equal(calls.length, 2);
    assert.deepEqual(second.updates, [[0.1, 20, 30, 1]]);
    assert.deepEqual(first.updates, [[0.1, 20, 30, 1]]);
});

test('hp collection keeps the five-percent missing-health formula', () => {
    const orb = createOrb('hp', { value: 99 });
    const { calls, game, system } = createHarness({
        hp: 50,
        maxHp: 100,
        hpOrbs: [orb]
    });

    system.update(0.1);

    assert.equal(game.playerShip.hp, 53);
    assert.deepEqual(game.hpOrbs, []);
    assert.deepEqual(calls, [
        ['notification', '+3 hp', '#44ff44'],
        ['audio', 'gold_pickup', {
            volume: 0.5,
            pitch: 1.2,
            randomizePitch: 0.15
        }]
    ]);
});

test('shared gold flies to the nearest guest but credits one team wallet', () => {
    const orb = createOrb('gold', { value: 4 });
    orb.x = 300;
    orb.y = 300;
    const { game, system } = createHarness({
        gold: 5,
        goldOrbs: [orb]
    });
    game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => [
                { id: 'host', x: 20, y: 30 },
                { id: 'guest_1', x: 310, y: 305 }
            ]
        }
    };

    system.update(0.1);

    assert.deepEqual(orb.updates, [[0.1, 310, 305, 1]]);
    assert.equal(game.gold, 9);
});

test('hp orbs heal the living player who actually collects them', () => {
    const orb = createOrb('hp');
    orb.x = 300;
    orb.y = 300;
    const { calls, game, system } = createHarness({
        hp: 10,
        maxHp: 100,
        hpOrbs: [orb]
    });
    const guestShip = {
        hp: 40,
        maxHp: 200
    };
    game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => [
                {
                    id: 'host',
                    ship: game.playerShip,
                    x: 20,
                    y: 30
                },
                {
                    id: 'guest_1',
                    ship: guestShip,
                    x: 305,
                    y: 305
                }
            ]
        }
    };

    system.update(0.1);

    assert.deepEqual(orb.updates, [[0.1, 305, 305, 1]]);
    assert.equal(guestShip.hp, 48);
    assert.equal(game.playerShip.hp, 10);
    assert.equal(
        calls.some(call => call[0] === 'notification'),
        false
    );
});

test('resource orbs pass the selected player magnet multiplier', () => {
    const orb = createOrb('gold', { collected: false });
    const { game, system } = createHarness({ goldOrbs: [orb] });
    game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => [{
                id: 'guest_1',
                x: 40,
                y: 50,
                ship: { stats: { pickupRadiusMul: 2 } }
            }]
        }
    };

    system.update(0.1);

    assert.deepEqual(orb.updates, [[0.1, 40, 50, 2]]);
});
