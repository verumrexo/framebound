import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Assets } = await import('../../Assets.js');
const { TreasureChest } = await import('./TreasureChest.js');
const { VaultChest } = await import('./VaultChest.js');

test('treasure and vault chests construct with the shared chest sprite', () => {
    const treasure = new TreasureChest(100, 200, () => 0.25);
    const vault = new VaultChest(300, 400, 'gold', 50, () => 0.5);

    assert.equal(treasure.sprite, Assets.TreasureChest);
    assert.equal(vault.sprite, Assets.TreasureChest);
});

test('chest models do not own hud tooltip rendering', () => {
    const vault = new VaultChest(100, 200, 'gold', 50, () => 0);
    assert.equal('drawTooltip' in vault, false);
});
