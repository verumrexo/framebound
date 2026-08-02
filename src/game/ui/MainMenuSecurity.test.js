import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from './html.js';

test('leaderboard values cannot inject markup into the menu', () => {
    assert.equal(
        escapeHtml(`<img src=x onerror="alert('x')">&`),
        '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
    );
    assert.equal(escapeHtml(1234), '1234');
});
