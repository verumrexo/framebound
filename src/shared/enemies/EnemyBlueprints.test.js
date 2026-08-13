import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BASE_ENEMY_BLUEPRINTS,
    EnemyBlueprints,
    getEnemyBlueprint,
    normalizeEnemyBlueprint,
    validateCombatReadyBlueprint,
    validateEnemyBlueprints
} from './EnemyBlueprints.js';

test('new roster is exactly 15 basic, 5 specialist, 5 elite, and 5 bastards', () => {
    assert.equal(validateEnemyBlueprints(), true);
    const counts = Object.values(EnemyBlueprints).reduce((result, entry) => {
        result[entry.tier] = (result[entry.tier] || 0) + 1;
        return result;
    }, {});
    assert.deepEqual(counts, { basic: 15, specialist: 5, elite: 5, bastard: 5 });
    for (const removed of ['basic', 'striker', 'rocketeer', 'sniper', 'circler', 'hive_carrier', 'bulwark']) {
        assert.equal(Object.hasOwn(EnemyBlueprints, removed), false);
    }
});

test('every concept starts blank, unpublished, and has useful eli5 copy', () => {
    for (const entry of Object.values(EnemyBlueprints)) {
        assert.equal(entry.combatReady, false);
        assert.deepEqual(entry.parts, []);
        assert.ok(entry.description.length >= 60);
        assert.match(entry.description, /tier|bastard/);
    }
    assert.equal(getEnemyBlueprint('nail'), null);
    assert.equal(getEnemyBlueprint('nail', { allowDraft: true }).name, 'nail');
});

test('normalization clamps behavior and deep clones draft data', () => {
    const source = structuredClone(BASE_ENEMY_BLUEPRINTS.nail);
    source.behavior.speed = 9999;
    source.behavior.dodgeChance = -4;
    source.floor = { min: 9, max: 2 };
    const normalized = normalizeEnemyBlueprint(source);
    assert.equal(normalized.behavior.speed, 500);
    assert.equal(normalized.behavior.dodgeChance, 0);
    assert.deepEqual(normalized.floor, { min: 9, max: 9 });
    normalized.behavior.speed = 40;
    assert.notEqual(BASE_ENEMY_BLUEPRINTS.nail.behavior.speed, 40);
});

test('combat readiness requires one core, a meaningful role, and connected geometry', () => {
    const empty = structuredClone(BASE_ENEMY_BLUEPRINTS.nail);
    assert.equal(validateCombatReadyBlueprint(empty).valid, false);
    empty.parts = [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: 1, y: 0, partId: 'gun_basic', rotation: 0 }
    ];
    assert.deepEqual(validateCombatReadyBlueprint(empty), { valid: true, errors: [] });
    empty.parts[1].x = 5;
    assert.match(validateCombatReadyBlueprint(empty).errors.join(' '), /connect/);
});

test('invalid part ids fail before runtime spawning', () => {
    const broken = structuredClone(BASE_ENEMY_BLUEPRINTS.nail);
    broken.parts = [{ x: 0, y: 0, rotation: 0, partId: 'missing' }];
    assert.throws(() => normalizeEnemyBlueprint(broken), /invalid part geometry/);
});
