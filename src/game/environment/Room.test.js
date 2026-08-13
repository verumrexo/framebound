import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Room } = await import('./Room.js');
const { RoomType } = await import('./RoomType.js');
const { selectEnemyType } = await import('../../shared/enemies/EnemyRoster.js');
const { PartsLibrary } = await import('../../shared/parts/Part.js');

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

test('blank unpublished roster safely produces no enemies', () => {
    assert.equal(selectEnemyType(1, 0.1), null);
    assert.equal(selectEnemyType(5, 0.5, { vault: true }), null);
});

test('shop entry keeps four original offers plus a permanent doctrine terminal', () => {
    const room = new Room(1, 0, 1, 1, () => 0.5);
    room.type = RoomType.SHOP;
    const game = { shopItems: [] };

    room.onEnter(game);

    assert.equal(room.cleared, true);
    assert.equal(room.shopItems.length, 5);
    assert.equal(game.shopItems.length, 5);
    assert.equal(room.shopItems[0].data.type, 'heal');
    for (const item of room.shopItems.slice(1, 4)) {
        assert.equal(item.data.description, PartsLibrary[item.data.partId].description);
    }
    assert.equal(room.shopItems[4].data.type, 'doctrine_terminal');
    assert.deepEqual(
        room.shopItems.map(item => item.x),
        [2760, 2880, 3000, 3120, 3240]
    );

    room.generateShopItems(game);
    assert.equal(game.shopItems.length, 5);
});

test('treasure and exclusive vault contracts exist before room entry returns', () => {
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
            chest.contractId,
            chest.costType,
            chest.x,
            chest.y
        ]),
        [
            ['gilded', 'gold', 2730, 3120],
            ['blood', 'hp', 3270, 3120]
        ]
    );
    assert.equal(vault.vaultState.phase, 'offer');
});

test('vault containment advances through simulation time without callbacks', () => {
    const room = new Room(1, 1, 1, 1, () => 0.5);
    room.type = RoomType.VAULT;
    const notifications = [];
    const game = {
        floor: 1,
        enemies: [],
        vaultChests: [],
        showNotification: (...args) => notifications.push(args)
    };
    room.onEnter(game);

    assert.equal(room.startAmbush(game, 'gilded', 'host'), true);
    assert.equal(room.vaultState.nextSurge, 1);
    assert.equal(room.enemies.length, 0);

    room.checkAmbushStatus(game, 6);
    assert.equal(room.vaultState.elapsed, 6);
    assert.equal(room.vaultState.nextSurge, 2);
    assert.equal(room.enemies.length, 0);

    room.enemies.forEach(enemy => { enemy.isDead = true; });
    room.checkAmbushStatus(game, 12);
    room.enemies.forEach(enemy => { enemy.isDead = true; });
    room.checkAmbushStatus(game, 0);
    assert.equal(room.vaultState.phase, 'reward');
    assert.equal(room.locked, false);
    assert.equal(room.waveTimer, null);
});

test('choosing a vault contract seals its rival and stores one reward roll', () => {
    let roll = 0;
    const room = new Room(1, 1, 1, 1, () => (roll++ % 10) / 10);
    room.type = RoomType.VAULT;
    const game = {
        floor: 2,
        enemies: [],
        vaultChests: [],
        showNotification: () => {},
        peerNetwork: {
            simulation: {
                getPickupPlayers: () => [{}, {}, {}]
            }
        }
    };
    room.onEnter(game);

    assert.equal(room.startAmbush(game, 'blood', 'guest_2'), true);
    const blood = room.vaultChests.find(chest => chest.contractId === 'blood');
    const gilded = room.vaultChests.find(chest => chest.contractId === 'gilded');
    assert.equal(blood.wasPaid, true);
    assert.equal(blood.ambushActive, true);
    assert.equal(gilded.sealed, true);
    assert.equal(gilded.locked, true);
    assert.equal(room.vaultState.payerId, 'guest_2');
    assert.equal(room.vaultState.playerCount, 3);
    assert.equal(room.enemies.length, 0);
    assert.equal(room.vaultState.rewardPartIds.length, 3);
    assert.equal(new Set(room.vaultState.rewardPartIds).size, 3);
    assert.equal(room.startAmbush(game, 'gilded', 'host'), false);
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
