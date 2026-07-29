import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Drone } = await import('./Drone.js');
const { Portal } = await import('./Portal.js');
const { TrainingDummy } = await import('./TrainingDummy.js');

test('migrated sprite-backed entities construct without missing runtime imports', () => {
    const originalLog = console.log;
    console.log = () => {};

    try {
        const drone = new Drone(10, 20, null, 'player', () => 0.5);
        const portal = new Portal(30, 40);
        const dummy = new TrainingDummy(50, 60);

        assert.equal(drone.sprite.width, 8);
        assert.equal(portal.sprite.width, 8);
        assert.equal(dummy.sprite.width, 8);
    } finally {
        console.log = originalLog;
    }
});
