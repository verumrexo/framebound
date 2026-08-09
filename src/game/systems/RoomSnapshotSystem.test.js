import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Room } = await import('../environment/Room.js');
const { Asteroid } = await import('../../shared/entities/Asteroid.js');
const { Boss } = await import('../../shared/entities/Boss.js');
const { Drone } = await import('../../shared/entities/Drone.js');
const { Decoy } = await import('../../shared/entities/Decoy.js');
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
    source.asteroids[0].takeDamage(source.asteroids[0].hp + 1);
    source.asteroids[0].update(0.1);
    source.lootCrates = [new LootCrate(2200, 400, '1x2', () => 0.99)];
    source.lootCrates[0].takeDamage(source.lootCrates[0].hp + 1);
    source.lootCrates[0].update(0.1);
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
    source.vaultState = {
        version: 1,
        phase: 'containment',
        contractId: 'gilded',
        payerId: 'guest_1',
        playerCount: 2,
        elapsed: 7.5,
        nextSurge: 2,
        spawnSerial: 7,
        rewardPartIds: ['dart', 'laser'],
        rewardSpawned: false
    };

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
    assert.equal(target.asteroids[0].isBroken, true);
    assert.equal(target.lootCrates[0].isOpened, true);
    assert.equal(target.lootCrates[0].variant, 2);
    assert.equal(target.lootCrates[0].lightColor, '#44ff44');
    assert.deepEqual(
        target.asteroids[0].breakFragments,
        source.asteroids[0].breakFragments
    );
    assert.deepEqual(
        target.lootCrates[0].breakFragments,
        source.lootCrates[0].breakFragments
    );
    assert.equal(target.shipwrecks[0].ship.getUniqueParts().size > 0, true);
    assert.equal(target.shopItems[0].purchased, true);
    assert.equal(target.treasureChests[0].opened, true);
    assert.equal(target.vaultChests[0].wasPaid, true);
    assert.deepEqual(target.vaultState, source.vaultState);
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
    const drone = new Drone(30, 40, null, 'player', random, {
        type: 'rammer',
        damage: 30,
        sourcePartId: 'drone_ram_hive',
        sourcePartKey: 'drone_ram_hive@1,2',
        sourcePartName: 'ram hive'
    });
    drone.hp = 6;
    const pickup = new ItemPickup(50, 60, 'hull', random);
    pickup.life = 4;
    const decoy = new Decoy('decoy-1', 120, 130, 'guest_1');
    decoy.hp = 19;

    const snapshot = snapshotActiveWorld({
        enemies: [enemy],
        bosses: [boss],
        projectiles: [projectile],
        drones: [drone],
        decoys: [decoy],
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
    assert.equal(game.drones[0].droneType, 'rammer');
    assert.equal(game.drones[0].role, 'ram');
    assert.equal(game.drones[0].damage, 30);
    assert.equal(game.drones[0].sourcePartKey, 'drone_ram_hive@1,2');
    assert.equal(game.decoys[0].id, 'decoy-1');
    assert.equal(game.decoys[0].ownerPlayerId, 'guest_1');
    assert.equal(game.decoys[0].hp, 19);
    assert.equal(game.xpOrbs[0].value, 9);
    assert.equal(game.goldOrbs[0].value, 3);
    assert.equal(game.hpOrbs[0].value, 5);
    assert.equal(game.itemPickups[0].life, 4);
    assert.equal(room.enemies, game.enemies);
});

