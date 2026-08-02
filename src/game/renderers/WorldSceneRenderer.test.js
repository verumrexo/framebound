import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { WorldSceneRenderer } = await import('./WorldSceneRenderer.js');

function createHarness() {
    const calls = [];
    const ctx = {
        strokeStyle: null,
        fillStyle: null,
        lineWidth: 0,
        strokeRect(...args) {
            calls.push(['stroke-room', this.strokeStyle, this.lineWidth, ...args]);
        },
        fillRect(...args) {
            calls.push(['fill-room', this.fillStyle, ...args]);
        },
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        fillText: (...args) => calls.push(['text', ...args])
    };
    const renderer = {
        ctx,
        withCamera(camera, draw) {
            calls.push(['camera-begin', camera]);
            draw();
            calls.push(['camera-end']);
        }
    };
    const named = name => ({ name });
    const entityRenderer = {};
    for (const method of [
        'drawAsteroid',
        'drawLootCrate',
        'drawShipwreck',
        'drawPortal',
        'drawOrb',
        'drawItemPickup',
        'drawEnemy',
        'drawShip',
        'drawShopItem',
        'drawTreasureChest',
        'drawVaultChest',
        'drawDrone'
    ]) {
        entityRenderer[method] = (passedRenderer, entity, ...args) =>
            calls.push([method, entity.name, ...args]);
    }

    const shop = {
        name: 'shop',
        purchased: false,
        update: dt => calls.push(['shop-update', dt])
    };
    const purchasedShop = {
        name: 'purchased-shop',
        purchased: true,
        update: () => assert.fail('purchased shop updated')
    };
    const treasure = {
        name: 'treasure',
        opened: false,
        update: dt => calls.push(['treasure-update', dt])
    };
    const vault = {
        name: 'vault',
        opened: false,
        update: dt => calls.push(['vault-update', dt])
    };
    const hoveredShop = {
        purchased: false,
        data: { price: 8 },
        drawTooltip: (passedRenderer, affordable) =>
            calls.push(['shop-tooltip', affordable])
    };
    const hoveredTreasure = {
        opened: false,
        drawTooltip: (passedRenderer, available) =>
            calls.push(['treasure-tooltip', available])
    };
    const hoveredVault = {
        opened: false,
        drawTooltip: (passedRenderer, hp, gold) =>
            calls.push(['vault-tooltip', hp, gold])
    };
    const remoteCustom = {
        draw: passedRenderer => calls.push(['remote-custom'])
    };
    const game = {
        renderer,
        camera: { x: 10, y: 20, zoom: 2 },
        graphics: { gridOpacity: 0.01 },
        grid: { draw: (passedRenderer, camera, alpha) => calls.push(['grid', alpha]) },
        rooms: null,
        currentRoom: null,
        floor: 1,
        rotation: Math.PI / 3,
        input: { getMousePos: () => ({ x: 40, y: 60 }) },
        x: 100,
        y: 200,
        asteroids: [named('asteroid')],
        lootCrates: [named('crate')],
        shipwrecks: [named('wreck')],
        portals: [named('portal')],
        xpOrbs: [named('xp')],
        goldOrbs: [named('gold')],
        hpOrbs: [named('hp')],
        itemPickups: [named('item')],
        enemies: [named('enemy')],
        bosses: [named('boss')],
        network: {
            otherPlayers: new Map([
                ['custom', remoteCustom],
                ['fallback', named('remote-fallback')]
            ])
        },
        shopItems: [shop, purchasedShop],
        hoveredShopItem: hoveredShop,
        treasureChests: [treasure],
        hoveredTreasureChest: hoveredTreasure,
        vaultChests: [vault],
        hoveredVaultChest: hoveredVault,
        projectiles: [named('projectile')],
        drones: [named('drone')],
        playerShip: { name: 'player', hp: 42, isDead: false },
        gold: 10,
        effects: { drawWorld: () => calls.push(['effects']) }
    };
    const scene = new WorldSceneRenderer(game, {
        entityRenderer,
        drawProjectileFn: (passedRenderer, projectile) =>
            calls.push(['projectile', projectile.name]),
        drawDebugHitboxesFn: (passedGame, cos, sin) =>
            calls.push(['debug', cos, sin])
    });
    return { game, calls, scene };
}

test('world scene preserves entity, interaction, projectile, player, and effect draw order', () => {
    const { calls, scene } = createHarness();
    scene.draw();

    assert.deepEqual(calls.map(call => call[0]), [
        'camera-begin',
        'grid',
        'drawAsteroid',
        'drawLootCrate',
        'drawShipwreck',
        'drawPortal',
        'drawOrb',
        'drawOrb',
        'drawOrb',
        'drawItemPickup',
        'drawEnemy',
        'drawEnemy',
        'remote-custom',
        'drawShip',
        'drawShopItem',
        'shop-tooltip',
        'drawTreasureChest',
        'treasure-tooltip',
        'drawVaultChest',
        'vault-tooltip',
        'projectile',
        'drawDrone',
        'debug',
        'drawShip',
        'effects',
        'camera-end'
    ]);
    assert.deepEqual(calls.find(call => call[0] === 'grid'), ['grid', 0.02]);
    assert.deepEqual(calls.find(call => call[0] === 'shop-tooltip'), ['shop-tooltip', true]);
    assert.deepEqual(calls.find(call => call[0] === 'vault-tooltip'), ['vault-tooltip', 42, 10]);
});

test('player turret target keeps mouse conversion', () => {
    const mouseHarness = createHarness();
    mouseHarness.scene.draw();
    assert.deepEqual(
        mouseHarness.calls.filter(call => call[0] === 'drawShip').at(-1),
        ['drawShip', 'player', 30, 50]
    );
});

test('room outline, current fill, and tutorial text keep their original palette and geometry', () => {
    const { game, calls, scene } = createHarness();
    const room = {
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        gridX: 0,
        gridY: 0,
        locked: true,
        cleared: false
    };
    game.rooms = [room];
    game.currentRoom = room;

    scene.draw();

    assert.deepEqual(calls.find(call => call[0] === 'stroke-room'), [
        'stroke-room', '#ff3333', 8, 100, 200, 800, 600
    ]);
    assert.deepEqual(calls.find(call => call[0] === 'fill-room'), [
        'fill-room', 'rgba(255, 0, 0, 0.15)', 100, 200, 800, 600
    ]);
    assert.deepEqual(
        calls.filter(call => call[0] === 'text').map(call => call[1]),
        ['wasd: move', 'l-click: shoot', 'e: interact', 'tab: hangar', 'm: map']
    );
});
