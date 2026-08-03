import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EnemyBlueprints,
    getEnemyBlueprint,
    validateEnemyBlueprints
} from './EnemyBlueprints.js';
import { Enemy } from '../entities/Enemy.js';

test('enemy blueprints keep every existing body editable and valid', () => {
    assert.equal(validateEnemyBlueprints(), true);
    assert.deepEqual(Object.keys(EnemyBlueprints).sort(), [
        'basic',
        'bulwark',
        'circler',
        'hive_carrier',
        'interceptor',
        'repair_tender',
        'rocketeer',
        'sniper',
        'striker'
    ]);
});

test('runtime enemy bodies are cloned away from editable manifests', () => {
    const first = getEnemyBlueprint('striker');
    const second = getEnemyBlueprint('striker');
    first.parts[0].x = 99;

    assert.notEqual(first.parts, second.parts);
    assert.equal(second.parts[0].x, 0);
    assert.equal(EnemyBlueprints.striker.parts[0].x, 0);
});

test('invalid enemy blueprint part ids fail before runtime spawning', () => {
    assert.throws(() => validateEnemyBlueprints({
        broken: {
            behavior: 'pursuer',
            stats: { ...EnemyBlueprints.basic.stats },
            parts: [{ x: 0, y: 0, rotation: 0, partId: 'missing' }]
        }
    }, {}), /unknown part/);
});

test('enemy runtime clones the selected editable body and tuning', () => {
    const enemy = new Enemy(10, 20, 'circler', 1, () => 0.25, 'enemy-a');

    assert.equal(enemy.behavior, 'orbiter');
    assert.equal(enemy.speed, EnemyBlueprints.circler.stats.speed);
    assert.deepEqual(enemy.shipParts, EnemyBlueprints.circler.parts);
    assert.notEqual(enemy.shipParts, EnemyBlueprints.circler.parts);
});
