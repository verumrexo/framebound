import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { drawDebugHitboxes } = await import('./DebugHitboxRenderer.js');
const { TILE_SIZE } = await import('../../shared/parts/Part.js');

function createGame(showHitboxes) {
    const calls = [];
    const ctx = {
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        translate: (x, y) => calls.push(['translate', x, y]),
        rotate: (angle) => calls.push(['rotate', angle]),
        strokeRect: (...args) => calls.push(['strokeRect', ...args]),
        beginPath: () => calls.push(['beginPath']),
        arc: (...args) => calls.push(['arc', ...args]),
        stroke: () => calls.push(['stroke'])
    };

    return {
        calls,
        game: {
            devTools: { showHitboxes },
            renderer: { ctx },
            enemies: [],
            bosses: [],
            drones: [],
            playerShip: {
                getUniqueParts: () => [{
                    x: 0,
                    y: 0,
                    partId: 'core',
                    rotation: 0
                }]
            },
            x: 10,
            y: 20,
            rotation: 0
        }
    };
}

test('debug hitboxes do no canvas work while disabled', () => {
    const { calls, game } = createGame(false);

    drawDebugHitboxes(game, 1, 0);

    assert.deepEqual(calls, []);
});

test('debug hitboxes preserve the player part rectangle geometry', () => {
    const { calls, game } = createGame(true);

    drawDebugHitboxes(game, 1, 0);

    assert.deepEqual(calls.filter(([name]) => name === 'translate'), [
        ['translate', 10, 20]
    ]);
    assert.deepEqual(calls.filter(([name]) => name === 'strokeRect'), [
        ['strokeRect', -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE]
    ]);
    assert.equal(calls[0][0], 'save');
    assert.equal(calls.at(-1)[0], 'restore');
});
