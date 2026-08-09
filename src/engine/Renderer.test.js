import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from './Renderer.js';
import { Viewport } from './rendering/Viewport.js';

test('renderer follows the resized css viewport instead of freezing launch dimensions', () => {
    const originalAddEventListener = window.addEventListener;
    const viewport = { width: 1280, height: 720 };
    let resizeHandler = null;
    const context = {
        scale() {},
        setTransform() {},
        fillRect() {}
    };
    const canvas = {
        style: { width: '1280px', height: '720px' },
        width: 0,
        height: 0,
        get clientWidth() {
            return this.style.width
                ? Number.parseInt(this.style.width, 10)
                : viewport.width;
        },
        get clientHeight() {
            return this.style.height
                ? Number.parseInt(this.style.height, 10)
                : viewport.height;
        },
        getContext: () => context
    };
    window.addEventListener = (type, handler) => {
        if (type === 'resize') resizeHandler = handler;
    };

    try {
        const renderer = new Renderer(canvas);
        assert.equal(renderer.width, 1280);
        assert.equal(renderer.height, 720);
        assert.equal(canvas.style.width, '');
        assert.equal(canvas.style.height, '');

        viewport.width = 1560;
        viewport.height = 940;
        resizeHandler();

        assert.equal(renderer.width, 1560);
        assert.equal(renderer.height, 940);
        assert.equal(canvas.width, 1560);
        assert.equal(canvas.height, 940);
    } finally {
        window.addEventListener = originalAddEventListener;
    }
});

test('renderer keeps fractional world camera motion continuous without mutating simulation state', () => {
    const calls = [];
    const ctx = {
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        setTransform: (...args) => calls.push(['transform', ...args])
    };
    const canvas = {
        style: {},
        dataset: {},
        clientWidth: 853,
        clientHeight: 480
    };
    const viewport = new Viewport(canvas, { getDevicePixelRatio: () => 1.5 });
    const worldSurface = { canvas: {}, ctx, resize() {}, clear() {} };
    const hudSurface = { ctx, resize() {}, clear() {} };
    const compositor = { backend: 'webgl2', resize() {}, present() {} };
    const renderer = new Renderer(canvas, {
        hudCanvas: { style: {} },
        viewport,
        worldSurface,
        hudSurface,
        compositor
    });
    const camera = { x: 123.4, y: 89.8, zoom: 0.6 };

    renderer.withCamera(camera, () => calls.push(['draw-first']));
    renderer.withCamera({ ...camera, x: camera.x + 0.5 }, () => calls.push(['draw-second']));

    assert.deepEqual(calls[0], ['save']);
    assert.equal(calls[1][1], (426 / 853) * 0.6);
    assert.deepEqual(calls[1].slice(2), [
        0,
        0,
        calls[1][1],
        -calls[1][1] * camera.x,
        viewport.worldSourceInsetY - calls[1][1] * camera.y
    ]);
    assert.ok(Math.abs((calls[5][5] - calls[1][5]) + calls[1][1] * 0.5) < 1e-12);
    assert.notEqual(calls[1][5], Math.round(calls[1][5]));
    assert.deepEqual(calls.slice(2, 4), [['draw-first'], ['restore']]);
    assert.deepEqual(calls.slice(4), [['save'], calls[5], ['draw-second'], ['restore']]);
    assert.deepEqual(camera, { x: 123.4, y: 89.8, zoom: 0.6 });
    assert.equal(canvas.dataset.rasterBackend, 'webgl2');
    assert.deepEqual(renderer.projectWorldToHud(400.5, 210.25, camera), viewport.projectWorldToHud(400.5, 210.25, camera));
});
