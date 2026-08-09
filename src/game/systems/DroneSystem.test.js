import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { DroneSystem } = await import('./DroneSystem.js');

const DRONE_MAKER_ID = 'custom_1769974460678';
const PARTS = {
    [DRONE_MAKER_ID]: {
        width: 2,
        height: 1,
        type: 'drone',
        name: 'swarm hive',
        stats: {
            weaponGroup: 'drone',
            droneSpawnCooldown: 5,
            droneCapacity: 8,
            droneDamage: 5,
            droneAttackCooldown: 0.8,
            droneType: 'striker'
        }
    }
};

class DroneStub {
    constructor(x, y, ownerPart, owner = 'player', _random = null, config = {}) {
        this.x = x;
        this.y = y;
        this.ownerPart = ownerPart;
        this.owner = owner;
        this.config = config;
        this.sourcePartKey = config.sourcePartKey;
        this.ownerPlayerId = owner === 'player' ? 'host' : null;
        this.radius = 8;
        this.isDead = false;
    }

    update() {}
}

function createHarness({
    drones = [],
    enemies = [],
    parts = [],
    peers = [],
    partsLibrary = PARTS,
    now = () => 7001
} = {}) {
    const calls = [];
    const game = {
        x: 100,
        y: 200,
        rotation: Math.PI / 2,
        drones,
        enemies,
        asteroids: [],
        lootCrates: [],
        playerShip: {
            isDead: false,
            permanentStats: {},
            getUniqueParts: () => parts
        },
        showNotification: (...args) => {
            calls.push(['notification', ...args]);
        },
        spawnExplosion: (...args) => {
            calls.push(['explosion', ...args]);
        },
        audio: {
            play: (...args) => calls.push(['audio', ...args])
        },
        peerNetwork: peers.length > 0
            ? {
                simulation: {
                    getPickupPlayers: () => [{
                        id: 'host',
                        ship: game.playerShip,
                        x: game.x,
                        y: game.y,
                        rotation: game.rotation
                    }, ...peers]
                }
            }
            : null
    };

    return {
        calls,
        game,
        system: new DroneSystem(game, {
            DroneClass: DroneStub,
            partsLibrary,
            tileSize: 28,
            now
        })
    };
}

test('friendly hives preserve rotated spawn geometry and feedback', () => {
    const part = {
        partId: DRONE_MAKER_ID,
        x: 1,
        y: 0,
        rotation: 1,
        lastDroneSpawn: 1000
    };
    const { calls, game, system } = createHarness({
        parts: [part]
    });

    system.spawnFriendlyDrones();

    assert.equal(game.drones.length, 1);
    assert.ok(Math.abs(game.drones[0].x - 86) < 0.000001);
    assert.ok(Math.abs(game.drones[0].y - 228) < 0.000001);
    assert.equal(game.drones[0].owner, 'player');
    assert.equal(game.drones[0].ownerPart, part);
    assert.equal(part.lastDroneSpawn, 7001);
    assert.deepEqual(calls, [
        ['notification', 'drone deployed', '#00ffff'],
        ['audio', 'reload', { volume: 0.5, pitch: 2 }]
    ]);
});

test('enemy drones do not consume a player drone capacity', () => {
    const drones = Array.from(
        { length: 8 },
        () => new DroneStub(0, 0, null, 'enemy')
    );
    const part = {
        partId: DRONE_MAKER_ID,
        x: 0,
        y: 0,
        rotation: 0
    };
    const { calls, game, system } = createHarness({
        drones,
        parts: [part]
    });

    system.spawnFriendlyDrones();

    assert.equal(game.drones.length, 9);
    assert.equal(part.lastDroneSpawn, 7001);
    assert.deepEqual(calls, [
        ['notification', 'drone deployed', '#00ffff'],
        ['audio', 'reload', { volume: 0.5, pitch: 2 }]
    ]);
});

test('guest hives deploy drones from the guest ship position', () => {
    const guestPart = {
        partId: DRONE_MAKER_ID,
        x: 1,
        y: 0,
        rotation: 0
    };
    const guest = {
        id: 'guest_1',
        ship: {
            permanentStats: {},
            getUniqueParts: () => [guestPart]
        },
        x: 500,
        y: 600,
        rotation: 0
    };
    const { game, system } = createHarness({ peers: [guest] });

    system.spawnFriendlyDrones();

    assert.equal(game.drones.length, 1);
    assert.equal(game.drones[0].x, 542);
    assert.equal(game.drones[0].y, 600);
    assert.equal(game.drones[0].ownerPlayerId, 'guest_1');
    assert.equal(guestPart.lastDroneSpawn, 7001);
});

