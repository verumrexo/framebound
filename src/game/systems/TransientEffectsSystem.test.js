import test from 'node:test';
import assert from 'node:assert/strict';
import { TransientEffectsSystem } from './TransientEffectsSystem.js';

function createSystem(overrides = {}) {
    const game = {
        notifications: [],
        damageNumbers: [],
        explosions: [],
        showDamageNumbers: true,
        damageNumberMode: 'singular',
        ...overrides
    };

    return { game, system: new TransientEffectsSystem(game) };
}

test('transient effects normalize notifications without changing their timing', () => {
    const { game, system } = createSystem();

    system.showNotification('SYSTEM READY', '#44ff44');

    assert.deepEqual(game.notifications, [{
        text: 'system ready',
        color: '#44ff44',
        life: 3,
        maxLife: 3
    }]);
});

test('additive damage numbers merge nearby hits', () => {
    const { game, system } = createSystem({ damageNumberMode: 'additive' });
    game.damageNumbers.push({
        x: 10,
        y: 20,
        amount: 5,
        isPlayer: false,
        life: 1,
        maxLife: 1.2,
        scale: 1
    });

    system.spawnDamageNumber(20, 30, 7);

    assert.equal(game.damageNumbers.length, 1);
    assert.deepEqual(game.damageNumbers[0], {
        x: 15,
        y: 25,
        amount: 12,
        isPlayer: false,
        life: 1.2,
        maxLife: 1.2,
        scale: 1.6
    });
});

test('transient effects expire without skipping adjacent entries', () => {
    const { game, system } = createSystem();
    game.explosions.push(
        { life: 0.1 },
        { life: 0.2 },
        { life: 1 }
    );
    game.notifications.push(
        { life: 0.1 },
        { life: 0.2 },
        { life: 1 }
    );

    system.updateExplosions(0.25);
    system.updateNotifications(0.25);

    assert.deepEqual(game.explosions, [{ life: 0.75 }]);
    assert.deepEqual(game.notifications, [{ life: 0.75 }]);
});

test('damage numbers preserve weapon attribution and do not merge families', () => {
    const recorded = [];
    const { game, system } = createSystem({
        damageNumberMode: 'additive',
        combatTelemetry: {
            record: (...args) => recorded.push(args)
        }
    });
    system.spawnDamageNumber(20, 30, 7, false, {
        family: 'velocity',
        partKey: 'dart@-1,0'
    });
    system.spawnDamageNumber(20, 30, 8, false, {
        family: 'laser',
        partKey: 'lps@1,0'
    });

    assert.equal(game.damageNumbers.length, 2);
    assert.deepEqual(recorded.map(call => call[0]), [7, 8]);
    assert.equal(game.damageNumbers[0].source.family, 'velocity');
    assert.equal(game.damageNumbers[1].source.family, 'laser');
});
