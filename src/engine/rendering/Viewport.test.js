import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewport } from './Viewport.js';

test('viewport keeps game coordinates logical while buffers follow DPR', () => {
    const canvas = {
        clientWidth: 853,
        clientHeight: 480,
        getBoundingClientRect: () => ({ left: 12, top: 8, width: 853, height: 480 })
    };
    const viewport = new Viewport(canvas, { getDevicePixelRatio: () => 1.5 }).resize();

    assert.deepEqual({
        width: viewport.width,
        height: viewport.height,
        physicalWidth: viewport.physicalWidth,
        physicalHeight: viewport.physicalHeight
    }, {
        width: 853,
        height: 480,
        physicalWidth: 1280,
        physicalHeight: 720
    });
    assert.deepEqual(viewport.getRasterMetrics(), {
        logical: '853x480',
        physical: '1280x720',
        source: '426x240',
        pixelScale: 3,
        logicalScale: 426 / 853,
        remainder: '2x0',
        offset: '1x0'
    });
    assert.deepEqual(viewport.clientToLogical(438.5, 248), { x: 426.5, y: 240 });
});

test('viewport centers an unstretched integer pixel grid remainder', () => {
    const viewport = new Viewport({ clientWidth: 1025, clientHeight: 769 }, {
        getDevicePixelRatio: () => 1,
        worldPixelScale: 3
    }).resize();

    assert.equal(viewport.worldPhysicalWidth, 1023);
    assert.equal(viewport.worldPhysicalHeight, 768);
    assert.equal(viewport.worldOffsetX, 1);
    assert.equal(viewport.worldOffsetY, 0);
    assert.equal(viewport.getRasterMetrics().remainder, '2x1');
    assert.equal(viewport.worldLogicalScale, 341 / 1025);
    assert.equal(viewport.worldSourceInsetX, 0);
    assert.equal(viewport.worldSourceInsetY, (256 - (769 * (341 / 1025))) / 2);
});

test('viewport preserves fractional camera presentation translation', () => {
    const viewport = new Viewport({ clientWidth: 853, clientHeight: 480 }, {
        getDevicePixelRatio: () => 1.5
    }).resize();
    const camera = { x: 123.4, y: 89.8, zoom: 0.6 };
    const before = { ...camera };

    const transform = viewport.getWorldCameraTransform(camera);
    const later = viewport.getWorldCameraTransform({ ...camera, x: camera.x + 0.5, y: camera.y + 0.25 });
    assert.equal(transform.scale, (426 / 853) * 0.6);
    assert.equal(transform.x, -transform.scale * camera.x);
    assert.equal(transform.y, viewport.worldSourceInsetY - transform.scale * camera.y);
    assert.ok(Math.abs((later.x - transform.x) + transform.scale * 0.5) < 1e-12);
    assert.ok(Math.abs((later.y - transform.y) + transform.scale * 0.25) < 1e-12);
    assert.notEqual(transform.x, Math.round(transform.x));
    assert.notEqual(transform.y, Math.round(transform.y));
    assert.deepEqual(camera, before);
});

test('world-to-hud projection includes source inset, compositor offset, pixel scale, and DPR', () => {
    const viewport = new Viewport({ clientWidth: 853, clientHeight: 480 }, {
        getDevicePixelRatio: () => 1.5
    }).resize();
    const camera = { x: 100, y: 50, zoom: 0.6 };
    const source = viewport.getWorldCameraTransform(camera);
    const projected = viewport.projectWorldToHud(400.5, 210.25, camera);
    const expectedScale = source.scale * viewport.worldPixelScale / viewport.dpr;

    assert.deepEqual(viewport.getWorldToHudTransform(camera), {
        scale: expectedScale,
        x: (viewport.worldOffsetX + source.x * viewport.worldPixelScale) / viewport.dpr,
        y: (viewport.worldOffsetY + source.y * viewport.worldPixelScale) / viewport.dpr
    });
    assert.equal(projected.scale, expectedScale);
    assert.ok(Math.abs(projected.x - ((viewport.worldOffsetX + (source.scale * 400.5 + source.x) * viewport.worldPixelScale) / viewport.dpr)) < 1e-12);
    assert.ok(Math.abs(projected.y - ((viewport.worldOffsetY + (source.scale * 210.25 + source.y) * viewport.worldPixelScale) / viewport.dpr)) < 1e-12);
});

test('viewport can change hard-raster scale without changing logical coordinates', () => {
    const viewport = new Viewport({ clientWidth: 853, clientHeight: 480 }, {
        getDevicePixelRatio: () => 1
    }).resize();
    const camera = { x: 123.4, y: 89.8, zoom: 0.6 };
    const before = viewport.getWorldCameraTransform(camera);

    assert.equal(viewport.setWorldPixelScale(1), 1);
    viewport.resize();

    assert.equal(viewport.worldPixelScale, 1);
    assert.equal(viewport.width, 853);
    assert.equal(viewport.height, 480);
    assert.equal(viewport.getWorldCameraTransform(camera).scale, (853 / 853) * 0.6);
    assert.deepEqual(camera, { x: 123.4, y: 89.8, zoom: 0.6 });
    assert.notEqual(before.scale, viewport.getWorldCameraTransform(camera).scale);
    assert.equal(viewport.setWorldPixelScale(99), 3);
});
