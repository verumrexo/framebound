import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Shipwreck } = await import('./Shipwreck.js');

test('destroying the final wreck part marks the empty collision ghost dead', () => {
    const wreck = new Shipwreck(500, 600, 1, () => 0.5);
    wreck.ship.parts.clear();
    wreck.ship.addPart(0, 0, 'core', 0);
    const core = wreck.ship.getPart(0, 0);
    core.hp = 1;
    core.maxHp = 1;

    const result = wreck.takeDamage(1, 500, 600);

    assert.equal(result.destroyed, true);
    assert.equal(wreck.ship.parts.size, 0);
    assert.equal(wreck.isDead, true);
});
