
import { strict as assert } from 'node:assert';
import { Collision } from '../src/shared/CollisionSystem.js';

console.log('Running CollisionSystem tests...');

// Helper for test logging
function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (e) {
        console.error(`❌ ${name}`);
        console.error(e);
        process.exit(1);
    }
}

// -----------------------------------------------------------------------------
// beamCircle Tests
// -----------------------------------------------------------------------------

// 1. Horizontal Beam (0 degrees)
// Origin at (100, 100), length 200 (end at 300, 100), width 10.
// Effective hit width = width + circle radius.
// Circle radius 5. Hit range = 10 + 5 = 15.

test('Horizontal Beam: Direct Hit (Center)', () => {
    // Circle at (200, 100) -> Center of beam
    const hit = Collision.beamCircle(100, 100, 0, 200, 10, 200, 100, 5);
    assert.strictEqual(hit, true, 'Should hit center of beam');
});

test('Horizontal Beam: Hit (Edge of Width)', () => {
    // Circle at (200, 114) -> 14 units away from center (y). Radius 5.
    // Beam width 10. Max distance = 10 + 5 = 15.
    // 14 < 15 -> True.
    const hit = Collision.beamCircle(100, 100, 0, 200, 10, 200, 114, 5);
    assert.strictEqual(hit, true, 'Should hit near edge of width');
});

test('Horizontal Beam: Miss (Outside Width)', () => {
    // Circle at (200, 116) -> 16 units away from center (y).
    // 16 > 15 -> False.
    const hit = Collision.beamCircle(100, 100, 0, 200, 10, 200, 116, 5);
    assert.strictEqual(hit, false, 'Should miss outside width');
});

test('Horizontal Beam: Miss (Before Start)', () => {
    // Circle at (90, 100) -> 10 units before start (x).
    // localX = -10. 0 < -10 -> False.
    const hit = Collision.beamCircle(100, 100, 0, 200, 10, 90, 100, 5);
    assert.strictEqual(hit, false, 'Should miss before start');
});

test('Horizontal Beam: Miss (After End)', () => {
    // Circle at (310, 100) -> 10 units after end (x).
    // localX = 210. 210 < 200 -> False.
    const hit = Collision.beamCircle(100, 100, 0, 200, 10, 310, 100, 5);
    assert.strictEqual(hit, false, 'Should miss after end');
});

// 2. Vertical Beam (90 degrees / PI/2)
// Origin (100, 100), length 200, pointing DOWN (positive Y).
// Angle = PI/2.
// Circle radius 5.

test('Vertical Beam: Direct Hit', () => {
    // Circle at (100, 200) -> Center of beam (y=200 is 100 units down)
    const hit = Collision.beamCircle(100, 100, Math.PI/2, 200, 10, 100, 200, 5);
    assert.strictEqual(hit, true, 'Should hit vertical beam');
});

test('Vertical Beam: Miss (Side)', () => {
    // Circle at (120, 200) -> 20 units right.
    // Hit range = 10 + 5 = 15.
    // 20 > 15 -> False.
    const hit = Collision.beamCircle(100, 100, Math.PI/2, 200, 10, 120, 200, 5);
    assert.strictEqual(hit, false, 'Should miss vertical beam to the side');
});

// 3. Diagonal Beam (45 degrees / PI/4)
// Origin (0,0), length ~141.4. Pointing to (100, 100).

test('Diagonal Beam: Direct Hit', () => {
    // Circle at (50, 50) -> On the line y=x.
    // Distance from origin = sqrt(50^2 + 50^2) = 70.71.
    // 70.71 < 200 -> True.
    const hit = Collision.beamCircle(0, 0, Math.PI/4, 200, 10, 50, 50, 5);
    assert.strictEqual(hit, true, 'Should hit diagonal beam');
});

test('Diagonal Beam: Miss (Perpendicular)', () => {
    // Circle at (0, 100) -> Off the line y=x.
    // Beam width 10. Radius 5.
    // Distance from (0,0) to line y=x is |Ax + By + C| / sqrt(A^2+B^2) or just use localY logic.
    // localY should be > 15.
    const hit = Collision.beamCircle(0, 0, Math.PI/4, 200, 10, 0, 100, 5);
    assert.strictEqual(hit, false, 'Should miss diagonal beam');
});

// 4. Boundary / Edge Cases (Documenting Limitation)
test('Boundary: Center exactly at Start', () => {
    // Circle at (100, 100) -> localX = 0.
    // 0 > 0 -> False.
    // This confirms the beam starts *after* the origin point for center checks.
    const hit = Collision.beamCircle(100, 100, 0, 200, 10, 100, 100, 5);
    assert.strictEqual(hit, false, 'Should miss if center is exactly at start (strict inequality)');
});

test('Boundary: Center exactly at End', () => {
    // Circle at (300, 100) -> localX = 200.
    // 200 < 200 -> False.
    const hit = Collision.beamCircle(100, 100, 0, 200, 10, 300, 100, 5);
    assert.strictEqual(hit, false, 'Should miss if center is exactly at end (strict inequality)');
});

console.log('All tests passed!');
