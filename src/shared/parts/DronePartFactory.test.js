import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PartsLibrary } from './Part.js';
import { DRONE_BLUEPRINTS } from '../combat/DroneBlueprints.js';
import { STARTER_LOADOUTS } from '../combat/StarterLoadouts.js';

const NEW_PART_IDS = [
    'drone_needle_nest',
    'drone_interceptor_rack',
    'drone_torch_kennel',
    'drone_lance_cradle',
    'drone_bombard_roost',
    'drone_flak_nursery',
    'drone_bastion_foundry',
    'drone_repair_choir',
    'drone_ram_hive',
    'drone_storm_lattice'
];

test('static drone catalog contains ten eligible non-starter carriers', () => {
    assert.deepEqual(
        Object.keys(PartsLibrary).filter(id => id.startsWith('drone_')),
        NEW_PART_IDS
    );
    for (const id of NEW_PART_IDS) {
        const definition = PartsLibrary[id];
        assert.equal(definition.type, 'drone');
        assert.equal(definition.stats.weaponGroup, 'drone');
        assert.ok(definition.stats.droneSpawnCooldown > 0);
        assert.ok(definition.stats.droneCapacity > 0);
        assert.ok(definition.stats.droneDamage >= 0);
        assert.ok(definition.stats.droneAttackCooldown > 0);
        assert.equal(definition.name, definition.name.toLowerCase());
    }
    const starterIds = STARTER_LOADOUTS.flatMap(loadout =>
        loadout.parts.map(part => part.partId)
    );
    assert.equal(
        NEW_PART_IDS.some(id => starterIds.includes(id)),
        false
    );
});

test('carrier-owned deployed art is joined onto its runtime blueprint', () => {
    assert.deepEqual(
        DRONE_BLUEPRINTS.mender.spriteRows,
        [
            '00011000',
            '00011000',
            '00122100',
            '11211211',
            '11211211',
            '00122100',
            '00011000',
            '00011000'
        ]
    );
});
