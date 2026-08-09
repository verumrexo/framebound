import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { RemotePlayer } from './RemotePlayer.js';

test('remote snapshots retain only the newest twenty samples', (t) => {
    let now = 1000;
    t.mock.method(Date, 'now', () => now++);
    const player = new RemotePlayer('peer');

    for (let index = 0; index < 25; index++) {
        player.addSnapshot({
            x: index,
            y: index * 2,
            rotation: 0
        });
    }

    assert.equal(player.interpolationBuffer.length, 20);
    assert.equal(player.interpolationBuffer[0].x, 5);
    assert.equal(player.interpolationBuffer.at(-1).x, 24);
});

test('remote interpolation crosses the rotation seam by the shortest path', (t) => {
    t.mock.method(Date, 'now', () => 1100);
    const player = new RemotePlayer('peer');
    player.INTERPOLATION_DELAY = 100;
    player.interpolationBuffer = [
        {
            timestamp: 900,
            x: 0,
            y: 20,
            rotation: Math.PI - 0.1,
            hp: 80,
            maxHp: 120,
            input: { up: true },
            stealthTimer: 4
        },
        {
            timestamp: 1100,
            x: 100,
            y: 40,
            rotation: -Math.PI + 0.1,
            stealthTimer: 2
        }
    ];

    player.update(0.016);

    assert.equal(player.x, 50);
    assert.equal(player.y, 30);
    assert.ok(Math.abs(Math.abs(player.rotation) - Math.PI) < 1e-9);
    assert.equal(player.hp, 80);
    assert.equal(player.maxHp, 120);
    assert.deepEqual(player.input, { up: true });
    assert.equal(player.stealthTimer, 3);
});

test('remote interpolation falls back to oldest and latest snapshots safely', (t) => {
    let now = 950;
    t.mock.method(Date, 'now', () => now);
    const player = new RemotePlayer('peer');
    player.INTERPOLATION_DELAY = 100;
    player.interpolationBuffer = [
        { timestamp: 900, x: 10, y: 20, rotation: 0.25 },
        { timestamp: 1000, x: 30, y: 40, rotation: 0.75 }
    ];

    player.update(0.016);
    assert.deepEqual(
        { x: player.x, y: player.y, rotation: player.rotation },
        { x: 10, y: 20, rotation: 0.25 }
    );

    now = 1200;
    player.update(0.016);
    assert.deepEqual(
        { x: player.x, y: player.y, rotation: player.rotation },
        { x: 30, y: 40, rotation: 0.75 }
    );
});

test('remote snapshots propagate death and suspension state', (t) => {
    t.mock.method(Date, 'now', () => 1200);
    const player = new RemotePlayer('peer');
    player.INTERPOLATION_DELAY = 100;
    player.addSnapshot({
        x: 10,
        y: 20,
        rotation: 0,
        hp: 0,
        maxHp: 100,
        isDead: true,
        suspended: true
    });
    player.interpolationBuffer[0].timestamp = 1000;

    player.update(0.016);

    assert.equal(player.hp, 0);
    assert.equal(player.isDead, true);
    assert.equal(player.suspended, true);
});

test('older interpolation samples cannot roll back discrete death state', (t) => {
    t.mock.method(Date, 'now', () => 1200);
    const player = new RemotePlayer('peer');
    player.INTERPOLATION_DELAY = 100;
    player.interpolationBuffer = [{
        timestamp: 1000,
        x: 10,
        y: 20,
        rotation: 0,
        isDead: false,
        suspended: false
    }];
    player.addSnapshot({
        x: 30,
        y: 40,
        rotation: 0,
        isDead: true,
        suspended: true
    });
    player.interpolationBuffer[1].timestamp = 1200;

    player.update(0.016);

    assert.equal(player.isDead, true);
    assert.equal(player.suspended, true);
});

test('remote stealth survives oldest and latest snapshot fallback paths', (t) => {
    t.mock.method(Date, 'now', () => 950);
    const player = new RemotePlayer('peer');
    player.INTERPOLATION_DELAY = 100;
    player.interpolationBuffer = [{
        timestamp: 900,
        x: 10,
        y: 20,
        rotation: 0,
        stealthTimer: 2.5
    }];

    player.update(0.016);
    assert.equal(player.stealthTimer, 2.5);

    player.interpolationBuffer.push({
        timestamp: 1000,
        x: 30,
        y: 40,
        rotation: 0,
        stealthTimer: 1
    });
    t.mock.method(Date, 'now', () => 1200);
    player.update(0.016);
    assert.equal(player.stealthTimer, 1);
});
