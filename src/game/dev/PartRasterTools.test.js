import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRasterStroke, RasterHistory } from './PartRasterTools.js';

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

test('left-right and top-bottom symmetry mirror every raster tool by pixel index', () => {
    const tools = ['pencil', 'eraser', 'line', 'box', 'box-fill'];
    for (const tool of tools) {
        const pixels = tool === 'eraser' ? new Array(25).fill(2) : new Array(25).fill(0);
        const result = drawRasterStroke(pixels, 5, 5, tool, { x: 1, y: 1 }, { x: 2, y: 2 }, tool === 'eraser' ? 0 : 1, { leftRight: true, topBottom: true });
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
            assert.equal(result[y * 5 + x], result[y * 5 + (4 - x)], `${tool} left-right symmetry at ${x},${y}`);
            assert.equal(result[y * 5 + x], result[(4 - y) * 5 + x], `${tool} top-bottom symmetry at ${x},${y}`);
        }
    }
});

test('symmetry handles odd and even rasters without duplicating center pixels', () => {
    const odd = drawRasterStroke(new Array(25).fill(0), 5, 5, 'pencil', { x: 2, y: 2 }, { x: 2, y: 2 }, 3, { leftRight: true, topBottom: true });
    assert.equal(odd.filter(value => value === 3).length, 1);
    assert.equal(odd[2 * 5 + 2], 3);

    const even = drawRasterStroke(new Array(16).fill(0), 4, 4, 'pencil', { x: 0, y: 1 }, { x: 0, y: 1 }, 3, { leftRight: true, topBottom: true });
    assert.deepEqual(even, [0, 0, 0, 0, 3, 0, 0, 3, 3, 0, 0, 3, 0, 0, 0, 0]);

    const wide = drawRasterStroke(new Array(61).fill(0), 61, 1, 'pencil', { x: 0, y: 0 }, { x: 0, y: 0 }, 3, { leftRight: true });
    assert.equal(wide[0], 3);
    assert.equal(wide[60], 3);
    assert.equal(wide.filter(value => value === 3).length, 2);
});

test('outlined and filled boxes stay symmetric on a 31 by 16 raster', () => {
    const symmetry = { leftRight: true, topBottom: true };
    const outline = drawRasterStroke(new Array(31 * 16).fill(0), 31, 16, 'box', { x: 2, y: 3 }, { x: 6, y: 5 }, 1, symmetry);
    const filled = drawRasterStroke(new Array(31 * 16).fill(0), 31, 16, 'box-fill', { x: 2, y: 3 }, { x: 6, y: 5 }, 1, symmetry);
    for (const pixels of [outline, filled]) {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 31; x++) {
            assert.equal(pixels[y * 31 + x], pixels[y * 31 + (30 - x)]);
            assert.equal(pixels[y * 31 + x], pixels[(15 - y) * 31 + x]);
        }
    }
    assert.equal(outline.filter(Boolean).length, 48);
    assert.equal(filled.filter(Boolean).length, 60);
});

test('fill and eraser apply to the mirrored regions without touching geometry', () => {
    const pixels = new Array(5 * 4).fill(0);
    for (let y = 0; y < 4; y++) pixels[y * 5 + 2] = 1;
    const filled = drawRasterStroke(pixels, 5, 4, 'fill', { x: 0, y: 0 }, { x: 0, y: 0 }, 2, { leftRight: true });
    assert.equal(filled[0], 2);
    assert.equal(filled[4], 2);
    assert.equal(filled[2], 1);

    const erased = drawRasterStroke(new Array(5 * 4).fill(2), 5, 4, 'eraser', { x: 1, y: 1 }, { x: 1, y: 1 }, 0, { leftRight: true, topBottom: true });
    for (const [x, y] of [[1, 1], [3, 1], [1, 2], [3, 2]]) assert.equal(erased[y * 5 + x], 0);
    assert.equal(erased[1 * 5 + 2], 2);
});
