import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePartStatsLiteral } from './PartStatsParser.js';

test('part stats parser preserves generated and historical literal data', () => {
    assert.deepEqual(parsePartStatsLiteral(`{
        hp: 80,
        mass: 8,
        projectileType: 'rocket_he',
        active: true,
        barrelPosition: { x: -12.5, y: 4 },
        stages: [1, 2, 3]
    }`), {
        hp: 80,
        mass: 8,
        projectileType: 'rocket_he',
        active: true,
        barrelPosition: { x: -12.5, y: 4 },
        stages: [1, 2, 3]
    });
});

test('part stats parser rejects executable expressions and pollution keys', () => {
    globalThis.__partImportExecuted = false;
    assert.equal(parsePartStatsLiteral(
        `{ hp: (() => { globalThis.__partImportExecuted = true })() }`
    ), null);
    assert.equal(globalThis.__partImportExecuted, false);
    assert.equal(parsePartStatsLiteral('{ __proto__: { admin: true } }'), null);
    assert.equal(parsePartStatsLiteral('{ damage: Infinity }'), null);
    delete globalThis.__partImportExecuted;
});

test('part stats parser rejects trailing garbage and oversized input', () => {
    assert.equal(parsePartStatsLiteral('{ hp: 20 } alert(1)'), null);
    assert.equal(parsePartStatsLiteral('x'.repeat(20_001)), null);
});
