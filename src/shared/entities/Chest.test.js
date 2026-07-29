import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Assets } = await import('../../Assets.js');
const { TreasureChest } = await import('./TreasureChest.js');
const { VaultChest } = await import('./VaultChest.js');

function createRenderer() {
    const textCalls = [];
    let fillStyle = null;

    const ctx = {
        set fillStyle(value) {
            fillStyle = value;
        },
        get fillStyle() {
            return fillStyle;
        },
        strokeStyle: null,
        lineWidth: 0,
        font: '',
        textAlign: 'left',
        fillRect() {},
        strokeRect() {},
        fillText(text) {
            textCalls.push({ text, fillStyle });
        }
    };

    return {
        renderer: { ctx },
        textCalls
    };
}

test('treasure and vault chests construct with the shared chest sprite', () => {
    const treasure = new TreasureChest(100, 200, () => 0.25);
    const vault = new VaultChest(300, 400, 'gold', 50, () => 0.5);

    assert.equal(treasure.sprite, Assets.TreasureChest);
    assert.equal(vault.sprite, Assets.TreasureChest);
});

test('gold vault tooltip uses the game gold value passed by the caller', () => {
    const vault = new VaultChest(100, 200, 'gold', 50, () => 0);
    const { renderer, textCalls } = createRenderer();

    vault.drawTooltip(renderer, 100, 75);

    assert.deepEqual(textCalls.at(-1), {
        text: '[E] Pay 50 Gold ',
        fillStyle: '#44ff44'
    });
});