test('new drone roles and zero-damage repair profiles flow through the spawn system', () => {
    const repairId = 'drone_repair_choir';
    const repairPart = {
        partId: repairId,
        x: 0,
        y: 0,
        rotation: 0
    };
    const repairDef = {
        width: 2,
        height: 2,
        type: 'drone',
        name: 'repair choir',
        stats: {
            weaponGroup: 'drone',
            droneSpawnCooldown: 5,
            droneCapacity: 2,
            droneDamage: 0,
            droneAttackCooldown: 2,
            droneType: 'mender',
            droneRole: 'repair',
            droneRepairAmount: 4
        }
    };
    const { game, system } = createHarness({
        parts: [repairPart],
        partsLibrary: { [repairId]: repairDef }
    });

    system.spawnFriendlyDrones();

    assert.equal(game.drones.length, 1);
    assert.deepEqual(game.drones[0].config, {
        type: 'mender',
        damage: 0,
        attackCooldown: 2,
        sourcePartId: repairId,
        sourcePartKey: `${repairId}@0,0`,
        sourcePartName: 'repair choir',
        role: 'repair',
        repairAmount: 4
    });
});

test('mixed carriers fill their own capacity instead of one type starving another', () => {
    let currentTime = 10000;
    const firstId = 'drone_first';
    const secondId = 'drone_second';
    const firstPart = { partId: firstId, x: 0, y: 0, rotation: 0 };
    const secondPart = {
        partId: secondId,
        x: 1,
        y: 0,
        rotation: 0,
        lastDroneSpawn: 9500
    };
    const makeDefinition = (id, type) => ({
        id,
        width: 1,
        height: 1,
        type: 'drone',
        name: id,
        stats: {
            weaponGroup: 'drone',
            droneSpawnCooldown: 5,
            droneCapacity: 1,
            droneDamage: 1,
            droneAttackCooldown: 1,
            droneType: type
        }
    });
    const { game, system } = createHarness({
        parts: [firstPart, secondPart],
        partsLibrary: {
            [firstId]: makeDefinition(firstId, 'needle'),
            [secondId]: makeDefinition(secondId, 'torch')
        },
        now: () => currentTime
    });

    system.spawnFriendlyDrones();
    assert.deepEqual(game.drones.map(drone => drone.config.type), ['needle']);

    currentTime = 16000;
    system.spawnFriendlyDrones();
    assert.deepEqual(
        game.drones.map(drone => drone.config.type),
        ['needle', 'torch']
    );
});

test('enemy hives stop at twelve enemy drones and retain their spawner', () => {
    const existing = Array.from(
        { length: 11 },
        () => new DroneStub(0, 0, null, 'enemy')
    );
    const firstPart = {
        partId: DRONE_MAKER_ID,
        x: 1,
        y: 0,
        rotation: 0
    };
    const secondPart = {
        partId: DRONE_MAKER_ID,
        x: 2,
        y: 0,
        rotation: 0
    };
    const enemy = {
        x: 500,
        y: 600,
        rotation: 0,
        isDead: false,
        shipParts: [firstPart, secondPart]
    };
    const { calls, game, system } = createHarness({
        drones: existing,
        enemies: [enemy]
    });

    system.spawnEnemyDrones();

    assert.equal(game.drones.length, 12);
    const spawned = game.drones[11];
    assert.equal(spawned.owner, 'enemy');
    assert.equal(spawned.spawnerEnemy, enemy);
    assert.equal(spawned.x, 542);
    assert.equal(spawned.y, 600);
    assert.equal(firstPart.lastDroneSpawn, 7001);
    assert.equal(secondPart.lastDroneSpawn, undefined);
    assert.deepEqual(calls, [[
        'notification',
        'enemy drone spawned',
        '#ff00ff'
    ]]);
});

test('invalid hive geometry does not create a broken drone', () => {
    const part = {
        partId: DRONE_MAKER_ID,
        x: Number.NaN,
        y: 0,
        rotation: 0
    };
    const { game, system } = createHarness({
        parts: [part]
    });
    const originalError = console.error;
    console.error = () => {};

    try {
        system.spawnFriendlyDrones();
    } finally {
        console.error = originalError;
    }

    assert.deepEqual(game.drones, []);
    assert.equal(part.lastDroneSpawn, undefined);
});

test('dead drones update, explode, and are removed in reverse order', () => {
    const order = [];
    const alive = new DroneStub(10, 20, null);
    alive.update = () => order.push('alive');
    const dead = new DroneStub(30, 40, null);
    dead.isDead = true;
    dead.update = () => order.push('dead');
    const { calls, game, system } = createHarness({
        drones: [alive, dead]
    });

    system.updateDrones(0.25);

    assert.deepEqual(order, ['dead', 'alive']);
    assert.deepEqual(game.drones, [alive]);
    assert.deepEqual(calls, [
        ['explosion', 30, 40, 20, 0.4, '#00ffff'],
        ['audio', 'explosion', { volume: 0.2, pitch: 2 }]
    ]);
});
