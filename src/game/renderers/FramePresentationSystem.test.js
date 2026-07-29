import test from 'node:test';
import assert from 'node:assert/strict';
import { FramePresentationSystem } from './FramePresentationSystem.js';

function createGame(overrides = {}) {
    const calls = [];
    const ctx = {
        fillStyle: '',
        font: '',
        textAlign: '',
        fillText: (...args) => calls.push(['status', ...args])
    };
    const game = {
        running: true,
        playerShip: {},
        x: 120,
        y: 240,
        renderer: {
            width: 1280,
            height: 720,
            ctx,
            clear: color => calls.push(['clear', color]),
            present: () => calls.push(['present'])
        },
        starfield: {
            draw: (...args) => calls.push(['starfield', ...args])
        },
        worldScene: { draw: () => calls.push(['world']) },
        hud: { draw: () => calls.push(['hud']) },
        ...overrides
    };

    return { game, calls, ctx };
}

test('active presentation preserves clear, starfield, world, present, and hud order', () => {
    const { game, calls } = createGame();

    new FramePresentationSystem(game).draw();

    assert.deepEqual(calls, [
        ['clear', '#000'],
        ['starfield', game.renderer, 120, 240],
        ['world'],
        ['present'],
        ['hud']
    ]);
});

test('inactive presentation keeps the connecting screen at native center', () => {
    const { game, calls, ctx } = createGame({ running: false });

    new FramePresentationSystem(game).draw();

    assert.deepEqual(calls, [
        ['clear', undefined],
        ['status', 'CONNECTING...', 640, 360]
    ]);
    assert.equal(ctx.fillStyle, 'white');
    assert.equal(ctx.font, "20px 'Press Start 2P'");
    assert.equal(ctx.textAlign, 'center');
});

test('missing local player keeps the waiting-for-uplink screen', () => {
    const { game, calls } = createGame({ playerShip: null });

    new FramePresentationSystem(game).draw();

    assert.deepEqual(calls, [
        ['clear', undefined],
        ['status', 'WAITING FOR UPLINK...', 640, 360]
    ]);
});
