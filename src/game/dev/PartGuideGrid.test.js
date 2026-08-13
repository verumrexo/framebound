import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GUIDE_GRID_MODES,
    guideLineWeight,
    isGuideLineVisible,
    normalizeGuideGridMode
} from './PartGuideGrid.js';

test('guide grid modes are presentation-only and emphasize useful counting intervals', () => {
    assert.equal(GUIDE_GRID_MODES.length, 4);
    assert.equal(normalizeGuideGridMode('nonsense'), 'regular');
    assert.equal(guideLineWeight(4, 16, 'every-4'), 2);
    assert.equal(guideLineWeight(3, 16, 'every-4'), 1);
    assert.equal(guideLineWeight(8, 16, 'every-8'), 2);
    assert.equal(guideLineWeight(15, 31, 'cell'), 2);
    assert.equal(guideLineWeight(16, 31, 'cell'), 2);
    assert.equal(guideLineWeight(0, 31, 'cell'), 2);
    assert.equal(guideLineWeight(31, 31, 'cell'), 2);
    assert.equal(guideLineWeight(30, 31, 'cell'), 0);
    assert.equal(isGuideLineVisible(16, 31, 'cell'), true);
});

test('cell guides mark both sides of every shared pixel on a four-cell 61px raster', () => {
    const bold = Array.from({ length: 62 }, (_, index) => index)
        .filter(index => guideLineWeight(index, 61, 'cell') === 2);
    assert.deepEqual(bold, [0, 15, 16, 30, 31, 45, 46, 61]);
    assert.equal(guideLineWeight(14, 61, 'cell'), 0);
    assert.equal(guideLineWeight(17, 61, 'cell'), 0);
    assert.equal(guideLineWeight(60, 61, 'cell'), 0);
});
