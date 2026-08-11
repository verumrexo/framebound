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
