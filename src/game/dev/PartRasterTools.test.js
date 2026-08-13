import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRasterStroke, mirrorRasterPixels, RasterHistory } from './PartRasterTools.js';

test('raster tools draw lines, outlined boxes, filled boxes, and bounded fills', () => {
    const blank = new Array(25).fill(0);
    const line = drawRasterStroke(blank, 5, 5, 'line', { x: 0, y: 0 }, { x: 4, y: 4 }, 2);
    assert.equal(line.filter(value => value === 2).length, 5);
    const box = drawRasterStroke(blank, 5, 5, 'box', { x: 1, y: 1 }, { x: 3, y: 3 }, 1);
    assert.equal(box.filter(Boolean).length, 8);
    const filled = drawRasterStroke(blank, 5, 5, 'box-fill', { x: 1, y: 1 }, { x: 3, y: 3 }, 1);
    assert.equal(filled.filter(Boolean).length, 9);
    const flooded = drawRasterStroke(box, 5, 5, 'fill', { x: 0, y: 0 }, { x: 2, y: 2 }, 3);
    assert.equal(flooded[2 * 5 + 2], 3);
    assert.equal(flooded[0], 0);
});

test('raster history supports undo and redo without aliasing snapshots', () => {
    const history = new RasterHistory([0, 0]);
    history.commit([1, 0]);
    history.commit([1, 2]);
    assert.deepEqual(history.undo(), [1, 0]);
    assert.deepEqual(history.undo(), [0, 0]);
    assert.deepEqual(history.redo(), [1, 0]);
});

test('mirror operations flip only raster pixels on the requested axis', () => {
    const pixels = [1, 2, 3, 4, 5, 6];
    assert.deepEqual(mirrorRasterPixels(pixels, 3, 2, 'horizontal'), [3, 2, 1, 6, 5, 4]);
    assert.deepEqual(mirrorRasterPixels(pixels, 3, 2, 'vertical'), [4, 5, 6, 1, 2, 3]);
    assert.deepEqual(mirrorRasterPixels(pixels, 3, 2, 'diagonal'), pixels);
});
