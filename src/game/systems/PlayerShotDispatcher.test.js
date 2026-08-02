import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchPlayerShot } from './PlayerShotDispatcher.js';

test('connected shots keep the local part state and announce the shot to peers', () => {
    const calls = [];
    const partRef = { partId: 'freeze-gun', shotCount: 4 };
    const def = { id: 'freeze-gun' };
    const game = {
        network: {
            isConnected: true,
            sendShoot: (data) => calls.push(['send', data])
        },
        spawnProjectile: (...args) => calls.push(['spawn', ...args])
    };

    dispatchPlayerShot(game, def, 10, 20, 0.5, partRef);

    assert.deepEqual(calls, [
        ['send', {
            partId: 'freeze-gun',
            x: 10,
            y: 20,
            angle: 0.5
        }],
        ['spawn', def, 10, 20, 0.5, partRef]
    ]);
});

test('offline shots spawn locally without network traffic', () => {
    const calls = [];
    const partRef = { partId: 'gun-basic' };
    const def = { id: 'gun-basic' };
    const game = {
        network: {
            isConnected: false,
            sendShoot: () => assert.fail('offline shot used the network')
        },
        spawnProjectile: (...args) => calls.push(args)
    };

    dispatchPlayerShot(game, def, 1, 2, 3, partRef);

    assert.deepEqual(calls, [[def, 1, 2, 3, partRef]]);
});
