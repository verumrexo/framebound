import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK,
    DRONE_PART_SPECS_BOMBARD_FLAK
} from './DronePartBatchBombardFlak.js';

const EXPECTED_PARTS = [
    {
        id: 'drone_bombard_roost',
        name: 'bombard roost',
        width: 2,
        height: 2,
        stats: {
            hp: 80,
            mass: 8,
            weaponGroup: 'drone',
            droneSpawnCooldown: 8.5,
            droneCapacity: 2,
            droneDamage: 24,
            droneAttackCooldown: 2.8,
            droneType: 'bomber'
        }
    },
    {
        id: 'drone_flak_nursery',
        name: 'flak nursery',
        width: 2,
        height: 2,
        stats: {
            hp: 80,
            mass: 8,
            weaponGroup: 'drone',
            droneSpawnCooldown: 6.5,
            droneCapacity: 2,
            droneDamage: 3,
            droneAttackCooldown: 1.2,
            droneType: 'flak'
        }
    }
];

const EXPECTED_BLUEPRINTS = [
    {
        id: 'bomber',
        label: 'bomber drone',
        hp: 35,
        speed: 150,
        turnRate: 2.5,
        range: 520,
        optimalRange: 360,
        projectileType: 'rocket_he',
        projectileSpeed: 450,
        lifetime: 3,
        oneShot: true,
        role: 'attack'
    },
    {
        id: 'flak',
        label: 'flak drone',
        hp: 28,
        speed: 210,
        turnRate: 4.5,
        range: 230,
        optimalRange: 150,
        projectileType: 'pellet',
        projectileSpeed: 800,
        shotCount: 7,
        spread: 0.6,
        role: 'attack'
    }
];

function assertRows(rows, width, height) {
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

test('bombard and flak carrier specs expose exact geometry and stats', () => {
    assert.equal(DRONE_PART_SPECS_BOMBARD_FLAK.length, 2);

    for (const [index, expected] of EXPECTED_PARTS.entries()) {
        const part = DRONE_PART_SPECS_BOMBARD_FLAK[index];
        assert.equal(part.id, expected.id);
        assert.equal(part.name, expected.name);
        assert.equal(part.type, 'drone');
        assert.equal(part.width, expected.width);
        assert.equal(part.height, expected.height);
        assert.deepEqual(part.stats, expected.stats);
        assertRows(part.carrierRows, 15, 15);
    }
});

test('bomber and flak blueprint specs expose exact tuning and geometry', () => {
    assert.equal(DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK.length, 2);

    for (const [index, expected] of EXPECTED_BLUEPRINTS.entries()) {
        const blueprint = DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK[index];
        assert.deepEqual(blueprint, {
            ...expected,
            droneRows: blueprint.droneRows
        });
        assertRows(blueprint.droneRows, 8, 8);
    }
});

test('all carrier and deployed drone silhouettes are hand-authored and distinct', () => {
    const silhouettes = [
        ...DRONE_PART_SPECS_BOMBARD_FLAK,
        ...DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK
    ].map(spec => silhouette(spec.carrierRows || spec.droneRows));

    assert.equal(new Set(silhouettes).size, silhouettes.length);
});

test('exported specs are deeply frozen', () => {
    assert.equal(Object.isFrozen(DRONE_PART_SPECS_BOMBARD_FLAK), true);
    assert.equal(Object.isFrozen(DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK), true);

    for (const spec of [
        ...DRONE_PART_SPECS_BOMBARD_FLAK,
        ...DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK
    ]) {
        assert.equal(Object.isFrozen(spec), true);
        const rows = spec.carrierRows || spec.droneRows;
        assert.equal(Object.isFrozen(rows), true);
        if (spec.stats) assert.equal(Object.isFrozen(spec.stats), true);
    }
});
