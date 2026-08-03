import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LevelUpManager } from './LevelUpManager.js';
import { createPermanentStats } from '../../shared/combat/WeaponFamilies.js';

function createHarness({ peerNetwork = null } = {}) {
    const calls = [];
    const ship = {
        permanentStats: createPermanentStats(),
        hp: 50,
        maxHp: 100,
        getUniqueParts: () => new Set([{ partId: 'gun_basic' }]),
        recalculateStats: () => calls.push(['recalculate'])
    };
    const game = {
        paused: false,
        playerShip: ship,
        peerNetwork,
        audio: {
            play: (...args) => calls.push(['audio', ...args])
        },
        showNotification: (...args) =>
            calls.push(['notification', ...args])
    };
    const manager = new LevelUpManager(game);
    game.levelUpManager = manager;
    return { calls, game, manager, ship };
}

test('offline upgrades retain the original apply, heal, and resume behavior', () => {
    const { game, manager, ship } = createHarness();
    manager.active = true;
    game.paused = true;
    manager.choices = [{
        rarity: { color: '#44ff44' },
        name: 'afterburner',
        stat: 'mobility',
        value: 0.1
    }];

    assert.equal(manager.selectUpgrade(0), true);
    assert.equal(ship.permanentStats.speedMul, 1.1);
    assert.equal(ship.permanentStats.turnMul, 1.1);
    assert.equal(ship.hp, 100);
    assert.equal(manager.active, false);
    assert.equal(game.paused, false);
});

test('a guest requests its own choice and waits for host confirmation', () => {
    const sent = [];
    const { game, manager, ship } = createHarness({
        peerNetwork: {
            isGuest: true,
            sendLevelUpChoice: index => {
                sent.push(index);
                return true;
            }
        }
    });
    manager.active = true;
    game.paused = true;
    manager.choices = [{
        rarity: { color: '#44ff44' },
        name: 'afterburner',
        stat: 'mobility',
        value: 0.1
    }];

    assert.equal(manager.selectUpgrade(0), true);
    assert.deepEqual(sent, [0]);
    assert.equal(manager.selectionPending, true);
    assert.equal(manager.active, true);
    assert.equal(game.paused, true);
    assert.equal(ship.permanentStats.speedMul, 1);

    manager.applyRemoteLevelUp(null);
    assert.equal(manager.active, false);
    assert.equal(game.paused, false);
});

test('host selection waits until every peer has selected', () => {
    const { game, manager } = createHarness({
        peerNetwork: {
            isHost: true,
            completeLocalLevelUp: () => false
        }
    });
    manager.active = true;
    game.paused = true;
    manager.choices = [{
        rarity: { color: '#44ff44' },
        name: 'patch bots',
        stat: 'regen',
        value: 0.5
    }];

    assert.equal(manager.selectUpgrade(0), true);
    assert.equal(manager.active, true);
    assert.equal(manager.selectionPending, true);
    assert.equal(game.paused, true);
});

test('choice pool only evolves weapon families installed on that ship', () => {
    const { manager, ship } = createHarness();
    const available = manager.getAvailableUpgrades(ship);

    assert.ok(available.some(upgrade => upgrade.id === 'hull'));
    assert.ok(available.some(upgrade => upgrade.id === 'velocity_pierce'));
    assert.equal(available.some(upgrade => upgrade.family === 'laser'), false);
    assert.equal(available.some(upgrade => upgrade.family === 'rocket'), false);
});

test('family damage and mechanic upgrades mutate the centralized stats', () => {
    const { manager, ship } = createHarness();

    assert.equal(manager.applyUpgrade({
        stat: 'velocityDamageMul',
        value: 0.22
    }), undefined);
    manager.applyUpgrade({ stat: 'velocityPierce', value: 1 });

    assert.equal(ship.permanentStats.velocityDamageMul, 1.22);
    assert.equal(ship.permanentStats.velocityPierce, 1);
});

test('drone upgrades stay exclusive to ships carrying a drone system', () => {
    const { manager, ship } = createHarness();
    assert.equal(
        manager.getAvailableUpgrades(ship).some(upgrade => upgrade.family === 'drone'),
        false
    );

    ship.getUniqueParts = () => new Set([
        { partId: 'gun_basic' },
        { partId: 'custom_1769974460678' }
    ]);
    const available = manager.getAvailableUpgrades(ship);
    assert.ok(available.some(upgrade => upgrade.id === 'drone_rate'));
    assert.ok(available.some(upgrade => upgrade.id === 'drone_damage'));
    assert.ok(available.some(upgrade => upgrade.id === 'drone_capacity'));
});
