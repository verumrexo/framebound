import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerStateGuard } from './PlayerStateGuard.js';

function createHarness(overrides = {}) {
    const warnings = [];
    const game = {
        x: 10,
        y: 20,
        vx: 30,
        vy: 40,
        rotation: 0.5,
        ...overrides
    };
    const guard = new PlayerStateGuard(game, message => warnings.push(message));
    return { game, warnings, guard };
}

test('valid player state passes through untouched', () => {
    const { game, warnings, guard } = createHarness();
    guard.repairNonFiniteState();
    assert.deepEqual(game, { x: 10, y: 20, vx: 30, vy: 40, rotation: 0.5 });
    assert.deepEqual(warnings, []);
});

test('invalid velocity is zeroed without moving a valid player', () => {
    const { game, warnings, guard } = createHarness({ vx: NaN, vy: Infinity });
    guard.repairNonFiniteState();
    assert.deepEqual(game, { x: 10, y: 20, vx: 0, vy: 0, rotation: 0.5 });
    assert.deepEqual(warnings, []);
});

test('invalid position resets the original spawn and clears both velocity axes', () => {
    const { game, warnings, guard } = createHarness({ x: Infinity });
    guard.repairNonFiniteState();
    assert.deepEqual(game, { x: 1000, y: 1000, vx: 0, vy: 0, rotation: 0.5 });
    assert.deepEqual(warnings, ['Position corruption detected! Resetting to spawn.']);
});

test('invalid rotation resets independently and reports the repair', () => {
    const { game, warnings, guard } = createHarness({ rotation: undefined });
    guard.repairNonFiniteState();
    assert.equal(game.rotation, 0);
    assert.deepEqual(warnings, ['Rotation corruption! Resetting.']);
});
