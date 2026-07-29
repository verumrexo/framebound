import test from 'node:test';
import assert from 'node:assert/strict';
import { GameplayOverlaySystem } from './GameplayOverlaySystem.js';

function createHarness({
    hangar = false,
    builder = false,
    levelUp = false,
    paused = false
} = {}) {
    const calls = [];
    const game = {
        mouseDownLastFrame: false,
        hangar: {
            active: hangar,
            update: dt => calls.push(['hangar', dt])
        },
        shipBuilder: {
            active: builder,
            update: dt => calls.push(['builder', dt])
        },
        levelUpManager: {
            active: levelUp,
            update: () => calls.push(['level-up'])
        },
        pauseMenu: {
            update: isMouseDown => {
                calls.push(['pause', isMouseDown]);
                return paused;
            }
        },
        input: {
            clearPressed: () => calls.push(['clear'])
        }
    };

    return {
        calls,
        game,
        system: new GameplayOverlaySystem(game)
    };
}

test('blocking overlays keep the original hangar, builder, and level-up priority', () => {
    const { calls, game, system } = createHarness({
        hangar: true,
        builder: true,
        levelUp: true,
        paused: true
    });

    assert.equal(system.update(0.25, true), true);
    assert.equal(game.mouseDownLastFrame, true);
    assert.deepEqual(calls, [
        ['hangar', 0.25],
        ['clear']
    ]);
});

test('builder and level-up modes use their original update signatures', () => {
    const builderHarness = createHarness({ builder: true });
    assert.equal(builderHarness.system.update(0.5, false), true);
    assert.deepEqual(builderHarness.calls, [
        ['builder', 0.5],
        ['clear']
    ]);

    const levelHarness = createHarness({ levelUp: true });
    assert.equal(levelHarness.system.update(0.75, true), true);
    assert.deepEqual(levelHarness.calls, [
        ['level-up'],
        ['clear']
    ]);
});

test('pause remains the last gate and owns its own input cleanup behavior', () => {
    const pausedHarness = createHarness({ paused: true });
    assert.equal(pausedHarness.system.update(0.1, true), true);
    assert.deepEqual(pausedHarness.calls, [['pause', true]]);

    const activeHarness = createHarness();
    assert.equal(activeHarness.system.update(0.1, false), false);
    assert.deepEqual(activeHarness.calls, [['pause', false]]);
});
