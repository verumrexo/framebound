import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Decoy } = await import('./Decoy.js');

test('decoy keeps its identity and exposes the shared dead-state idiom', () => {
    const decoy = new Decoy('decoy-17', 120, 240, 'guest-2');

    assert.equal(decoy.id, 'decoy-17');
    assert.equal(decoy.type, 'decoy');
    assert.equal(decoy.x, 120);
    assert.equal(decoy.y, 240);
    assert.equal(decoy.ownerPlayerId, 'guest-2');
    assert.equal(decoy.maxHp, 35);
    assert.equal(decoy.hp, 35);
    assert.equal(decoy.duration, 6);
    assert.equal(decoy.life, 6);
    assert.equal(decoy.radius, 22);
    assert.equal(decoy.isDead, false);
    assert.equal(decoy.alive, true);
    assert.equal(decoy.dead, false);
});

test('decoy accepts balance overrides and expires at the end of its lifetime', () => {
    const decoy = new Decoy('short-lived', 0, 0, 'host', {
        maxHp: 50,
        hp: 40,
        duration: 2.5,
        radius: 30
    });

    assert.equal(decoy.maxHp, 50);
    assert.equal(decoy.hp, 40);
    assert.equal(decoy.duration, 2.5);
    assert.equal(decoy.life, 2.5);
    assert.equal(decoy.radius, 30);

    decoy.update(1);
    assert.equal(decoy.life, 1.5);
    assert.equal(decoy.isDead, false);

    decoy.update(2);
    assert.equal(decoy.life, 0);
    assert.equal(decoy.isDead, true);
    assert.equal(decoy.alive, false);
});

test('decoy damage clamps hp and kills it without going below zero', () => {
    const decoy = new Decoy('fragile', 0, 0, 'host', { hp: 10 });

    decoy.takeDamage(3);
    assert.equal(decoy.hp, 7);
    assert.equal(decoy.isDead, false);

    decoy.takeDamage(99);
    assert.equal(decoy.hp, 0);
    assert.equal(decoy.isDead, true);
    assert.equal(decoy.dead, true);

    decoy.update(10);
    decoy.takeDamage(5);
    assert.equal(decoy.life, 6);
    assert.equal(decoy.hp, 0);
});
