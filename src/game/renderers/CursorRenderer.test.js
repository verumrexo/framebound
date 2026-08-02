import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCustomCursor } from './CursorRenderer.js';

function createGame(overrides = {}) {
    const calls = [];
    const ctx = {
        save: () => calls.push(['save']),
        translate: (x, y) => calls.push(['translate', x, y]),
        beginPath: () => calls.push(['beginPath']),
        moveTo: (x, y) => calls.push(['moveTo', x, y]),
        lineTo: (x, y) => calls.push(['lineTo', x, y]),
        stroke: () => calls.push(['stroke']),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        arc: (...args) => calls.push(['arc', ...args]),
        restore: () => calls.push(['restore'])
    };

    return {
        calls,
        game: {
            hangar: { active: false },
            shipBuilder: { active: false },
            paused: false,
            renderer: {
                canvas: { style: {} },
                ctx
            },
            input: {
                getMousePos: () => ({ x: 100, y: 200 })
            },
            cursorSettings: {
                shape: '4-lines',
                thickness: 2,
                length: 15,
                gap: 3,
                color: '#00ffff',
                outline: true
            },
            ...overrides
        }
    };
}

test('drawCustomCursor preserves the default cursor while a modal is active', () => {
    const { game, calls } = createGame({ paused: true });

    drawCustomCursor(game);

    assert.equal(game.renderer.canvas.style.cursor, 'default');
    assert.deepEqual(calls, []);
});

test('drawCustomCursor renders the outlined four-line cursor at the mouse position', () => {
    const { game, calls } = createGame();

    drawCustomCursor(game);

    assert.equal(game.renderer.canvas.style.cursor, 'none');
    assert.deepEqual(calls[0], ['save']);
    assert.deepEqual(calls[1], ['translate', 100, 200]);
    assert.equal(calls.filter(([name]) => name === 'stroke').length, 8);
    assert.deepEqual(calls.at(-1), ['restore']);
});
