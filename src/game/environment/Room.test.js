import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Room } = await import('./Room.js');
const { RoomType } = await import('./RoomType.js');
const { selectEnemyType } = await import('../../shared/enemies/EnemyRoster.js');

test('room-clear checkpoint includes the clear score instead of losing it', () => {
    const calls = [];
    const room = new Room(0, 0, 1, 1, () => 0.5);
    room.locked = true;
    room.cleared = false;

    const game = {
        score: 25,
        playerShip: {},
        xpOrbs: [],
        goldOrbs: [],
        asteroids: [],
        lootCrates: [],
        showNotification: (...args) => calls.push([
            'notification',
            game.score,
            ...args
        ]),
        autoSave: () => calls.push(['save', game.score])
    };

    room.unlock(game);

    assert.equal(room.locked, false);
    assert.equal(room.cleared, true);
    assert.equal(game.score, 125);
    assert.deepEqual(calls, [
        ['notification', 125, 'ROOM CLEARED! +100', '#ffff00'],
        ['save', 125]
    ]);
});

test('floor rosters introduce new roles gradually', () => {
    assert.equal(selectEnemyType(1, 0.1), 'striker');
    assert.equal(selectEnemyType(2, 0.1), 'interceptor');
    assert.equal(selectEnemyType(3, 0.05), 'bulwark');
    assert.equal(selectEnemyType(4, 0.05), 'repair_tender');
    assert.equal(selectEnemyType(5, 0.05, { vault: true }), 'hive_carrier');
});

test('shop entry creates its original four items synchronously and once', () => {
    const room = new Room(1, 0, 1, 1, () => 0.5);
    room.type = RoomType.SHOP;
    const game = { shopItems: [] };

    room.onEnter(game);

    assert.equal(room.cleared, true);
    assert.equal(room.shopItems.length, 4);
    assert.equal(game.shopItems.length, 4);
    assert.equal(room.shopItems[0].data.type, 'heal');
    assert.deepEqual(
        room.shopItems.map(item => item.x),
        [2820, 2940, 3060, 3180]
    );

    room.generateShopItems(game);
    assert.equal(game.shopItems.length, 4);
});

test('treasure and floor-scaled vault chests exist before room entry returns', () => {
    const treasure = new Room(0, 1, 1, 1, () => 0.5);
    treasure.type = RoomType.TREASURE;
    const treasureGame = { treasureChests: [] };

    treasure.onEnter(treasureGame);

    assert.equal(treasure.treasureChests.length, 2);
    assert.equal(treasureGame.treasureChests.length, 2);
    assert.deepEqual(
        treasure.treasureChests.map(chest => [chest.x, chest.y]),
        [[925, 3000], [1075, 3000]]
    );

    const vault = new Room(1, 1, 1, 1, () => 0.5);
    vault.type = RoomType.VAULT;
    const vaultGame = { floor: 3, vaultChests: [] };

    vault.onEnter(vaultGame);

    assert.equal(vault.vaultChests.length, 2);
    assert.equal(vaultGame.vaultChests.length, 2);
    assert.deepEqual(
        vault.vaultChests.map(chest => [
            chest.costType,
            chest.costAmount,
            chest.x,
            chest.y
        ]),
        [
            ['gold', 225, 2900, 3000],
            ['hp', 112, 3100, 3000]
        ]
    );
});

test('pending vault wave callbacks can be cancelled when their floor is replaced', (t) => {
    const calls = [];
    const timerHandle = { id: 'wave' };
    t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
        calls.push(['schedule', callback, delay]);
        return timerHandle;
    });
    t.mock.method(globalThis, 'clearTimeout', handle => {
        calls.push(['cancel', handle]);
    });

    const room = new Room(1, 1, 1, 1, () => 0.5);
    room.ambushStarted = true;
    room.waveWaiting = false;
    room.waveCount = 1;
    room.maxWaves = 3;
    room.enemies = [];

    room.checkAmbushStatus({});

    assert.equal(room.waveWaiting, true);
    assert.equal(room.waveTimer, timerHandle);
    assert.equal(calls[0][0], 'schedule');
    assert.equal(calls[0][2], 1000);

    room.cancelPendingEvents();

    assert.equal(room.waveWaiting, false);
    assert.equal(room.waveTimer, null);
    assert.deepEqual(calls[1], ['cancel', timerHandle]);
});

test('rooms preserve debris and loose rewards while inactive and restore them on revisit', () => {
    const room = new Room(1, 0, 1, 1, () => 0.5);
    const asteroid = { id: 'rock' };
    const crate = { id: 'box' };
    const wreck = { id: 'wreck' };
    const xp = { id: 'xp' };
    const gold = { id: 'gold' };
    const hp = { id: 'hp' };
    const item = { id: 'item' };
    const game = {
        asteroids: [asteroid],
        lootCrates: [crate],
        shipwrecks: [wreck],
        xpOrbs: [xp],
        goldOrbs: [gold],
        hpOrbs: [hp],
        itemPickups: [item]
    };

    room.deactivate(game);
    game.asteroids = [];
    game.lootCrates = [];
    game.shipwrecks = [];
    game.xpOrbs = [];
    game.goldOrbs = [];
    game.hpOrbs = [];
    game.itemPickups = [];
    room.activate(game);

    assert.deepEqual(game.asteroids, [asteroid]);
    assert.deepEqual(game.lootCrates, [crate]);
    assert.deepEqual(game.shipwrecks, [wreck]);
    assert.deepEqual(game.xpOrbs, [xp]);
    assert.deepEqual(game.goldOrbs, [gold]);
    assert.deepEqual(game.hpOrbs, [hp]);
    assert.deepEqual(game.itemPickups, [item]);
    assert.equal(game.asteroids, room.asteroids);
    assert.equal(game.lootCrates, room.lootCrates);
    assert.equal(game.shipwrecks, room.shipwrecks);
    assert.equal(game.xpOrbs, room.xpOrbs);
    assert.equal(game.goldOrbs, room.goldOrbs);
    assert.equal(game.hpOrbs, room.hpOrbs);
    assert.equal(game.itemPickups, room.itemPickups);
});
