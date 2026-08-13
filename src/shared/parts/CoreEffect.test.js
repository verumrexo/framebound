import test from 'node:test';
import assert from 'node:assert/strict';
import { coreEffectDrawAnchor } from './CoreEffect.js';

test('core effect draw anchor converts authored half-pixel pivots for every renderer', () => {
    assert.deepEqual(
        coreEffectDrawAnchor({ width: 16, height: 16 }, { x: 7.5, y: 8.5 }),
        { x: 7.5 / 16, y: 8.5 / 16 }
    );
    assert.deepEqual(
        coreEffectDrawAnchor({ width: 8, height: 8 }),
        { x: 0.5, y: 0.5 }
    );
});
