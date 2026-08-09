import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DRONE_BLUEPRINT_SPECS_TORCH_LANCE,
    DRONE_PART_SPECS_TORCH_LANCE
} from './DronePartBatchTorchLance.js';

const partEntries = Object.entries(DRONE_PART_SPECS_TORCH_LANCE);
const blueprintEntries = Object.entries(DRONE_BLUEPRINT_SPECS_TORCH_LANCE);

function assertRows(rows, width, height) {
    assert.equal(rows.length, height);
    for (const row of rows) {
        assert.equal(row.length, width);
        assert.match(row, /^[012]+$/);
    }
}

test('torch and lance part specs expose the requested frozen geometry and stats', () => {
    assert.deepEqual(
        partEntries.map(([id]) => id),
        ['drone_torch_kennel', 'drone_lance_cradle']
    );

    const torch = DRONE_PART_SPECS_TORCH_LANCE.drone_torch_kennel;
    assert.equal(torch.name, 'torch kennel');
    assert.equal(torch.type, 'drone');
    assert.deepEqual([torch.width, torch.height], [1, 2]);
    assert.deepEqual(torch.stats, {
        hp: 40,
        mass: 4,
        weaponGroup: 'drone',
        droneSpawnCooldown: 5.5,
        droneCapacity: 3,
        droneDamage: 4,
        droneAttackCooldown: 0.3,
        droneType: 'torch'
    });

    const lance = DRONE_PART_SPECS_TORCH_LANCE.drone_lance_cradle;
    assert.equal(lance.name, 'lance cradle');
    assert.equal(lance.type, 'drone');
    assert.deepEqual([lance.width, lance.height], [1, 2]);
    assert.deepEqual(lance.stats, {
        hp: 40,
        mass: 4,
        weaponGroup: 'drone',
        droneSpawnCooldown: 8,
        droneCapacity: 1,
        droneDamage: 22,
        droneAttackCooldown: 2.4,
        droneType: 'lancer'
    });
});

test('carrier and deployed-drone silhouettes are 8-wide, authored rows', () => {
    for (const [, part] of partEntries) {
        assertRows(part.carrierSilhouette, 8, 15);
        assertRows(part.deployedDroneSilhouette, 8, 8);
        assert.strictEqual(part.silhouette.carrier, part.carrierSilhouette);
        assert.strictEqual(
            part.silhouette.deployedDrone,
            part.deployedDroneSilhouette
        );
    }
});

test('the two carrier and drone silhouettes are visually unique', () => {
    const [torch, lance] = partEntries.map(([, part]) => part);
    assert.notEqual(
        torch.carrierSilhouette.join('\n'),
        lance.carrierSilhouette.join('\n')
    );
    assert.notEqual(
        torch.deployedDroneSilhouette.join('\n'),
        lance.deployedDroneSilhouette.join('\n')
    );
});

test('torch and lancer blueprint specs freeze the requested attack tuning', () => {
    assert.deepEqual(
        blueprintEntries.map(([id]) => id),
        ['torch', 'lancer']
    );
    assert.deepEqual(DRONE_BLUEPRINT_SPECS_TORCH_LANCE.torch, {
        id: 'torch',
        label: 'torch drone',
        hp: 12,
        speed: 280,
        turnRate: 6,
        range: 190,
        optimalRange: 100,
        projectileType: 'small_laser',
        projectileSpeed: 1800,
        shotCount: 1,
        role: 'attack'
    });
    assert.deepEqual(DRONE_BLUEPRINT_SPECS_TORCH_LANCE.lancer, {
        id: 'lancer',
        label: 'lancer drone',
        hp: 16,
        speed: 170,
        turnRate: 3,
        range: 700,
        optimalRange: 520,
        projectileType: 'railgun',
        projectileSpeed: 0,
        lifetime: 0.12,
        shotCount: 1,
        role: 'attack'
    });
});

test('the batch and every nested content record are frozen', () => {
    assert.ok(Object.isFrozen(DRONE_PART_SPECS_TORCH_LANCE));
    assert.ok(Object.isFrozen(DRONE_BLUEPRINT_SPECS_TORCH_LANCE));

    for (const [, part] of partEntries) {
        assert.ok(Object.isFrozen(part));
        assert.ok(Object.isFrozen(part.stats));
        assert.ok(Object.isFrozen(part.silhouette));
        assert.ok(Object.isFrozen(part.carrierSilhouette));
        assert.ok(Object.isFrozen(part.deployedDroneSilhouette));
    }
    for (const [, spec] of blueprintEntries) {
        assert.ok(Object.isFrozen(spec));
    }
});
