import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePartLabDevelopmentFlag } from './PartLabEnvironment.js';

test('part lab development gate is explicit and production-safe', () => {
    assert.equal(resolvePartLabDevelopmentFlag({ viteDev: false, runtimeFlag: false }), false);
    assert.equal(resolvePartLabDevelopmentFlag({ viteDev: true, runtimeFlag: false }), true);
    assert.equal(resolvePartLabDevelopmentFlag({ viteDev: false, runtimeFlag: true }), true);
    assert.equal(resolvePartLabDevelopmentFlag({ viteDev: 'true', runtimeFlag: true }), true);
});
