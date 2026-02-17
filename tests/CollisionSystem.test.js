import assert from 'node:assert';
import { Collision } from '../src/game/systems/CollisionSystem.js';

console.log('🧪 Running CollisionSystem tests...');

// Counter for passed tests
let passed = 0;
let total = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`❌ ${name}`);
        console.error(e);
        process.exit(1); // Fail fast
    }
}

// Test Suite
test('Collision.circleCircle: No Collision (Far apart)', () => {
    // Circle A at (0,0) radius 10
    // Circle B at (100,100) radius 10
    // Distance is sqrt(20000) ≈ 141.4 > 20
    const result = Collision.circleCircle(0, 0, 10, 100, 100, 10);
    assert.strictEqual(result, false, 'Circles far apart should not collide');
});

test('Collision.circleCircle: Collision (Overlapping)', () => {
    // Circle A at (0,0) radius 10
    // Circle B at (10,0) radius 10
    // Distance is 10 < 20
    const result = Collision.circleCircle(0, 0, 10, 10, 0, 10);
    assert.strictEqual(result, true, 'Overlapping circles should collide');
});

test('Collision.circleCircle: Touching (Exact edge case)', () => {
    // Circle A at (0,0) radius 10
    // Circle B at (20,0) radius 10
    // Distance is 20 == 20 (Radius Sum)
    // Implementation uses <, so this should be false
    const result = Collision.circleCircle(0, 0, 10, 20, 0, 10);
    assert.strictEqual(result, false, 'Touching circles should not collide (strict inequality)');
});

test('Collision.circleCircle: Just Inside (Epsilon overlap)', () => {
    // Circle A at (0,0) radius 10
    // Circle B at (19.9,0) radius 10
    // Distance is 19.9 < 20
    const result = Collision.circleCircle(0, 0, 10, 19.9, 0, 10);
    assert.strictEqual(result, true, 'Slightly overlapping circles should collide');
});

test('Collision.circleCircle: Contained (Concentric)', () => {
    // Circle A at (0,0) radius 20
    // Circle B at (0,0) radius 5
    // Distance is 0 < 25
    const result = Collision.circleCircle(0, 0, 20, 0, 0, 5);
    assert.strictEqual(result, true, 'Concentric/contained circles should collide');
});

test('Collision.circleCircle: Zero Radius (Point vs Circle)', () => {
    // Circle A at (0,0) radius 10
    // Point B at (5,0) radius 0
    // Distance 5 < 10
    const result = Collision.circleCircle(0, 0, 10, 5, 0, 0);
    assert.strictEqual(result, true, 'Point inside circle should collide');
});

test('Collision.circleCircle: Zero Radius No Collision', () => {
    // Circle A at (0,0) radius 10
    // Point B at (15,0) radius 0
    // Distance 15 > 10
    const result = Collision.circleCircle(0, 0, 10, 15, 0, 0);
    assert.strictEqual(result, false, 'Point outside circle should not collide');
});

console.log(`\n🎉 All ${total} tests passed!`);
