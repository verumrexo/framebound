import test from 'node:test';
import assert from 'node:assert/strict';
import { FullscreenMapInputSystem } from './FullscreenMapInputSystem.js';

function createHarness({
    open = true,
    room = null,
    currentRoom = null,
    useClickedRoom = true
} = {}) {
    const calls = [];
    const fullscreenMap = {
        getHoveredRoom: (...args) => {
            calls.push(['hovered', ...args]);
            return room;
        }
    };
    if (useClickedRoom) {
        fullscreenMap.getClickedRoom = (...args) => {
            calls.push(['clicked', ...args]);
            return room;
        };
    }

    const game = {
        fullscreenMapOpen: open,
        fullscreenMap,
        currentRoom,
        mouseDownLastFrame: false,
        input: {
            clearPressed: () => calls.push(['clear'])
        },
        teleportToRoom: target => calls.push(['teleport', target])
    };

    return {
        calls,
        game,
        system: new FullscreenMapInputSystem(game)
    };
}

test('closed fullscreen map does not consume the gameplay frame', () => {
    const { calls, system } = createHarness({ open: false });

    assert.equal(system.update({
        isMouseDown: true,
        mouse: { x: 4, y: 5 },
        mouseClicked: true
    }), false);
    assert.deepEqual(calls, []);
});

test('visited non-current map room teleports and closes the map', () => {
    const room = { id: 'target', visited: true };
    const { calls, game, system } = createHarness({
        room,
        currentRoom: { id: 'current' }
    });

    assert.equal(system.update({
        isMouseDown: true,
        mouse: { x: 40, y: 50 },
        mouseClicked: true
    }), true);

    assert.equal(game.fullscreenMapOpen, false);
    assert.equal(game.mouseDownLastFrame, true);
    assert.deepEqual(calls, [
        ['clicked', 40, 50],
        ['teleport', room],
        ['clear']
    ]);
});

test('map fallback and current or unvisited rooms preserve the open map', () => {
    const currentRoom = { id: 'current', visited: true };
    const currentHarness = createHarness({
        room: currentRoom,
        currentRoom,
        useClickedRoom: false
    });

    assert.equal(currentHarness.system.update({
        isMouseDown: false,
        mouse: { x: 1, y: 2 },
        mouseClicked: true
    }), true);
    assert.equal(currentHarness.game.fullscreenMapOpen, true);
    assert.deepEqual(currentHarness.calls, [
        ['hovered', 1, 2],
        ['clear']
    ]);

    const unvisitedHarness = createHarness({
        room: { id: 'hidden', visited: false },
        currentRoom
    });
    unvisitedHarness.system.update({
        isMouseDown: true,
        mouse: { x: 3, y: 4 },
        mouseClicked: true
    });
    assert.equal(unvisitedHarness.game.fullscreenMapOpen, true);
    assert.ok(!unvisitedHarness.calls.some(call => call[0] === 'teleport'));
});
