import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DRONE_BLUEPRINT_SPECS_BASTION_REPAIR,
    DRONE_PART_SPECS_BASTION_REPAIR
} from './DronePartBatchBastionRepair.js';

const byId = (entries, id) => entries.find(entry => entry.id === id);

function assertSpriteRows(rows, width) {
    assert.equal(rows.length, width);
    for (const row of rows) {
        assert.equal(typeof row, 'string');
        assert.equal(row.length, width);
        assert.match(row, /^[012]+$/);
    }
}

test('bastion and repair parts expose frozen drone specs with exact tuning', () => {
    assert.ok(Object.isFrozen(DRONE_PART_SPECS_BASTION_REPAIR));
    assert.equal(DRONE_PART_SPECS_BASTION_REPAIR.length, 2);

    const bastion = byId(
        DRONE_PART_SPECS_BASTION_REPAIR,
        'drone_bastion_foundry'
    );
    const repair = byId(
        DRONE_PART_SPECS_BASTION_REPAIR,
        'drone_repair_choir'
    );

    assert.deepEqual(
        {
            name: bastion.name,
            type: bastion.type,
            width: bastion.width,
            height: bastion.height,
            stats: bastion.stats
        },
        {
            name: 'bastion foundry',
            type: 'drone',
            width: 2,
            height: 2,
            stats: {
                hp: 80,
                mass: 8,
                weaponGroup: 'drone',
                droneSpawnCooldown: 10,
                droneCapacity: 2,
                droneDamage: 12,
                droneAttackCooldown: 1,
                droneType: 'bastion'
            }
        }
    );
    assert.deepEqual(
        {
            name: repair.name,
            type: repair.type,
            width: repair.width,
            height: repair.height,
            stats: repair.stats
        },
        {
            name: 'repair choir',
            type: 'drone',
            width: 2,
            height: 2,
            stats: {
                hp: 80,
                mass: 8,
                weaponGroup: 'drone',
                droneSpawnCooldown: 9,
                droneCapacity: 2,
                droneDamage: 0,
                droneAttackCooldown: 2,
                droneType: 'mender',
                droneRole: 'repair'
            }
        }
    );

    assert.ok(Object.isFrozen(bastion));
    assert.ok(Object.isFrozen(bastion.stats));
    assert.ok(Object.isFrozen(repair));
    assert.ok(Object.isFrozen(repair.stats));
});

test('bastion and mender blueprints expose their combat and support roles', () => {
    assert.ok(Object.isFrozen(DRONE_BLUEPRINT_SPECS_BASTION_REPAIR));
    assert.equal(DRONE_BLUEPRINT_SPECS_BASTION_REPAIR.length, 2);

    const bastion = byId(DRONE_BLUEPRINT_SPECS_BASTION_REPAIR, 'bastion');
    const mender = byId(DRONE_BLUEPRINT_SPECS_BASTION_REPAIR, 'mender');

    assert.deepEqual(bastion, {
        id: 'bastion',
        label: 'bastion',
        hp: 90,
        speed: 90,
        turnRate: 2,
        range: 380,
        optimalRange: 260,
        projectileType: 'laser',
        projectileSpeed: 1500,
        attackCooldown: 1,
        oneShot: true,
        role: 'attack'
    });
    assert.deepEqual(mender, {
        id: 'mender',
        label: 'mender',
        hp: 35,
        speed: 200,
        turnRate: 4,
        range: 360,
        optimalRange: 120,
        attackCooldown: 2,
        role: 'repair',
        repairAmount: 4
    });
    assert.equal('projectileType' in mender, false);
    assert.ok(Object.isFrozen(bastion));
    assert.ok(Object.isFrozen(mender));
});

test('carrier and drone artwork has valid dimensions, charset, and distinct silhouettes', () => {
    const [bastion, repair] = DRONE_PART_SPECS_BASTION_REPAIR;

    assertSpriteRows(bastion.carrierRows, 15);
    assertSpriteRows(repair.carrierRows, 15);
    assertSpriteRows(bastion.droneRows, 8);
    assertSpriteRows(repair.droneRows, 8);

    assert.ok(Object.isFrozen(bastion.carrierRows));
    assert.ok(Object.isFrozen(bastion.droneRows));
    assert.ok(Object.isFrozen(repair.carrierRows));
    assert.ok(Object.isFrozen(repair.droneRows));
    assert.notDeepEqual(bastion.carrierRows, repair.carrierRows);
    assert.notDeepEqual(bastion.droneRows, repair.droneRows);

    const bastionCarrierFilled = bastion.carrierRows.join('').replaceAll('0', '');
    const repairCarrierFilled = repair.carrierRows.join('').replaceAll('0', '');
    const bastionDroneFilled = bastion.droneRows.join('').replaceAll('0', '');
    const repairDroneFilled = repair.droneRows.join('').replaceAll('0', '');
    assert.notEqual(bastionCarrierFilled, repairCarrierFilled);
    assert.notEqual(bastionDroneFilled, repairDroneFilled);
    assert.ok(bastionCarrierFilled.length > repairCarrierFilled.length);
    assert.ok(repairCarrierFilled.length > 0);
});
