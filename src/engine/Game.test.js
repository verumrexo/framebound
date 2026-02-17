/**
 * Unit tests for Game engine.
 */

import '../tests/setup.js';
import { test, mock } from 'node:test';
import assert from 'node:assert';

test('Game.spawnExplosion adds explosion entity', async (t) => {
    // Mock external dependencies that fail to load in Node environment
    mock.module('@supabase/supabase-js', {
        namedExports: {
            createClient: () => ({
                from: () => ({
                    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
                    insert: () => Promise.resolve({ error: null }),
                    delete: () => ({ neq: () => Promise.resolve({ error: null }) })
                })
            })
        }
    });

    mock.module('socket.io-client', {
        namedExports: {
            io: () => ({ on: () => {}, emit: () => {}, connect: () => {} })
        }
    });

    // Dynamic import Game after mocks are set
    const { Game } = await import('./Game.js');

    // Test with a minimal mock Game object to verify the method in isolation
    // as suggested in the task rationale.
    const mockGame = {
        explosions: [],
        spawnExplosion: Game.prototype.spawnExplosion
    };

    // Test case 1: Basic explosion with all parameters
    mockGame.spawnExplosion(100, 200, 50, 0.5, '#ff0000');
    assert.strictEqual(mockGame.explosions.length, 1, 'Should add one explosion');
    assert.deepStrictEqual(mockGame.explosions[0], {
        x: 100,
        y: 200,
        radius: 50,
        life: 0.5,
        maxLife: 0.5,
        color: '#ff0000'
    }, 'Explosion properties should match input');

    // Test case 2: Default values
    mockGame.spawnExplosion(300, 400);
    assert.strictEqual(mockGame.explosions.length, 2, 'Should add a second explosion');
    assert.strictEqual(mockGame.explosions[1].radius, 50, 'Should use default radius');
    assert.strictEqual(mockGame.explosions[1].life, 0.5, 'Should use default duration');
    assert.strictEqual(mockGame.explosions[1].color, '#ffaa44', 'Should use default color');

    // Test case 3: Multiple explosions
    mockGame.spawnExplosion(0, 0, 10, 0.1, '#ffffff');
    assert.strictEqual(mockGame.explosions.length, 3, 'Should have 3 explosions in total');
});
