import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_ENEMY_BLUEPRINTS } from '../../shared/enemies/EnemyBlueprints.js';
import {
    buildEnemyLabManifest,
    parseEnemyLabManifest,
    serializeEnemyLabManifest
} from './EnemyLabManifest.js';
import { EnemyLabDraftStore } from './EnemyLabDraftStore.js';

test('enemy lab manifest round-trips every concept without touching part art', () => {
    const manifest = buildEnemyLabManifest(BASE_ENEMY_BLUEPRINTS, '2026-08-13T00:00:00.000Z');
    const parsed = parseEnemyLabManifest(serializeEnemyLabManifest(manifest));
    assert.equal(parsed.enemies.length, 30);
    assert.equal(parsed.enemies[0].combatReady, false);
    assert.equal('visuals' in parsed, false);
    assert.equal('sounds' in parsed, false);
});

test('manifest rejects missing ships and unknown ids', () => {
    const manifest = buildEnemyLabManifest(BASE_ENEMY_BLUEPRINTS);
    manifest.enemies.pop();
    assert.throws(() => parseEnemyLabManifest(JSON.stringify(manifest)), /30/);
    manifest.enemies.push({ ...structuredClone(BASE_ENEMY_BLUEPRINTS.nail), id: 'intruder' });
    assert.throws(() => parseEnemyLabManifest(JSON.stringify(manifest)), /unknown|duplicate/);
});

test('draft store tracks dirty work and resets only the selected ship', () => {
    let raw = null;
    const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
    const store = new EnemyLabDraftStore(storage);
    const nail = store.get('nail');
    nail.name = 'new nail';
    store.set(nail);
    assert.equal(store.isDirty('nail'), true);
    store.save('nail');
    assert.equal(store.isDirty('nail'), false);
    store.reset('nail');
    assert.equal(store.get('nail').name, 'nail');
    assert.ok(raw.includes('new nail'));
});
