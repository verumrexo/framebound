import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_ENEMY_BLUEPRINTS } from './EnemyBlueprints.js';
import { getEligibleEnemies, selectEnemyType } from './EnemyRoster.js';

function ready(id, floor, weight = 1, role = 'standard') {
    return {
        ...structuredClone(BASE_ENEMY_BLUEPRINTS[id]), combatReady: true,
        encounterRole: role, floor, spawnWeight: weight,
        parts: [{ x: 0, y: 0, partId: 'core', rotation: 0 }, { x: 1, y: 0, partId: 'gun_basic', rotation: 0 }]
    };
}

test('selection filters readiness, floor, and encounter role', () => {
    const blueprints = {
        nail: ready('nail', { min: 1, max: 2 }, 1),
        wasp: ready('wasp', { min: 3, max: 8 }, 2),
        widowmaker: ready('widowmaker', { min: 2, max: 9 }, 1, 'boss')
    };
    assert.deepEqual(getEligibleEnemies(1, { blueprints }).map(enemy => enemy.id), ['nail']);
    assert.equal(selectEnemyType(3, 0, { blueprints }), 'wasp');
    assert.equal(selectEnemyType(4, 0, { blueprints, role: 'boss' }), 'widowmaker');
    assert.equal(selectEnemyType(1, 0, { blueprints, role: 'boss' }), null);
});

test('weighted selection is deterministic and an empty roster returns null', () => {
    const blueprints = {
        nail: ready('nail', { min: 1, max: 9 }, 1),
        wasp: ready('wasp', { min: 1, max: 9 }, 3)
    };
    assert.equal(selectEnemyType(1, 0.1, { blueprints }), 'nail');
    assert.equal(selectEnemyType(1, 0.3, { blueprints }), 'wasp');
    assert.equal(selectEnemyType(1, 0.5, { blueprints: {} }), null);
});
