import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DRONE_BLUEPRINT_SPECS_RAM_STORM,
    DRONE_PART_SPECS_RAM_STORM
} from './DronePartBatchRamStorm.js';

const parts = Object.values(DRONE_PART_SPECS_RAM_STORM);
const blueprints = Object.values(DRONE_BLUEPRINT_SPECS_RAM_STORM);

function assertRows(rows, width, height) {
    assert.equal(rows.length, height);
    for (const row of rows) {
        assert.equal(typeof row, 'string');
        assert.equal(row.length, width);
        assert.match(row, /^[012]+$/);
    }
}

test('ram/storm batch exports are deeply frozen at the manifest level', () => {
    assert.equal(Object.isFrozen(DRONE_PART_SPECS_RAM_STORM), true);
    assert.equal(Object.isFrozen(DRONE_BLUEPRINT_SPECS_RAM_STORM), true);
    assert.ok(parts.every(part => Object.isFrozen(part)));
    assert.ok(parts.every(part => Object.isFrozen(part.stats)));
    assert.ok(parts.every(part => Object.isFrozen(part.carrierRows)));
    assert.ok(parts.every(part => Object.isFrozen(part.droneRows)));
    assert.ok(blueprints.every(blueprint => Object.isFrozen(blueprint)));
});

test('ram and storm carriers keep their requested dimensions and drone stats', () => {
    const ram = DRONE_PART_SPECS_RAM_STORM.drone_ram_hive;
    const storm = DRONE_PART_SPECS_RAM_STORM.drone_storm_lattice;

    assert.deepEqual(
        {
            id: ram.id,
            type: ram.type,
            width: ram.width,
            height: ram.height,
            hp: ram.stats.hp,
            mass: ram.stats.mass
        },
        {
            id: 'drone_ram_hive',
            type: 'drone',
            width: 1,
            height: 2,
            hp: 40,
            mass: 4
        }
    );
    assert.deepEqual(ram.stats, {
        hp: 40,
        mass: 4,
        weaponGroup: 'drone',
        droneSpawnCooldown: 7,
        droneCapacity: 3,
        droneDamage: 30,
        droneDamageType: 'impact',
        droneAttackCooldown: 1,
        droneType: 'rammer'
    });

    assert.deepEqual(
        {
            id: storm.id,
            type: storm.type,
            width: storm.width,
            height: storm.height,
            hp: storm.stats.hp,
            mass: storm.stats.mass
        },
        {
            id: 'drone_storm_lattice',
            type: 'drone',
            width: 2,
            height: 4,
            hp: 160,
            mass: 16
        }
    );
    assert.deepEqual(storm.stats, {
        hp: 160,
        mass: 16,
        weaponGroup: 'drone',
        droneSpawnCooldown: 6.5,
        droneCapacity: 5,
        droneDamage: 3,
        droneAttackCooldown: 0.9,
        droneType: 'storm'
    });
});

test('carrier and drone silhouettes have exact geometry, valid charset, and distinct art', () => {
    const ram = DRONE_PART_SPECS_RAM_STORM.drone_ram_hive;
    const storm = DRONE_PART_SPECS_RAM_STORM.drone_storm_lattice;

    assertRows(ram.carrierRows, 8, 15);
    assertRows(storm.carrierRows, 15, 29);
    assertRows(ram.droneRows, 8, 8);
    assertRows(storm.droneRows, 8, 8);

    assert.notEqual(ram.carrierRows.join('\n'), storm.carrierRows.join('\n'));
    assert.notEqual(ram.droneRows.join('\n'), storm.droneRows.join('\n'));
});

test('rammer and storm blueprints expose the requested behavior tuning', () => {
    const rammer = DRONE_BLUEPRINT_SPECS_RAM_STORM.rammer;
    const storm = DRONE_BLUEPRINT_SPECS_RAM_STORM.storm;

    assert.deepEqual(rammer, {
        id: 'rammer',
        label: 'rammer drone',
        hp: 12,
        speed: 420,
        turnRate: 8,
        range: 700,
        optimalDistance: 0,
        role: 'ram',
        contactRange: 22
    });
    assert.equal(Object.hasOwn(rammer, 'projectileType'), false);

    assert.deepEqual(storm, {
        id: 'storm',
        label: 'storm drone',
        hp: 24,
        speed: 240,
        turnRate: 5,
        range: 320,
        optimalDistance: 190,
        projectileType: 'small_laser',
        projectileSpeed: 1800,
        shotCount: 2,
        spread: 0.18,
        role: 'attack'
    });
});

test('new user-facing labels are lowercase', () => {
    for (const part of parts) assert.equal(part.name, part.name.toLowerCase());
    for (const blueprint of blueprints) {
        assert.equal(blueprint.label, blueprint.label.toLowerCase());
    }
});
