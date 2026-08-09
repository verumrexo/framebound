import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workshop dom panels stay above the native hud canvas', async () => {
    const css = await readFile(new URL('../../style.css', import.meta.url), 'utf8');
    const hudRules = [...css.matchAll(/\[data-render-surface="hud"\]\s*\{([^}]*)\}/g)]
        .map(match => match[1]);
    const workshopRule = css.match(/#hangar-ui,\s*#ship-builder-ui\s*\{([^}]*)\}/)?.[1] || '';

    assert.ok(hudRules.some(rule => /z-index:\s*1\s*;/.test(rule)));
    assert.match(workshopRule, /z-index:\s*2\s*;/);
    assert.match(workshopRule, /pointer-events:\s*none\s*;/);
});
