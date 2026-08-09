import test from 'node:test';
import assert from 'node:assert/strict';
import { SalvageSweepSystem, easeSweep } from './SalvageSweepSystem.js';

function createHarness() {
    const sounds = [];
    const drops = [];
    const room = {
        gridX: 1,
        gridY: 0,
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        cleared: true,
        sweepUsed: false,
        sweepChargeRemaining: null,
        contains: (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 1000
    };
    const asteroid = {
        x: 600,
        y: 500,
        hp: 1,
        radius: 20,
        isDead: false,
        isBroken: false,
        takeDamage() {
            this.isBroken = true;
            return true;
        }
    };
    const crate = {
        x: 400,
        y: 500,
        hp: 1,
        radius: 15,
        isOpened: false,
        takeDamage() {
            this.isOpened = true;
            return true;
        }
    };
    let rPressed = false;
    const game = {
        currentRoom: room,
        asteroids: [asteroid],
        lootCrates: [crate],
        x: 500,
        y: 500,
        input: { isKeyPressed: () => rPressed },
        audio: { play: name => sounds.push(name) },
        showNotification: () => {},
        spawnAsteroidLoot: () => drops.push('asteroid'),
        spawnCrateLoot: () => drops.push('crate'),
        spawnExplosion: () => {}
    };
    const system = new SalvageSweepSystem(game);
    return {
        game,
        room,
        asteroid,
        crate,
        sounds,
        drops,
        system,
        pressR: () => { rPressed = true; }
    };
}

test('salvage sweep charges for five seconds and clears debris during one turn', () => {
    const harness = createHarness();
    harness.system.update(4.9);
    assert.equal(harness.system.status, 'charging');
    harness.system.update(0.1);
    assert.equal(harness.system.status, 'ready');

    harness.pressR();
    harness.system.update(0);
    assert.equal(harness.system.status, 'sweeping');
    harness.system.update(1);

    assert.equal(harness.asteroid.isBroken, true);
    assert.equal(harness.crate.isOpened, true);
    assert.deepEqual(harness.drops.sort(), ['asteroid', 'crate']);
    assert.equal(harness.room.sweepUsed, true);
    assert.equal(harness.system.status, 'idle');
});

test('sweep easing starts and ends slow while completing one clockwise turn', () => {
    assert.equal(easeSweep(0), 0);
    assert.equal(easeSweep(0.5), 0.5);
    assert.equal(easeSweep(1), 1);
    assert.ok(easeSweep(0.1) < 0.001);
    assert.ok(easeSweep(0.9) > 0.999);
});
