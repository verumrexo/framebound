import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBlankPartDesign,
    gridDimensions,
    parsePartDesign,
    serializePartDesign,
    upgradeLegacyPartDesign
} from './PartDesignDocument.js';

test('v2 grids double source detail while preserving the two-pixel seam overlap', () => {
    assert.deepEqual(gridDimensions(1, 1), { width: 16, height: 16 });
    assert.deepEqual(gridDimensions(1, 2), { width: 16, height: 30 });
    assert.deepEqual(gridDimensions(2, 1), { width: 30, height: 16 });
    assert.deepEqual(gridDimensions(2, 2), { width: 30, height: 30 });
    assert.deepEqual(gridDimensions(2, 4), { width: 30, height: 58 });
});

test('v2 documents preserve independent turret dimensions, palettes, and multiple muzzles', () => {
    const design = createBlankPartDesign({ name: 'side cannon', type: 'weapon', width: 1, height: 2, turretWidth: 2, turretHeight: 1 });
    design.layers.base[0] = 8;
    design.layers.turret = new Array(design.turretGrid.width * design.turretGrid.height).fill(0);
    design.layers.turret[5] = 3;
    design.anchors.base = { x: 8, y: 15 };
    design.anchors.turret = { x: 4.5, y: 8 };
    design.muzzles = [{ x: 25.5, y: 5.5 }, { x: 25.5, y: 10.5 }];
    design.stats = { damage: 7 };
    const restored = parsePartDesign(serializePartDesign(design));
    assert.deepEqual(restored, design);
    assert.deepEqual(restored.turretGrid, { width: 30, height: 16 });
});

test('v2 validation bounds palette indices, grids, and geometry points', () => {
    const badPixel = createBlankPartDesign();
    badPixel.layers.base[0] = badPixel.palette.length + 1;
    assert.throws(() => serializePartDesign(badPixel), /invalid pixel/);
    const badGrid = createBlankPartDesign();
    badGrid.grid.width = 99;
    assert.throws(() => serializePartDesign(badGrid), /does not match/);
    const badMuzzle = createBlankPartDesign({ type: 'weapon' });
    badMuzzle.layers.turret = new Array(256).fill(0);
    badMuzzle.muzzles = [{ x: 100, y: 4 }];
    assert.throws(() => serializePartDesign(badMuzzle), /outside/);
});

test('drone and core art use full 16x16 palette rasters', () => {
    const design = createBlankPartDesign({ name: 'hive', type: 'drone' });
    design.drone = {
        blueprintId: 'striker', resolution: 16,
        grid: { width: 16, height: 16 }, palette: ['#00ffff', '#177777', '#ffffff'],
        layers: { base: new Array(256).fill(0) },
        projectileLook: 'needle', projectileTrail: 'ion'
    };
    design.drone.layers.base[4] = 3;
    design.coreEffect = {
        resolution: 16, grid: { width: 16, height: 16 }, palette: ['#ff4444'],
        layers: { base: new Array(256).fill(0) }
    };
    design.coreEffect.layers.base[90] = 1;
    const restored = parsePartDesign(serializePartDesign(design));
    assert.deepEqual(restored.drone, design.drone);
    assert.deepEqual(restored.coreEffect, design.coreEffect);
});

test('v1 designs still load and upgrade losslessly at two source pixels per old pixel', () => {
    const pixels = new Array(64).fill(0); pixels[9] = 2;
    const legacy = {
        format: 'framebound-part-design', version: 1, name: 'dart', type: 'weapon',
        footprint: { width: 1, height: 1 }, grid: { width: 8, height: 8 },
        layers: { base: pixels, turret: pixels }, anchors: { base: { x: 4, y: 4 }, turret: { x: 4, y: 4 } },
        barrel: { x: 7, y: 4 }, rotationOffset: 0,
        projectileLook: 'default', projectileTrail: 'default', coreEffect: null, drone: null,
        stats: { damage: 5 }, notes: ''
    };
    const parsed = parsePartDesign(JSON.stringify(legacy));
    assert.equal(parsed.version, 1);
    const upgraded = upgradeLegacyPartDesign(parsed);
    assert.equal(upgraded.version, 2);
    assert.equal(upgraded.layers.base.filter(pixel => pixel === 2).length, 4);
    assert.deepEqual(upgraded.muzzles, [{ x: 14, y: 8 }]);
});
