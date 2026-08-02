import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerRecoverySystem } from './PlayerRecoverySystem.js';

function makeGame(overrides = {}) {
    return {
        playerShip: {
            hp: 50,
            maxHp: 100,
            isDead: false,
            stats: { regen: 4 }
        },
        enemies: [],
        bosses: [],
        ...overrides
    };
}

test('regeneration remains combat-only', () => {
    const game = makeGame();
    new PlayerRecoverySystem(game).update(2, 3);
    assert.equal(game.playerShip.hp, 50);
});

test('a normal enemy enables the original level-scaled regeneration', () => {
    const game = makeGame({ enemies: [{}] });
    new PlayerRecoverySystem(game).update(2, 3);
    assert.equal(game.playerShip.hp, 74);
});

test('only a living boss counts as active combat and healing clamps to max hp', () => {
    const deadBossGame = makeGame({ bosses: [{ isDead: true }] });
    new PlayerRecoverySystem(deadBossGame).update(10, 10);
    assert.equal(deadBossGame.playerShip.hp, 50);

    const liveBossGame = makeGame({ bosses: [{ isDead: false }] });
    new PlayerRecoverySystem(liveBossGame).update(10, 10);
    assert.equal(liveBossGame.playerShip.hp, 100);
});

test('dead players never regenerate', () => {
    const game = makeGame({ enemies: [{}] });
    game.playerShip.isDead = true;
    new PlayerRecoverySystem(game).update(10, 10);
    assert.equal(game.playerShip.hp, 50);
});
