import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { ItemPickupSystem } = await import('./ItemPickupSystem.js');

const TILE_SIZE = 28;
const PARTS = {
    common: {
        name: 'Common Plate',
        width: 1,
        height: 1
    },
    rare: {
        name: 'Rare Wing',
        rarity: 'rare',
        width: 2,
        height: 1
    },
    epic: {
        name: 'Epic Core',
        rarity: 'epic',
        width: 1,
        height: 1
    }
};

function createItem({
    x = 100,
    y = 100,
    radius = 4,
    partId = 'common'
} = {}) {
    const updates = [];
    return {
        item: {
            x,
            y,
            radius,
            partId,
            update: (...args) => updates.push(args)
        },
        updates
    };
}

function createHarness({
    isDead = false,
    itemEntries = [],
    parts = [{ partId: 'common', x: 0, y: 0 }],
    rotation = 0
} = {}) {
    const calls = [];
    const game = {
        x: 100,
        y: 100,
        rotation,
        itemPickups: itemEntries.map(entry => entry.item),
        playerShip: {
            isDead,
            getUniqueParts: () => parts
        },
        hangar: {
            inventory: {},
            updateUI: () => calls.push(['update-ui'])
        },
        notifications: [],
        audio: {
            play: (...args) => calls.push(['audio', ...args])
        }
    };

    return {
        calls,
        game,
        system: new ItemPickupSystem(game, {
            partsLibrary: PARTS,
            tileSize: TILE_SIZE
        })
    };
}

test('alive pickups keep updating toward the player before collection', () => {
    const entry = createItem({ x: 500, y: 500 });
    const { game, system } = createHarness({ itemEntries: [entry] });

    system.update(0.25);

    assert.deepEqual(entry.updates, [[0.25, { x: 100, y: 100 }]]);
    assert.equal(game.itemPickups.length, 1);
});

test('dead players stop attracting and collecting pickups', () => {
    const entry = createItem();
    const { calls, game, system } = createHarness({
        isDead: true,
        itemEntries: [entry]
    });

    system.update(0.25);

    assert.deepEqual(entry.updates, [[0.25, null]]);
    assert.equal(game.itemPickups.length, 1);
    assert.deepEqual(calls, []);
});

test('rotated multi-tile parts retain their original pickup geometry and reward', () => {
    const entry = createItem({
        x: 100,
        y: 142,
        partId: 'rare'
    });
    const { calls, game, system } = createHarness({
        itemEntries: [entry],
        parts: [{ partId: 'rare', x: 1, y: 0 }],
        rotation: Math.PI / 2
    });

    system.update(0.1);

    assert.deepEqual(game.itemPickups, []);
    assert.deepEqual(game.hangar.inventory, { rare: 1 });
    assert.deepEqual(game.notifications, [{
        text: '+1 Rare Wing',
        life: 2,
        color: '#0088ff'
    }]);
    assert.deepEqual(calls, [
        ['update-ui'],
        ['audio', 'item_pickup', { volume: 0.5 }]
    ]);
});

test('reverse iteration collects adjacent pickups without skipping either', () => {
    const common = createItem({ partId: 'common' });
    const epic = createItem({ partId: 'epic' });
    const { calls, game, system } = createHarness({
        itemEntries: [common, epic]
    });

    system.update(0.1);

    assert.deepEqual(game.itemPickups, []);
    assert.deepEqual(game.hangar.inventory, { epic: 1, common: 1 });
    assert.deepEqual(game.notifications, [
        { text: '+1 Epic Core', life: 2, color: '#aa00ff' },
        { text: '+1 Common Plate', life: 2, color: '#00ff00' }
    ]);
    assert.equal(calls.filter(call => call[0] === 'update-ui').length, 2);
});

test('unowned parts go to the nearest touching guest inventory', () => {
    const entry = createItem({ x: 300, y: 300 });
    const { calls, game, system } = createHarness({
        itemEntries: [entry]
    });
    const guestInventory = {};
    const guestShip = {
        isDead: false,
        getUniqueParts: () => [{
            partId: 'common',
            x: 0,
            y: 0
        }]
    };
    game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => [{
                id: 'host',
                ship: game.playerShip,
                x: game.x,
                y: game.y,
                rotation: game.rotation,
                inventory: game.hangar.inventory
            }, {
                id: 'guest_1',
                ship: guestShip,
                x: 300,
                y: 300,
                rotation: 0,
                inventory: guestInventory
            }]
        }
    };

    system.update(0.1);

    assert.deepEqual(game.itemPickups, []);
    assert.deepEqual(guestInventory, { common: 1 });
    assert.deepEqual(game.hangar.inventory, {});
    assert.equal(
        calls.some(call => call[0] === 'update-ui'),
        false
    );
});

test('shop-owned parts cannot be collected by another player', () => {
    const entry = createItem({ x: 300, y: 300 });
    entry.item.ownerId = 'host';
    const { game, system } = createHarness({ itemEntries: [entry] });
    game.peerNetwork = {
        isHost: true,
        simulation: {
            getPickupPlayers: () => [{
                id: 'host',
                ship: game.playerShip,
                x: 100,
                y: 100,
                rotation: 0,
                inventory: game.hangar.inventory
            }, {
                id: 'guest_1',
                ship: game.playerShip,
                x: 300,
                y: 300,
                rotation: 0,
                inventory: {}
            }]
        }
    };

    system.update(0.1);

    assert.equal(game.itemPickups.length, 1);
    assert.deepEqual(entry.updates, [[0.1, { x: 100, y: 100 }]]);
});
