import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PartType } from './PartDefinitions.js';
import {
    validatePartDefinition,
    validatePartsLibrary
} from './PartDefinitionValidation.js';

const { PartsLibrary } = await import('./Part.js');

function makePart(overrides = {}) {
    return {
        id: 'test_part',
        name: 'test part',
        description: 'a test part with a plain-English description.',
        type: PartType.HULL,
        width: 1,
        height: 1,
        stats: { hp: 10, mass: 1 },
        ...overrides
    };
}

test('part library accepts bounded definitions and mechanic-ready config', () => {
    const definition = makePart({
        stats: {
            hp: 10,
            mass: 1,
            customStrength: 2,
            origin: { x: 4, y: -2 }
        }
    });

    assert.equal(validatePartsLibrary({ test_part: definition }), true);
});

test('part definitions reject mismatched ids and corrupt numeric state', () => {
    assert.throws(
        () => validatePartDefinition('wrong_id', makePart()),
        /mismatched id/
    );
    assert.throws(
        () => validatePartDefinition('test_part', makePart({
            stats: { hp: Number.NaN, mass: 1 }
        })),
        /non-finite hp/
    );
});

test('part definitions require a non-empty plain-English description', () => {
    assert.throws(
        () => validatePartDefinition('test_part', makePart({ description: '' })),
        /non-empty description/
    );
    assert.throws(
        () => validatePartDefinition('test_part', makePart({ description: undefined })),
        /non-empty description/
    );
});

test('weapons require safe damage, cooldown, and group values', () => {
    const weapon = makePart({
        type: PartType.WEAPON,
        stats: {
            hp: 10,
            mass: 1,
            damage: 5,
            cooldown: 0,
            weaponGroup: 'velocity'
        }
    });

    assert.throws(
        () => validatePartDefinition('test_part', weapon),
        /positive cooldown/
    );
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...weapon,
            stats: { ...weapon.stats, cooldown: 1, weaponGroup: 'garbage' }
        }),
        /unknown group/
    );
    assert.equal(validatePartDefinition('test_part', {
        ...weapon,
        stats: { ...weapon.stats, cooldown: 1, weaponGroup: 'utility' }
    }), true);
});

test('repair drone carriers allow zero damage but keep the other runtime guards', () => {
    const repair = makePart({
        type: PartType.DRONE,
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
    });

    assert.equal(validatePartDefinition('test_part', repair), true);
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...repair,
            stats: { ...repair.stats, droneCapacity: 0 }
        }),
        /positive droneCapacity/
    );
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...repair,
            stats: { ...repair.stats, droneDamage: -1 }
        }),
        /non-negative droneDamage/
    );
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...repair,
            stats: { ...repair.stats, droneRole: 'attack' }
        }),
        /positive droneDamage/
    );
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...repair,
            stats: { ...repair.stats, droneType: '' }
        }),
        /must have a droneType/
    );
});

test('new utility stats reject impossible values while accepting the catalog shape', () => {
    const utility = makePart({
        type: PartType.UTILITY,
        stats: {
            hp: 18,
            mass: 2,
            activeAbility: 'blink',
            abilityCooldown: 7,
            abilityRange: 260,
            laserSplitCount: 2,
            laserSplitAngle: 0.13,
            laserSplitDamageMul: 0.45,
            velocityPierceAdd: 1
        }
    });

    assert.equal(validatePartDefinition('test_part', utility), true);
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...utility,
            stats: { ...utility.stats, abilityCooldown: 0 }
        }),
        /positive abilityCooldown/
    );
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...utility,
            stats: { ...utility.stats, laserSplitCount: 1.5 }
        }),
        /positive integer laserSplitCount/
    );
    assert.throws(
        () => validatePartDefinition('test_part', {
            ...utility,
            stats: { ...utility.stats, activeAbility: '' }
        }),
        /valid activeAbility/
    );
});

test('doctrine definitions require their physical shop and modifier metadata', () => {
    const doctrine = makePart({
        id: 'doctrine_test',
        type: PartType.UTILITY,
        uniqueGroup: 'doctrine',
        rarity: 'legendary',
        shopCategory: 'doctrine',
        shopPrice: 90,
        doctrineId: 'test',
        buildModifiers: { multiply: { speedMul: 1.2 } },
        bonuses: ['faster'],
        drawbacks: ['fragile']
    });
    assert.equal(validatePartDefinition('doctrine_test', doctrine), true);
    assert.throws(
        () => validatePartDefinition('doctrine_test', { ...doctrine, shopPrice: 89 }),
        /invalid doctrine metadata/
    );
    assert.throws(
        () => validatePartDefinition('doctrine_test', {
            ...doctrine,
            buildModifiers: { multiply: { speedMul: Number.NaN } }
        }),
        /invalid build modifiers/
    );
});

test('the integrated arsenal keeps the complete 82-part catalog described', () => {
    assert.equal(Object.keys(PartsLibrary).length, 82);
    for (const [id, definition] of Object.entries(PartsLibrary)) {
        assert.equal(definition.id, id);
        assert.equal(typeof definition.description, 'string');
        assert.notEqual(definition.description.trim(), '');
    }
});
