import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLegacyPartDesign } from './LegacyPartDesignImport.js';

test('legacy weapon code keeps art, pivots, stats, and barrel position', () => {
    const turret = new Array(120).fill(0); turret[3] = 1;
    const base = new Array(120).fill(0); base[8] = 1;
    const source = `
        const ts = new Sprite(${JSON.stringify(turret)}, 8, 15, 4, { 1: '#26d426' }, 0.5, 0.8);
        const bs = new Sprite(${JSON.stringify(base)}, 8, 15, 4, { 1: '#26d426' }, 0.5, 0.2);
        const d = new PartDef('custom_1', 'needle rack', PartType.WEAPON, ts,
            { hp: 40, mass: 4, damage: 7, barrelPosition: { x: 12, y: -2 } }, 1, 2);
        d.baseSprite = bs;
        d.rotationOffset = 1.5708;
    `;

    const design = parseLegacyPartDesign(source);

    assert.equal(design.name, 'needle rack');
    assert.deepEqual(design.layers.turret, turret);
    assert.deepEqual(design.layers.base, base);
    assert.deepEqual(design.anchors.turret, { x: 4, y: 12 });
    assert.deepEqual(design.anchors.base, { x: 4, y: 3 });
    assert.deepEqual(design.barrel, { x: 7, y: 11.5 });
    assert.equal(design.stats.damage, 7);
    assert.equal(design.rotationOffset, 1.5708);
});

test('legacy hull code keeps custom type and stats', () => {
    const pixels = new Array(64).fill(1);
    const source = `new PartDef('custom_2', 'side thruster', PartType.THRUSTER,
        new Sprite(${JSON.stringify(pixels)}, 8, 8, 4, { 1: '#26d426' }),
        { hp: 25, mass: 3, thrust: 2 }, 1, 1)`;

    const design = parseLegacyPartDesign(source);

    assert.equal(design.type, 'thruster');
    assert.deepEqual(design.layers.base, pixels);
    assert.deepEqual(design.stats, { hp: 25, mass: 3, thrust: 2 });
});
