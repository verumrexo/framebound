import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Collision } from '../src/game/systems/CollisionSystem.js';

describe('CollisionSystem', () => {
    describe('separateCircles', () => {
        it('should separate horizontally overlapping circles', () => {
            const a = { x: 0, y: 0 };
            const b = { x: 2, y: 0 };
            // Simulate: radius A = 2, radius B = 2.
            // Distance = 2. MinDist = 4. Overlap = 2.
            const dist = 2;
            const overlap = 2;
            const dx = 2; // b.x - a.x
            const dy = 0; // b.y - a.y

            // Expected calculation:
            // pen = overlap / 2 = 1
            // nx = dx / dist = 1
            // ny = dy / dist = 0
            // a.x -= nx * pen => 0 - 1 = -1
            // b.x += nx * pen => 2 + 1 = 3

            Collision.separateCircles(a, b, overlap, dx, dy, dist);

            assert.strictEqual(a.x, -1, 'Object A should move left');
            assert.strictEqual(a.y, 0, 'Object A Y should not change');
            assert.strictEqual(b.x, 3, 'Object B should move right');
            assert.strictEqual(b.y, 0, 'Object B Y should not change');
        });

        it('should separate vertically overlapping circles', () => {
            const a = { x: 0, y: 0 };
            const b = { x: 0, y: 2 };
            const dist = 2;
            const overlap = 2;
            const dx = 0;
            const dy = 2;

            // pen = 1
            // nx = 0, ny = 1
            // a.y -= 1 = -1
            // b.y += 1 = 3

            Collision.separateCircles(a, b, overlap, dx, dy, dist);

            assert.strictEqual(a.x, 0);
            assert.strictEqual(a.y, -1);
            assert.strictEqual(b.x, 0);
            assert.strictEqual(b.y, 3);
        });

        it('should handle perfect overlap (dist=0)', () => {
            const a = { x: 5, y: 5 };
            const b = { x: 5, y: 5 };
            const dist = 0;
            const overlap = 4;
            const dx = 0;
            const dy = 0;

            // Logic in code:
            // if (dist === 0) { dx = 1; dy = 0; dist = 1; }
            // nx = 1, ny = 0
            // pen = 4/2 = 2
            // a.x -= 2 => 3
            // b.x += 2 => 7

            Collision.separateCircles(a, b, overlap, dx, dy, dist);

            assert.strictEqual(a.x, 3);
            assert.strictEqual(a.y, 5);
            assert.strictEqual(b.x, 7);
            assert.strictEqual(b.y, 5);
        });

        it('should handle diagonal separation correctly', () => {
            // 3-4-5 triangle setup
            // A at 0,0. B at 3,4. Dist = 5.
            const a = { x: 0, y: 0 };
            const b = { x: 3, y: 4 };
            const dist = 5;
            // Let overlap be 2
            const overlap = 2;
            const dx = 3;
            const dy = 4;

            // pen = 1
            // nx = 3/5 = 0.6
            // ny = 4/5 = 0.8
            // a.x -= 0.6 * 1 = -0.6
            // a.y -= 0.8 * 1 = -0.8
            // b.x += 0.6 * 1 = 3.6
            // b.y += 0.8 * 1 = 4.8

            Collision.separateCircles(a, b, overlap, dx, dy, dist);

            assert.ok(Math.abs(a.x - (-0.6)) < 0.0001);
            assert.ok(Math.abs(a.y - (-0.8)) < 0.0001);
            assert.ok(Math.abs(b.x - 3.6) < 0.0001);
            assert.ok(Math.abs(b.y - 4.8) < 0.0001);
        });
    });
});
