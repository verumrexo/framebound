import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTRA_SUPPORT_PART_SPECS } from './ExtraSupportParts.js';

const EXPECTED_PARTS = [
    { id: 'patch_plate', name: 'patch plate', type: 'hull', width: 1, height: 1, stats: { hp: 30, mass: 3 } },
    { id: 'keel_beam', name: 'keel beam', type: 'hull', width: 1, height: 2, stats: { hp: 55, mass: 5 } },
    { id: 'bulkhead', name: 'bulkhead', type: 'hull', width: 2, height: 2, stats: { hp: 120, mass: 12 } },
    { id: 'coffin_hull', name: 'coffin hull', type: 'hull', width: 2, height: 4, stats: { hp: 260, mass: 28 } },
    {
        id: 'glasswing',
        name: 'glasswing',
        type: 'hull',
        width: 1,
        height: 2,
        stats: { hp: 24, mass: 1, turnSpeed: 0.35 }
    },
    {
        id: 'engine_brace',
        name: 'engine brace',
        type: 'hull',
        width: 1,
        height: 1,
        stats: { hp: 18, mass: 1, thrust: 1 }
    },
    {
        id: 'salvage_magnet',
        name: 'salvage magnet',
        type: 'utility',
        width: 1,
        height: 1,
        stats: { hp: 18, mass: 2, pickupRadiusMul: 2 }
    },
    {
        id: 'coolant_loop',
        name: 'coolant loop',
        type: 'utility',
        width: 1,
        height: 1,
        stats: { hp: 16, mass: 2, globalFireRateMul: 1.12 }
    },
    {
        id: 'gyro_ring',
        name: 'gyro ring',
        type: 'utility',
        width: 1,
        height: 2,
        stats: { hp: 35, mass: 3, turnSpeed: 1.2 }
    },
    {
        id: 'rangefinder',
        name: 'rangefinder',
        type: 'utility',
        width: 1,
        height: 1,
        stats: { hp: 16, mass: 2 }
    }
];

function assertSpriteRows(rows, width, height) {
    assert.equal(rows.length, height);
    for (const row of rows) {
        assert.equal(typeof row, 'string');
        assert.equal(row.length, width);
        assert.match(row, /^[012]+$/);
    }
}

function assertDeeplyFrozen(value) {
    assert.equal(Object.isFrozen(value), true);
    if (value === null || typeof value !== 'object') return;
    for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

test('extra support parts preserve the locked order, identity, and tuning', () => {
    assert.equal(EXTRA_SUPPORT_PART_SPECS.length, EXPECTED_PARTS.length);
    assert.deepEqual(
        EXTRA_SUPPORT_PART_SPECS.map(({ id, name, type, width, height, stats }) => ({
            id,
            name,
            type,
            width,
            height,
            stats
        })),
        EXPECTED_PARTS
    );
});

test('extra support parts use footprint-derived hard-raster geometry', () => {
    for (const part of EXTRA_SUPPORT_PART_SPECS) {
        assertSpriteRows(
            part.spriteRows,
            part.width * 7 + 1,
            part.height * 7 + 1
        );
    }
});

test('extra support art is distinct and uses visible pixels', () => {
    const silhouettes = EXTRA_SUPPORT_PART_SPECS.map(part => part.spriteRows.join('\n'));
    assert.equal(new Set(silhouettes).size, silhouettes.length);
    for (const part of EXTRA_SUPPORT_PART_SPECS) {
        assert.match(part.spriteRows.join(''), /[12]/);
    }
});

test('extra support specs are deeply frozen', () => {
    assertDeeplyFrozen(EXTRA_SUPPORT_PART_SPECS);
});
