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
            beginWorld: () => calls.push(['beginWorld']),
            clear: color => calls.push(['clear', color]),
            present: () => calls.push(['present']),
            clearHud: () => calls.push(['clearHud'])
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
        ['beginWorld'],
        ['clear', '#000'],
        ['starfield', game.renderer, 120, 240],
        ['world'],
        ['present'],
        ['clearHud'],
        ['hud']
    ]);
});

test('world overlays draw after compositing and before regular hud', () => {
    const { game, calls } = createGame({
        worldOverlays: { draw: () => calls.push(['overlays']) }
    });

    new FramePresentationSystem(game).draw();

    assert.deepEqual(calls.slice(-4), [
        ['present'],
        ['clearHud'],
        ['overlays'],
        ['hud']
    ]);
});

test('inactive presentation keeps the connecting screen at native center', () => {
    const { game, calls, ctx } = createGame({ running: false });

    new FramePresentationSystem(game).draw();

    assert.deepEqual(calls, [
        ['beginWorld'],
        ['clear', undefined],
        ['present'],
        ['clearHud'],
        ['status', 'connecting...', 640, 360]
    ]);
    assert.equal(ctx.fillStyle, 'white');
    assert.equal(ctx.font, '22px "Silkscreen", "Pixelify Sans", monospace');
    assert.equal(ctx.textAlign, 'center');
});

test('missing local player keeps the waiting-for-uplink screen', () => {
    const { game, calls } = createGame({ playerShip: null });

    new FramePresentationSystem(game).draw();

    assert.deepEqual(calls, [
        ['beginWorld'],
        ['clear', undefined],
        ['present'],
        ['clearHud'],
        ['status', 'waiting for uplink...', 640, 360]
    ]);
});

test('presentation updates camera extent from the authoritative renderer viewport', () => {
    const { game } = createGame({
        camera: {
            width: 320,
            height: 180,
            resize(width, height) {
                this.width = width;
                this.height = height;
            }
        }
    });

    new FramePresentationSystem(game).draw();

    assert.deepEqual({ width: game.camera.width, height: game.camera.height }, { width: 1280, height: 720 });
});
