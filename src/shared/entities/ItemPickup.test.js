import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { ItemPickup } = await import('./ItemPickup.js');

test('item pickup attraction stays finite at the exact player center', () => {
    const pickup = new ItemPickup(100, 100, 'core', () => 0);

    pickup.update(0.1, { x: 100, y: 100 });

    assert.equal(Number.isFinite(pickup.x), true);
    assert.equal(Number.isFinite(pickup.y), true);
    assert.equal(Number.isFinite(pickup.vx), true);
    assert.equal(Number.isFinite(pickup.vy), true);
    assert.equal(pickup.x, 100.95);
    assert.equal(pickup.y, 100);
});
