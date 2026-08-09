import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR,
    DRONE_PART_SPECS_NEEDLE_INTERCEPTOR
} from './DronePartBatchNeedleInterceptor.js';

const EXPECTED_PARTS = [
    {
        id: 'drone_needle_nest',
        name: 'needle nest',
        width: 1,
        height: 1,
        stats: {
            hp: 20,
            mass: 2,
            weaponGroup: 'drone',
            spawnCooldown: 4,
            capacity: 2,
            damage: 3,
            attackCooldown: 0.45,
            droneType: 'needle'
        }
    },
    {
        id: 'drone_interceptor_rack',
        name: 'interceptor rack',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            weaponGroup: 'drone',
            spawnCooldown: 5,
            capacity: 3,
            damage: 6,
            attackCooldown: 0.65,
            droneType: 'interceptor'
        }
    }
];

const EXPECTED_BLUEPRINTS = [
    {
        id: 'needle',
        label: 'needle drone',
        hp: 10,
        speed: 300,
        turnRate: 6,
        range: 280,
        optimalDistance: 180,
        projectileType: 'mini_bullet',
        projectileSpeed: 1000,
        shotCount: 1,
        role: 'attack'
    },
    {
        id: 'interceptor',
        label: 'interceptor drone',
        hp: 14,
        speed: 360,
        turnRate: 7,
        range: 260,
        optimalDistance: 130,
        projectileType: 'mini_bullet',
        projectileSpeed: 1100,
        shotCount: 2,
        spread: 0.08,
        targetPriority: 'drones',
        role: 'attack'
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

function silhouette(rows) {
    return rows.join('\n');
}

test('needle and interceptor carrier specs expose exact geometry and stats', () => {
    assert.equal(DRONE_PART_SPECS_NEEDLE_INTERCEPTOR.length, 2);

    for (const [index, expected] of EXPECTED_PARTS.entries()) {
        const part = DRONE_PART_SPECS_NEEDLE_INTERCEPTOR[index];
        assert.equal(part.id, expected.id);
        assert.equal(part.name, expected.name);
        assert.equal(part.type, 'drone');
        assert.equal(part.width, expected.width);
        assert.equal(part.height, expected.height);
        assert.deepEqual(part.stats, expected.stats);
        assertSpriteRows(
            part.spriteRows,
            expected.width * 7 + 1,
            expected.height * 7 + 1
        );
    }
});

test('needle and interceptor blueprint specs expose exact tuning and geometry', () => {
    assert.equal(DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR.length, 2);

    for (const [index, expected] of EXPECTED_BLUEPRINTS.entries()) {
        const blueprint = DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR[index];
        assert.deepEqual(
            Object.fromEntries(Object.entries(blueprint).filter(([key]) => key !== 'spriteRows')),
            expected
        );
        assertSpriteRows(blueprint.spriteRows, 8, 8);
    }
});

test('all carrier and deployed drone silhouettes are hand-authored and distinct', () => {
    const silhouettes = [
        ...DRONE_PART_SPECS_NEEDLE_INTERCEPTOR,
        ...DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR
    ].map(spec => silhouette(spec.spriteRows));

    assert.equal(new Set(silhouettes).size, silhouettes.length);
});

test('exported specs are deeply frozen', () => {
    assert.equal(Object.isFrozen(DRONE_PART_SPECS_NEEDLE_INTERCEPTOR), true);
    assert.equal(Object.isFrozen(DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR), true);

    for (const spec of [
        ...DRONE_PART_SPECS_NEEDLE_INTERCEPTOR,
        ...DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR
    ]) {
        assert.equal(Object.isFrozen(spec), true);
        assert.equal(Object.isFrozen(spec.spriteRows), true);
        if (spec.stats) assert.equal(Object.isFrozen(spec.stats), true);
    }
});
