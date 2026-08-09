import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(relativePath) {
    return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('pre-present world and gameplay modules contain no informational overlay drawing', async () => {
    const [worldScene, entityRenderer, remotePlayer, transientEffects] = await Promise.all([
        source('./WorldSceneRenderer.js'),
        source('./EntityRenderer.js'),
        source('../../engine/RemotePlayer.js'),
        source('../systems/TransientEffectsSystem.js')
    ]);

    assert.doesNotMatch(worldScene, /fillText|drawTooltip|drawHealthBar/);
    assert.doesNotMatch(entityRenderer, /fillText|UI_FONTS|drawHealthBar|drawShopPrice/);
    assert.doesNotMatch(remotePlayer, /drawHealthBar|fillText/);
    assert.doesNotMatch(transientEffects, /drawWorld|drawDamageNumbers|drawNotifications|fillText|renderer\.ctx/);
});
