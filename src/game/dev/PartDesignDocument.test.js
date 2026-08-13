import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBlankPartDesign,
    gridDimensions,
    normalizePartDesign,
    parsePartDesign,
    serializePartDesign,
    upgradeLegacyPartDesign
} from './PartDesignDocument.js';

test('v2 grids use exactly one authored-pixel seam overlap', () => {
    assert.deepEqual(gridDimensions(1, 1), { width: 16, height: 16 });
    assert.deepEqual(gridDimensions(1, 2), { width: 16, height: 31 });
    assert.deepEqual(gridDimensions(2, 1), { width: 31, height: 16 });
    assert.deepEqual(gridDimensions(2, 2), { width: 31, height: 31 });
    assert.deepEqual(gridDimensions(2, 4), { width: 31, height: 61 });
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
    assert.deepEqual(restored.turretGrid, { width: 31, height: 16 });
});

test('old v2 30/58 rasters migrate to 31/61 without transparent seam scars', () => {
    const old = createBlankPartDesign({ name: 'wide hull', type: 'hull', width: 2, height: 4 });
    old.grid = { width: 30, height: 58 };
    old.layers.base = new Array(30 * 58).fill(1);

    const migrated = normalizePartDesign(old);

    assert.deepEqual(migrated.grid, { width: 31, height: 61 });
    assert.equal(migrated.layers.base.length, 31 * 61);
    assert.ok(migrated.layers.base.every(pixel => pixel === 1));
    assert.deepEqual(old.grid, { width: 30, height: 58 });
    assert.equal(old.layers.base.length, 30 * 58);
});

test('old v2 seam expansion duplicates every 2x4 and 4x2 seam row or column', () => {
    const old = createBlankPartDesign({
        name: 'cross seam',
        type: 'weapon',
        width: 2,
        height: 4,
        turretWidth: 4,
        turretHeight: 2
    });
    old.grid = { width: 30, height: 58 };
    old.turretGrid = { width: 58, height: 30 };
    old.layers.base = new Array(30 * 58).fill(1);
    old.layers.turret = new Array(58 * 30).fill(1);
    for (const y of [14, 28, 42]) {
        for (let x = 0; x < 30; x++) old.layers.base[y * 30 + x] = 2;
    }
    for (const x of [14, 28, 42]) {
        for (let y = 0; y < 30; y++) old.layers.turret[y * 58 + x] = 2;
    }

    const migrated = normalizePartDesign(old);

    assert.deepEqual(migrated.grid, { width: 31, height: 61 });
    assert.deepEqual(migrated.turretGrid, { width: 61, height: 31 });
    assert.ok(migrated.layers.base.every(pixel => pixel > 0));
    assert.ok(migrated.layers.turret.every(pixel => pixel > 0));
    for (const destinationY of [14, 29, 44]) {
        const row = migrated.layers.base.slice(destinationY * 31, (destinationY + 1) * 31);
        assert.ok(row.every(pixel => pixel === 2));
    }
    for (const destinationX of [14, 29, 44]) {
        for (let y = 0; y < 31; y++) assert.equal(migrated.layers.turret[y * 61 + destinationX], 2);
    }
    for (const sourceY of [14, 28, 42]) {
        const destinationY = sourceY + [14, 28, 42].filter(seam => seam < sourceY).length + 1;
        const row = migrated.layers.base.slice(destinationY * 31, (destinationY + 1) * 31);
        assert.ok(row.every(pixel => pixel === 2));
    }
    for (const sourceX of [14, 28, 42]) {
        const destinationX = sourceX + [14, 28, 42].filter(seam => seam < sourceX).length + 1;
        for (let y = 0; y < 31; y++) assert.equal(migrated.layers.turret[y * 61 + destinationX], 2);
    }
});

test('old v2 points migrate across every seam stride without shifting the source draft', () => {
    for (const sourceY of [14, 28, 42]) {
        const old = createBlankPartDesign({ name: 'base point', type: 'hull', width: 2, height: 4 });
        old.grid = { width: 30, height: 58 };
        old.layers.base = new Array(30 * 58).fill(1);
        old.anchors.base = { x: 8, y: sourceY };

        const migrated = normalizePartDesign(old);

        assert.deepEqual(migrated.anchors.base, { x: 8, y: sourceY + 1 + [14, 28, 42].filter(seam => seam < sourceY).length });
        assert.deepEqual(old.anchors.base, { x: 8, y: sourceY });
    }

    const old = createBlankPartDesign({
        name: 'turret points',
        type: 'weapon',
        width: 1,
        height: 1,
        turretWidth: 4,
        turretHeight: 2
    });
    old.turretGrid = { width: 58, height: 30 };
    old.layers.turret = new Array(58 * 30).fill(1);
    old.muzzles = [
        { x: 14, y: 10 },
        { x: 28, y: 10 },
        { x: 42, y: 10 },
        { x: 43, y: 10 }
    ];

    const migrated = normalizePartDesign(old);

    assert.deepEqual(migrated.muzzles, [
        { x: 15, y: 10 },
        { x: 30, y: 10 },
        { x: 45, y: 10 },
        { x: 46, y: 10 }
    ]);
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
        layers: { base: new Array(256).fill(0) },
        spinPivot: { x: 7.5, y: 8.5 }
    };
    design.coreEffect.layers.base[90] = 1;
    const restored = parsePartDesign(serializePartDesign(design));
    assert.deepEqual(restored.drone, design.drone);
    assert.deepEqual(restored.coreEffect, design.coreEffect);
});

test('core spin pivots default to center and preserve half-pixel coordinates', () => {
    const design = createBlankPartDesign({ name: 'pivot', type: 'core' });
    design.coreEffect = {
        resolution: 16,
        grid: { width: 16, height: 16 },
        palette: ['#55ccff'],
        layers: { base: new Array(256).fill(0) }
    };
    const defaulted = parsePartDesign(serializePartDesign(design));
    assert.deepEqual(defaulted.coreEffect.spinPivot, { x: 8, y: 8 });

    design.coreEffect.spinPivot = { x: 7.5, y: 8.5 };
    const restored = parsePartDesign(serializePartDesign(design));
    assert.deepEqual(restored.coreEffect.spinPivot, { x: 7.5, y: 8.5 });
    design.coreEffect.spinPivot = { x: 7.25, y: 8 };
    assert.throws(() => serializePartDesign(design), /outside the design grid/);
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
