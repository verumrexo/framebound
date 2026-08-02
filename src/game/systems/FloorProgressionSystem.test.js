import test from 'node:test';
import assert from 'node:assert/strict';
import { FloorProgressionSystem } from './FloorProgressionSystem.js';

const COLLECTIONS = [
    'projectiles',
    'enemies',
    'drones',
    'bosses',
    'portals',
    'explosions',
    'xpOrbs',
    'goldOrbs',
    'hpOrbs',
    'itemPickups',
    'shipwrecks',
    'asteroids',
    'lootCrates',
    'shopItems',
    'treasureChests',
    'vaultChests',
    'damageNumbers'
];

function createHarness({ floor = 1 } = {}) {
    const calls = [];
    const randomBiome = {
        name: 'Test Sector',
        colors: {
            background: '#111111',
            grid: '#222222',
            stars: '#333333'
        }
    };
    const defaultBiome = {
        name: 'Default Sector',
        colors: {
            background: '#010101',
            grid: '#020202',
            stars: '#030303'
        }
    };
    const startRoom = {
        onEnter: game => calls.push(['enter', game])
    };
    const rooms = [{ id: 'new-floor' }];
    const oldRoom = {
        cancelPendingEvents: () => calls.push(['cancel-room-events'])
    };
    const game = {
        floor,
        x: 8,
        y: 9,
        vx: 10,
        vy: 11,
        hoveredShopItem: {},
        hoveredTreasureChest: {},
        hoveredVaultChest: {},
        renderer: {
            setBackgroundColor: color => calls.push(['background', color])
        },
        grid: {
            setColor: color => calls.push(['grid', color])
        },
        starfield: {
            setColor: color => calls.push(['stars', color]),
            generate: () => calls.push(['generate-stars'])
        },
        levelGen: {
            generate: size => {
                calls.push(['generate-level', size]);
                return rooms;
            },
            getRoom: (x, y) => {
                calls.push(['get-room', x, y]);
                return startRoom;
            }
        },
        showNotification: (...args) => calls.push(['notification', ...args])
    };
    game.rooms = [oldRoom];
    for (const key of COLLECTIONS) {
        game[key] = [{ old: key }];
    }

    return {
        calls,
        defaultBiome,
        game,
        randomBiome,
        rooms,
        startRoom,
        system: new FloorProgressionSystem(game, {
            randomBiome: () => randomBiome,
            defaultBiome
        })
    };
}

test('floor warp preserves progression while clearing every old-room collection', () => {
    const harness = createHarness();

    harness.system.nextLevel();

    assert.equal(harness.game.floor, 2);
    assert.equal(harness.game.currentBiome, harness.randomBiome);
    assert.equal(harness.game.rooms, harness.rooms);
    assert.equal(harness.game.currentRoom, harness.startRoom);
    assert.equal(harness.game.x, 1000);
    assert.equal(harness.game.y, 1000);
    assert.equal(harness.game.vx, 0);
    assert.equal(harness.game.vy, 0);

    for (const key of COLLECTIONS) {
        assert.deepEqual(harness.game[key], [], `${key} should not cross floors`);
    }
    assert.equal(harness.game.hoveredShopItem, null);
    assert.equal(harness.game.hoveredTreasureChest, null);
    assert.equal(harness.game.hoveredVaultChest, null);

    assert.deepEqual(harness.calls, [
        ['background', '#111111'],
        ['grid', '#222222'],
        ['stars', '#333333'],
        ['generate-stars'],
        ['notification', 'entering Test Sector', '#222222'],
        ['notification', 'WARPING TO FLOOR 2...', '#aa00ff'],
        ['cancel-room-events'],
        ['generate-level', 19],
        ['get-room', 0, 0],
        ['enter', harness.game]
    ]);
});

test('floor one keeps the default biome fallback', () => {
    const harness = createHarness({ floor: 0 });

    harness.system.nextLevel();

    assert.equal(harness.game.floor, 1);
    assert.equal(harness.game.currentBiome, harness.defaultBiome);
    assert.ok(harness.calls.some(call =>
        call[0] === 'notification'
        && call[1] === 'entering Default Sector'
    ));
});

test('biome application still updates every visual palette owner', () => {
    const harness = createHarness();

    harness.system.applyBiome(harness.randomBiome);

    assert.equal(harness.game.currentBiome, harness.randomBiome);
    assert.deepEqual(harness.calls, [
        ['background', '#111111'],
        ['grid', '#222222'],
        ['stars', '#333333'],
        ['generate-stars'],
        ['notification', 'entering Test Sector', '#222222']
    ]);
});

test('portals update in order and stop the frame when one starts a floor warp', () => {
    const harness = createHarness();
    const calls = [];
    harness.game.x = 100;
    harness.game.y = 100;
    harness.game.nextLevel = () => calls.push(['next-level']);
    harness.game.portals = [
        {
            x: 500,
            y: 500,
            radius: 20,
            update: dt => calls.push(['update-far', dt])
        },
        {
            x: 150,
            y: 100,
            radius: 20,
            update: dt => calls.push(['update-near', dt])
        },
        {
            x: 100,
            y: 100,
            radius: 20,
            update: dt => calls.push(['update-after-warp', dt])
        }
    ];

    const startedWarp = harness.system.updatePortals(0.25);

    assert.equal(startedWarp, true);
    assert.deepEqual(calls, [
        ['update-far', 0.25],
        ['update-near', 0.25],
        ['next-level']
    ]);
});

test('portal activation keeps the original strict radius boundary', () => {
    const harness = createHarness();
    const calls = [];
    harness.game.x = 100;
    harness.game.y = 100;
    harness.game.nextLevel = () => calls.push(['next-level']);
    harness.game.portals = [{
        x: 200,
        y: 100,
        radius: 20,
        update: dt => calls.push(['update', dt])
    }];

    const startedWarp = harness.system.updatePortals(0.1);

    assert.equal(startedWarp, false);
    assert.deepEqual(calls, [['update', 0.1]]);
});

test('a living guest can trigger the boss portal for the team', () => {
    const harness = createHarness();
    const calls = [];
    harness.game.x = 1000;
    harness.game.y = 1000;
    harness.game.playerShip = { isDead: false };
    harness.game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => [
                { id: 'host', x: 1000, y: 1000 },
                { id: 'guest_1', x: 105, y: 100 }
            ]
        }
    };
    harness.game.nextLevel = () => calls.push(['next-level']);
    harness.game.portals = [{
        x: 100,
        y: 100,
        radius: 20,
        update: dt => calls.push(['update', dt])
    }];

    assert.equal(harness.system.updatePortals(0.1), true);
    assert.deepEqual(calls, [
        ['update', 0.1],
        ['next-level']
    ]);
});
