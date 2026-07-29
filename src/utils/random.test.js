import assert from 'node:assert';
import { seededRandom } from './random.js';

function testDeterminism() {
    console.log('Testing seededRandom determinism...');
    const seed = 123456789;
    const rng1 = seededRandom(seed);
    const rng2 = seededRandom(seed);

    for (let i = 0; i < 1000; i++) {
        const val1 = rng1();
        const val2 = rng2();
        assert.strictEqual(val1, val2, `Values should be identical at iteration ${i} for seed ${seed}`);
    }
    console.log('✓ Same seed produces identical sequence');
}

function testDifferentSeeds() {
    console.log('Testing seededRandom different seeds...');
    const seed1 = 12345;
    const seed2 = 54321;
    const rng1 = seededRandom(seed1);
    const rng2 = seededRandom(seed2);

    let identicalCount = 0;
    for (let i = 0; i < 100; i++) {
        if (rng1() === rng2()) {
            identicalCount++;
        }
    }
    // It's statistically possible but extremely unlikely to have many identical values
    assert.ok(identicalCount < 5, 'Different seeds should produce different sequences');
    console.log('✓ Different seeds produce different sequences');
}

function testEdgeCases() {
    console.log('Testing seededRandom edge cases...');
    const edgeSeeds = [0, -1, 0xFFFFFFFF, 1.5, NaN, undefined];

    edgeSeeds.forEach(seed => {
        const rng1 = seededRandom(seed);
        const rng2 = seededRandom(seed);
        assert.strictEqual(rng1(), rng2(), `Determinism failed for edge case seed: ${seed}`);
    });
    console.log('✓ Edge cases handled deterministically');
}

function testSerializableState() {
    console.log('Testing seededRandom state snapshots...');
    const rng = seededRandom(77);
    rng();
    rng();
    const savedState = rng.getState();
    const expected = [rng(), rng(), rng()];

    rng.setState(savedState);

    assert.deepStrictEqual([rng(), rng(), rng()], expected);
    console.log('✓ Saved state resumes the exact sequence');
}

try {
    testDeterminism();
    testDifferentSeeds();
    testEdgeCases();
    testSerializableState();
    console.log('\nAll seededRandom tests passed!');
} catch (error) {
    console.error('\nTests failed:');
    console.error(error);
    process.exit(1);
}
