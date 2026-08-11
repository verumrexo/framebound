import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBlankPartDesign,
    gridDimensions,
    parsePartDesign,
    serializePartDesign
} from './PartDesignDocument.js';

test('part design document preserves exact art and mount metadata', () => {
    const design = createBlankPartDesign({
        name: 'needle rack',
        type: 'weapon',
        width: 1,
        height: 2
    });
    design.layers.base[0] = 1;
    design.layers.turret = [...design.layers.base];
    design.anchors.base = { x: 4, y: 7.5 };
    design.anchors.turret = { x: 4, y: 6.5 };
    design.barrel = { x: 7.5, y: 6.5 };
    design.rotationOffset = Math.PI / 2;
    design.stats = {
        damage: 7,
        cooldown: 1.5,
        weaponGroup: 'velocity',
        barrelPosition: { x: 14, y: 0 }
    };
    design.notes = 'fires a narrow three-shot burst';

    const restored = parsePartDesign(serializePartDesign(design));

    assert.deepEqual(restored, design);
});

test('part design footprints use the original overlapping pixel geometry', () => {
    assert.deepEqual(gridDimensions(1, 1), { width: 8, height: 8 });
    assert.deepEqual(gridDimensions(1, 2), { width: 8, height: 15 });
    assert.deepEqual(gridDimensions(2, 2), { width: 15, height: 15 });
    assert.deepEqual(gridDimensions(2, 4), { width: 15, height: 29 });
});

test('part design document rejects corrupt pixels and mismatched grids', () => {
    const corruptPixel = createBlankPartDesign();
    corruptPixel.layers.base[0] = 3;
    assert.throws(
        () => serializePartDesign(corruptPixel),
        /invalid pixel/
    );

    const corruptGrid = createBlankPartDesign();
    corruptGrid.grid.width = 99;
    assert.throws(
        () => serializePartDesign(corruptGrid),
        /does not match/
    );
});

test('part design document keeps turret art restricted to weapons', () => {
    const design = createBlankPartDesign();
    design.layers.turret = [...design.layers.base];
    assert.throws(
        () => serializePartDesign(design),
        /turret art requires weapon type/
    );
});

test('part design document persists renderer-only projectile presets and rejects unknown ids', () => {
    const design = createBlankPartDesign({ name: 'slug', type: 'weapon' });
    design.projectileLook = 'heavy-slug';
    design.projectileTrail = 'smoke';
    const restored = parsePartDesign(serializePartDesign(design));
    assert.equal(restored.projectileLook, 'heavy-slug');
    assert.equal(restored.projectileTrail, 'smoke');

    design.projectileLook = 'hitscan-damage-but-somehow-a-skin';
    assert.throws(
        () => serializePartDesign(design),
        /invalid projectile look preset/
    );
});

test('drone part designs round-trip bounded spawned visual data', () => {
    const design = createBlankPartDesign({ name: 'striker hive', type: 'drone', width: 1, height: 1 });
    design.stats = { droneType: 'striker', droneCapacity: 2 };
    design.drone = {
        blueprintId: 'striker',
        grid: { width: 8, height: 8 },
        layers: { base: new Array(64).fill(0).map((_, index) => index === 3 ? 2 : 0) },
        projectileLook: 'needle',
        projectileTrail: 'ion'
    };

    const restored = parsePartDesign(serializePartDesign(design));

    assert.deepEqual(restored.drone, design.drone);
    design.drone.layers.base[0] = 9;
    assert.throws(() => serializePartDesign(design), /drone base layer contains an invalid pixel/);
});

test('core effects round-trip, keep absent distinct from explicit removal, and stay binary', () => {
    const design = createBlankPartDesign({ name: 'core art', type: 'hull' });
    design.coreEffect = {
        grid: { width: 8, height: 8 },
        layers: { base: new Array(64).fill(0).map((_, index) => index === 27 ? 1 : 0) },
        color: '#B56CFF'
    };
    const restored = parsePartDesign(serializePartDesign(design));
    assert.equal(restored.coreEffect.color, '#b56cff');
    assert.deepEqual(restored.coreEffect.layers.base, design.coreEffect.layers.base);

    const legacy = createBlankPartDesign();
    delete legacy.coreEffect;
    const restoredLegacy = parsePartDesign(serializePartDesign(legacy));
    assert.equal(Object.hasOwn(restoredLegacy, 'coreEffect'), false);

    const removed = createBlankPartDesign();
    removed.coreEffect = null;
    assert.equal(parsePartDesign(serializePartDesign(removed)).coreEffect, null);

    const badPixels = createBlankPartDesign();
    badPixels.coreEffect = {
        grid: { width: 8, height: 8 },
        layers: { base: new Array(64).fill(0).map((_, index) => index === 0 ? 2 : 0) },
        color: '#55ccff'
    };
    assert.throws(() => serializePartDesign(badPixels), /core effect base layer contains an invalid pixel/);
    const badGrid = createBlankPartDesign();
    badGrid.coreEffect = {
        grid: { width: 7, height: 8 },
        layers: { base: new Array(64).fill(0) },
        color: '#55ccff'
    };
    assert.throws(() => serializePartDesign(badGrid), /core effect grid must be 8x8/);
    const badColor = createBlankPartDesign();
    badColor.coreEffect = {
        grid: { width: 8, height: 8 },
        layers: { base: new Array(64).fill(0) },
        color: '#55ccf'
    };
    assert.throws(() => serializePartDesign(badColor), /core effect color must be #RRGGBB/);
});
