import test from 'node:test';
import assert from 'node:assert/strict';
import {
    hasReleaseVersionBadge,
    hasSupportedNodeRequirement
} from './release-version-readme.mjs';

test('release badge matches the package prerelease version', () => {
    const readme = 'https://img.shields.io/badge/version-1.1.0--beta-78ff96';

    assert.equal(hasReleaseVersionBadge(readme, '1.1.0-beta'), true);
    assert.equal(hasReleaseVersionBadge(readme, '1.1.1-beta'), false);
});

test('node requirement accepts clear equivalent wording', () => {
    assert.equal(hasSupportedNodeRequirement('node.js 22.12 or newer'), true);
    assert.equal(hasSupportedNodeRequirement('node 22.12+'), true);
    assert.equal(hasSupportedNodeRequirement('node.js 20 or newer'), false);
});