test('combat statuses and runtime projectile fields round-trip safely', () => {
    const enemy = new Enemy(100, 200, 'striker', 3, random, 'enemy-status');
    enemy.empTimer = 2.25;
    enemy.hackTimer = 6.5;
    enemy.hackedByPlayerId = 'guest_1';

    const mine = new Projectile(
        10, 20, 0.4, 'proximity_mine', 0, 'player', 18, 18, random
    );
    Object.assign(mine, {
        shouldExplode: true,
        armed: true,
        triggered: true,
        armingTime: 0.65,
        armingTimeRemaining: 0.2,
        triggerRadius: 80,
        blastRadius: 90,
        explosionDamage: 18,
        shrapnelCount: 10,
        shrapnelDamage: 3.5,
        sourcePlayerId: 'host',
        sourcePartId: 'mine_placer',
        sourcePartKey: 'mine_placer@1,2',
        sourcePartName: 'mine placer',
        weaponFamily: 'rocket',
        hitCount: 2,
        remainingPierces: 1,
        chainCount: 3
    });

    const ricochet = new Projectile(
        30, 40, 0.2, 'ricochet_slug', 800, 'player', 8, 2, random
    );
    Object.assign(ricochet, {
        ricochetCount: 1,
        ricochetRange: 320,
        ricochetDamageMul: 0.7,
        hitTargets: new Set(['already-hit'])
    });

    const beam = new Projectile(
        50, 60, 0.1, 'beam_sword', 0, 'player', 28, 0.08, random
    );
    beam.targetHits.set('already-hit', 1);

    const snapshot = snapshotActiveWorld({
        enemies: [enemy],
        bosses: [],
        projectiles: [mine, ricochet, beam],
        drones: [],
        decoys: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: []
    });
    const restoredGame = {
        currentRoom: new Room(1, 0, 1, 1, random),
        audio: {}
    };

    restoreActiveWorld(restoredGame, snapshot);

    assert.equal(restoredGame.enemies[0].empTimer, 2.25);
    assert.equal(restoredGame.enemies[0].hackTimer, 6.5);
    assert.equal(restoredGame.enemies[0].hackedByPlayerId, 'guest_1');

    const restoredMine = restoredGame.projectiles[0];
    for (const key of [
        'shouldExplode', 'armed', 'triggered', 'armingTime',
        'armingTimeRemaining', 'triggerRadius', 'blastRadius',
        'explosionDamage', 'shrapnelCount', 'shrapnelDamage',
        'sourcePlayerId', 'sourcePartId', 'sourcePartKey',
        'sourcePartName', 'weaponFamily', 'hitCount', 'remainingPierces',
        'chainCount'
    ]) {
        assert.equal(restoredMine[key], mine[key], key);
    }

    const restoredRicochet = restoredGame.projectiles[1];
    assert.equal(restoredRicochet.ricochetCount, 1);
    assert.equal(restoredRicochet.ricochetRange, 320);
    assert.equal(restoredRicochet.ricochetDamageMul, 0.7);
    assert.equal(restoredRicochet.hitTargets instanceof Set, true);
    assert.equal(restoredRicochet.hitTargets.size, 0);

    const restoredBeam = restoredGame.projectiles[2];
    assert.equal(restoredBeam.targetHits instanceof Map, true);
    assert.equal(restoredBeam.targetHits.size, 0);
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

    const validProjectile = {
        state: {
            x: 0,
            y: 0,
            angle: 0,
            damage: 1,
            maxLife: 1,
            type: 'proximity_mine',
            owner: 'player',
            sourcePlayerId: 'host',
            shouldExplode: false,
            armingTime: 0.65
        }
    };
    assert.equal(isValidSnapshotData(validRooms, {
        ...validWorld,
        projectiles: [validProjectile]
    }), true);
    assert.equal(isValidSnapshotData(validRooms, {
        ...validWorld,
        projectiles: [{
            ...validProjectile,
            state: { ...validProjectile.state, sourcePlayerId: 42 }
        }]
    }), false);
    assert.equal(isValidSnapshotData(validRooms, {
        ...validWorld,
        projectiles: [{
            ...validProjectile,
            state: { ...validProjectile.state, shouldExplode: 'yes' }
        }]
    }), false);
    assert.equal(isValidSnapshotData(validRooms, {
        ...validWorld,
        enemies: [{
            kind: 'enemy',
            id: 'enemy-status',
            type: 'basic',
            floorLevel: 1,
            level: 1,
            state: { x: 0, y: 0, empTimer: 'bad' },
            shipParts: [],
            weaponCooldowns: [],
            activeBursts: []
        }]
    }), false);
});
