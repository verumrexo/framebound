import test from 'node:test';
import assert from 'node:assert/strict';
import { LootDropSystem } from './LootDropSystem.js';
import { XPOrb } from '../../shared/entities/XPOrb.js';
import { HPOrb } from '../../shared/entities/HPOrb.js';

function createSystem(options) {
    const audioCalls = [];
    const game = {
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        audio: {
            play: (...args) => audioCalls.push(args)
        }
    };

    return {
        audioCalls,
        game,
        system: new LootDropSystem(game, options)
    };
}

test('large blue crystal asteroids keep their five-to-six xp drop range', () => {
    const { audioCalls, game, system } = createSystem();

    system.spawnAsteroidLoot({
        x: 100,
        y: 200,
        type: 'crystal_blue',
        sizeCategory: 'large'
    });

    assert.ok(game.xpOrbs.length >= 5 && game.xpOrbs.length <= 6);
    assert.ok(game.xpOrbs.every(orb => orb instanceof XPOrb && orb.value === 10));
    assert.deepEqual(audioCalls, [[
        'asteroid_break',
        { volume: 0.5, randomizePitch: 0.2 }
    ]]);
});

test('large green crates keep their fixed three-orb hp drop', () => {
    const { audioCalls, game, system } = createSystem();

    system.spawnCrateLoot({
        x: 100,
        y: 200,
        wTiles: 2,
        hTiles: 2,
        variant: 2
    });

    assert.equal(game.hpOrbs.length, 3);
    assert.ok(game.hpOrbs.every(orb => orb instanceof HPOrb && orb.value === 10));
    assert.deepEqual(audioCalls, [[
        'crate_break',
        { volume: 0.5, randomizePitch: 0.2 }
    ]]);
});

test('loot count and scatter use the injected random source', () => {
    const values = [0.99, 0, 1, 0.25, 0.75, 0.5, 0.5, 1, 0, 0, 1, 0.5, 0.5];
    const { game, system } = createSystem({
        random: () => values.shift()
    });

    system.spawnAsteroidLoot({
        x: 100,
        y: 200,
        type: 'crystal_blue',
        sizeCategory: 'large'
    });

    assert.equal(game.xpOrbs.length, 6);
    assert.equal(game.xpOrbs[0].x, 90);
    assert.equal(game.xpOrbs[0].y, 210);
    assert.equal(values.length, 0);
});
