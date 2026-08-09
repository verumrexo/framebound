import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseOrb } from './BaseOrb.js';

test('base orb uses a safe default magnet range and collects at close range', () => {
    const orb = new BaseOrb(0, 0, 1);
    assert.equal(orb.update(0.1, 301, 0), false);
    assert.equal(orb.x, 0);
    assert.equal(orb.update(0.1, 100, 0, 2), false);
    assert.ok(orb.x > 0);

    const collected = new BaseOrb(0, 0, 1);
    assert.equal(collected.update(0.1, 20, 0, 2), true);
    assert.equal(collected.isDead, true);
});

test('invalid magnet multipliers fall back without producing non-finite motion', () => {
    const orb = new BaseOrb(0, 0, 1);
    assert.equal(orb.update(0.1, 100, 0, NaN), false);
    assert.ok(Number.isFinite(orb.x));
    assert.ok(Number.isFinite(orb.y));
});
