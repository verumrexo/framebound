import test from 'node:test';
import assert from 'node:assert/strict';
import { PartType } from './PartDefinitions.js';
import {
    validatePartDefinition,
    validatePartsLibrary
} from './PartDefinitionValidation.js';

function makePart(overrides = {}) {
    return {
        id: 'test_part',
        name: 'test part',
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
