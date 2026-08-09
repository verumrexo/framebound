import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldOverlayRenderer } from './WorldOverlayRenderer.js';

function createHarness() {
    const calls = [];
    const ctx = new Proxy({
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        fillText: text => calls.push(['text', text])
    }, {
        get(target, property) {
            return property in target ? target[property] : () => {};
        }
    });
    const renderer = {
        ctx,
        withWorldOverlay: (camera, draw) => {
            calls.push(['overlay-begin', camera]);
            draw();
            calls.push(['overlay-end']);
        }
    };
    const game = {
        renderer,
        camera: { x: 10, y: 20, zoom: 0.6 },
        floor: 1,
        rooms: [{ x: 0, y: 0, width: 400, height: 300, gridX: 0, gridY: 0 }],
        enemies: [
            { id: 'enemy', x: 10, y: 20, hp: 8, maxHp: 10 },
            { id: 'dummy', type: 'dummy', x: 10, y: 20, radius: 20, currentDps: 2 },
            { id: 'warping', x: 10, y: 20, hp: 8, maxHp: 10, isWarpingIn: true }
        ],
        bosses: [{ id: 'boss', x: 10, y: 20, hp: 8, maxHp: 10 }],
        network: { otherPlayers: new Map([['peer', { id: 'remote', x: 10, y: 20, hp: 20, maxHp: 100 }]]) },
        shopItems: [{ id: 'shop', x: 10, y: 20, radius: 40, life: 0, bobOffset: 0, purchased: false, data: { price: 6 } }],
        hoveredShopItem: { x: 10, y: 20, radius: 40, life: 0, bobOffset: 0, purchased: false, data: { price: 6, type: 'heal', name: 'heal', description: 'recover' } },
        hoveredTreasureChest: { x: 10, y: 20, radius: 50, life: 0, bobOffset: 0, opened: false },
        hoveredVaultChest: { x: 10, y: 20, radius: 50, life: 0, bobOffset: 0, opened: false, contractId: 'gilded', costType: 'gold', costAmount: 5 },
        currentRoom: { vaultState: { phase: 'offer', contractId: null } },
        playerShip: { hp: 42, maxHp: 100 },
        gold: 10,
        showDamageNumbers: true,
        damageNumbers: [{ x: 10, y: 20, amount: 9, life: 1, scale: 1, isPlayer: false }]
    };
    return { calls, game, renderer: new WorldOverlayRenderer(game) };
}

test('world overlay renderer moves every informational world annotation onto the hud pass', () => {
    const { calls, renderer } = createHarness();

    renderer.draw();

    const text = calls.filter(([type]) => type === 'text').map(([, value]) => value);
    assert.deepEqual(text.filter(value => value === '8 /10'), ['8 /10', '8 /10']);
    assert.ok(text.includes('20 /100'));
    assert.ok(text.includes('training dummy'));
    assert.ok(text.includes('2 dps'));
    assert.ok(text.includes('6g'));
    assert.ok(text.includes('[e] buy'));
    assert.ok(text.includes('treasure cache'));
    assert.ok(text.includes('gilded protocol'));
    assert.ok(text.includes('exclusive contract // payer owns cache'));
    assert.ok(text.includes(9));
    assert.deepEqual(calls.at(0)[0], 'overlay-begin');
    assert.deepEqual(calls.at(-1), ['overlay-end']);
});
