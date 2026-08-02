import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Room } = await import('../environment/Room.js');
const { Asteroid } = await import('../../shared/entities/Asteroid.js');
const { Boss } = await import('../../shared/entities/Boss.js');
const { Drone } = await import('../../shared/entities/Drone.js');
const { Enemy } = await import('../../shared/entities/Enemy.js');
const { GoldOrb } = await import('../../shared/entities/GoldOrb.js');
const { HPOrb } = await import('../../shared/entities/HPOrb.js');
const { ItemPickup } = await import('../../shared/entities/ItemPickup.js');
const { LootCrate } = await import('../../shared/entities/LootCrate.js');
const { Projectile } = await import('../../shared/entities/Projectile.js');
const { ShopItem } = await import('../../shared/entities/ShopItem.js');
const { Shipwreck } = await import('../../shared/entities/Shipwreck.js');
const { TreasureChest } = await import('../../shared/entities/TreasureChest.js');
const { VaultChest } = await import('../../shared/entities/VaultChest.js');
const { XPOrb } = await import('../../shared/entities/XPOrb.js');
const {
    isValidSnapshotData,
    restoreActiveWorld,
    restoreRoomSnapshots,
    snapshotActiveWorld,
    snapshotRooms
} = await import('./RoomSnapshotSystem.js');

const random = () => 0.5;

test('room snapshots preserve flags, debris, wreck parts, shops, and chests', () => {
    const source = new Room(1, 0, 1, 1, random);
    source.visited = true;
    source.cleared = true;
    source.shopUsed = true;
    source.asteroids = [new Asteroid(2100, 300, 'large', 'crystal_blue', random)];
    source.asteroids[0].hp = 17;
    source.lootCrates = [new LootCrate(2200, 400, '1x2', random)];
    source.lootCrates[0].hp = 9;
    source.shipwrecks = [new Shipwreck(2300, 500, 1, random)];
    source.shopItems = [new ShopItem(2400, 600, {
        type: 'part',
        name: 'hull',
        partId: 'hull',
        description: 'part',
        price: 10
    })];
    source.shopItems[0].purchased = true;
    source.treasureChests = [new TreasureChest(2500, 700, random)];
    source.treasureChests[0].opened = true;
    source.vaultChests = [new VaultChest(2600, 800, 'gold', 100, random)];
    source.vaultChests[0].wasPaid = true;

    const snapshots = snapshotRooms({
        rooms: [source],
        currentRoom: null
    });
    const target = new Room(1, 0, 1, 1, random);
    const game = {
        levelGen: {
            getRoom: () => target
        }
    };

    restoreRoomSnapshots(game, snapshots);

    assert.equal(target.visited, true);
    assert.equal(target.cleared, true);
    assert.equal(target.shopUsed, true);
    assert.equal(target.asteroids[0].hp, 17);
    assert.equal(target.lootCrates[0].hp, 9);
    assert.equal(target.shipwrecks[0].ship.getUniqueParts().size > 0, true);
    assert.equal(target.shopItems[0].purchased, true);
    assert.equal(target.treasureChests[0].opened, true);
    assert.equal(target.vaultChests[0].wasPaid, true);
});

test('unvisited shops and chest rooms remain ungenerated after continue', () => {
    const source = new Room(2, 0, 1, 1, random);
    const snapshots = snapshotRooms({
        rooms: [source],
        currentRoom: null
    });
    const target = new Room(2, 0, 1, 1, random);

    restoreRoomSnapshots({
        levelGen: { getRoom: () => target }
    }, snapshots);

    assert.equal(target.shopItems, null);
    assert.equal(target.treasureChests, null);
    assert.equal(target.vaultChests, null);
});

test('active snapshots restore a live fight, bullets, drones, and loose rewards', () => {
    const enemy = new Enemy(100, 200, 'striker', 3, random, 'enemy-a');
    enemy.hp = 23;
    enemy.weaponCooldowns[0].cooldown = 1.25;
    const boss = new Boss(300, 400, 1, random);
    boss.hp = 77;
    const projectile = new Projectile(
        10, 20, 0.4, 'rocket_le', 600, 'enemy', 12, 2, random
    );
    projectile.life = 0.8;
    const drone = new Drone(30, 40, null, 'enemy', random);
    drone.hp = 6;
    const pickup = new ItemPickup(50, 60, 'hull', random);
    pickup.life = 4;

    const snapshot = snapshotActiveWorld({
        enemies: [enemy],
        bosses: [boss],
        projectiles: [projectile],
        drones: [drone],
        xpOrbs: [new XPOrb(70, 80, 9)],
        goldOrbs: [new GoldOrb(90, 100, 3)],
        hpOrbs: [new HPOrb(110, 120, 5)],
        itemPickups: [pickup]
    });
    const room = new Room(1, 0, 1, 1, random);
    const game = {
        currentRoom: room,
        audio: {},
        asteroids: [],
        lootCrates: [],
        shipwrecks: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: [],
        shopItems: [],
        treasureChests: [],
        vaultChests: []
    };

    restoreActiveWorld(game, snapshot);

    assert.equal(game.enemies[0] instanceof Enemy, true);
    assert.equal(game.enemies[0].id, 'enemy-a');
    assert.equal(game.enemies[0].hp, 23);
    assert.equal(game.enemies[0].weaponCooldowns[0].cooldown, 1.25);
    assert.equal(game.bosses[0] instanceof Boss, true);
    assert.equal(game.bosses[0].hp, 77);
    assert.equal(game.projectiles[0] instanceof Projectile, true);
    assert.equal(game.projectiles[0].life, 0.8);
    assert.equal(game.drones[0] instanceof Drone, true);
    assert.equal(game.drones[0].hp, 6);
    assert.equal(game.xpOrbs[0].value, 9);
    assert.equal(game.goldOrbs[0].value, 3);
    assert.equal(game.hpOrbs[0].value, 5);
    assert.equal(game.itemPickups[0].life, 4);
    assert.equal(room.enemies, game.enemies);
});

test('snapshot validation rejects non-finite and malformed entity state', () => {
    const validRooms = [{
        gridX: 0,
        gridY: 0,
        visited: true,
        cleared: true,
        locked: false,
        shopUsed: false,
        ambushStarted: false,
        waveCount: 0,
        maxWaves: 0,
        waveWaiting: false,
        asteroids: [],
        lootCrates: [],
        shipwrecks: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: [],
        shopItems: [],
        treasureChests: [],
        vaultChests: []
    }];
    const validWorld = {
        enemies: [],
        bosses: [],
        projectiles: [],
        drones: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: [],
        shopItems: [],
        treasureChests: [],
        vaultChests: []
    };

    assert.equal(isValidSnapshotData(validRooms, validWorld), true);
    assert.equal(isValidSnapshotData(validRooms, {
        ...validWorld,
        projectiles: [{ state: { x: Infinity } }]
    }), false);
    assert.equal(isValidSnapshotData(validRooms, {
        ...validWorld,
        enemies: [{}]
    }), false);
    assert.equal(isValidSnapshotData([{
        ...validRooms[0],
        asteroids: 'nope'
    }], validWorld), false);
});
