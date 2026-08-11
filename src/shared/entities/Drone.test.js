import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDroneVisualOverrides, registerDroneVisualOverride } from '../combat/DroneBlueprints.js';
import { Drone } from './Drone.js';

test('drone runtime consumes visual overrides for its sprite and projectiles', () => {
    registerDroneVisualOverride({
        blueprintId: 'striker',
        layers: { base: new Array(64).fill(0).map((_, index) => index === 0 ? 2 : 0) },
        projectileLook: 'needle',
        projectileTrail: 'ion'
    });
    const drone = new Drone(0, 0, { partId: 'hive', x: 0, y: 0 }, 'player', () => 0.5, {
        type: 'striker',
        damage: 4,
        attackCooldown: 1
    });
    const game = {
        projectiles: [],
        audio: { play: () => {} },
        enemies: [],
        bosses: [],
        drones: [],
        playerShip: null
    };
    drone.shoot(game, 0);

    assert.equal(drone.sprite.data[0], 2);
    assert.equal(game.projectiles[0].projectileLook, 'needle');
    assert.equal(game.projectiles[0].projectileTrail, 'ion');
    clearDroneVisualOverrides();
});

function createGame(players) {
    return {
        x: players[0]?.x ?? 0,
        y: players[0]?.y ?? 0,
        playerShip: players[0]?.ship ?? { isDead: true },
        enemies: [],
        bosses: [],
        drones: [],
        lootCrates: [],
        asteroids: [],
        currentRoom: null,
        peerNetwork: {
            simulation: {
                getPickupPlayers: () => players
            }
        },
        projectiles: [],
        audio: { play() {} }
    };
}

test('enemy drones target the nearest living coop player', () => {
    const host = {
        id: 'host',
        x: 500,
        y: 0,
        ship: { x: 500, y: 0, isDead: false }
    };
    const guest = {
        id: 'guest_1',
        x: 100,
        y: 0,
        ship: { x: 100, y: 0, isDead: false }
    };
    const drone = new Drone(0, 0, null, 'enemy', () => 0.5);

    assert.equal(drone.findTarget(createGame([host, guest])), guest.ship);
});

test('friendly drones follow the player whose hive deployed them', () => {
    const host = {
        id: 'host',
        x: 500,
        y: 0,
        ship: { x: 500, y: 0, isDead: false }
    };
    const guest = {
        id: 'guest_1',
        x: 100,
        y: 0,
        ship: { x: 100, y: 0, isDead: false }
    };
    const drone = new Drone(0, 0, null, 'player', () => 0.5);
    drone.ownerPlayerId = 'guest_1';

    assert.equal(drone.findOwnerPlayer(createGame([host, guest])), guest);
});

test('interceptors prefer hostile drones and fire their data-driven profile', () => {
    const hostileDrone = new Drone(80, 0, null, 'enemy', () => 0.5);
    const enemy = { x: 120, y: 0, isDead: false };
    const drone = new Drone(0, 0, null, 'player', () => 0.5, {
        type: 'interceptor',
        damage: 6,
        attackCooldown: 0.5
    });
    const game = {
        ...createGame([]),
        enemies: [enemy],
        bosses: [],
        drones: [hostileDrone],
        projectiles: [],
        audio: { play() {}, playEvent() {} }
    };

    assert.equal(drone.findTarget(game), hostileDrone);
    drone.rotation = 0;
    hostileDrone.x = 200;
    drone.update(0.01, game);

    assert.equal(game.projectiles.length, 2);
    assert.deepEqual(
        game.projectiles.map(projectile => [
            projectile.type,
            projectile.damage,
            projectile.maxLife
        ]),
        [
            ['mini_bullet', 6, 0.8],
            ['mini_bullet', 6, 0.8]
        ]
    );
    assert.notEqual(game.projectiles[0].angle, game.projectiles[1].angle);
});

test('repair drones choose the most damaged allied ship and clamp repairs', () => {
    const host = {
        id: 'host',
        x: 0,
        y: 0,
        ship: { hp: 80, maxHp: 100, isDead: false }
    };
    const guest = {
        id: 'guest_1',
        x: 40,
        y: 0,
        ship: { hp: 98, maxHp: 100, isDead: false }
    };
    const drone = new Drone(0, 0, null, 'player', () => 0.5, {
        type: 'mender',
        damage: 0,
        attackCooldown: 1
    });
    const game = {
        ...createGame([host, guest]),
        projectiles: [],
        audio: { play() {} }
    };

    assert.equal(drone.findTarget(game), host.ship);
    drone.update(0.01, game);
    assert.equal(host.ship.hp, 84);
    assert.equal(guest.ship.hp, 98);

    host.ship.hp = 99;
    drone.target = host.ship;
    drone.cooldown = 0;
    drone.update(0.01, game);
    assert.equal(host.ship.hp, 100);
    assert.deepEqual(game.projectiles, []);
});

test('ram drones deal configured contact damage and die after impact', () => {
    const enemy = {
        x: 10,
        y: 0,
        radius: 10,
        isDead: false,
        takeDamage(amount) {
            this.damageTaken = amount;
        }
    };
    const drone = new Drone(0, 0, null, 'player', () => 0.5, {
        type: 'rammer',
        damage: 30,
        contactRange: 22
    });
    const game = {
        ...createGame([]),
        enemies: [enemy],
        bosses: [],
        projectiles: [],
        audio: { play() {} }
    };

    drone.update(0, game);

    assert.equal(enemy.damageTaken, 30);
    assert.equal(drone.isDead, true);
});

test('ram drones register contact reached during the current movement step', () => {
    const enemy = {
        x: 40,
        y: 0,
        radius: 0,
        isDead: false,
        takeDamage(amount) {
            this.damageTaken = amount;
        }
    };
    const drone = new Drone(0, 0, null, 'player', () => 0.5, {
        type: 'rammer',
        damage: 30,
        speed: 400,
        turnRate: 100,
        contactRange: 10
    });
    drone.rotation = 0;
    const game = {
        ...createGame([]),
        enemies: [enemy],
        bosses: [],
        projectiles: [],
        audio: { play() {} }
    };

    drone.update(0.075, game);

    assert.equal(enemy.damageTaken, 30);
    assert.equal(drone.isDead, true);
});

test('spread describes the whole volley arc instead of multiplying per shot', () => {
    const drone = new Drone(0, 0, null, 'player', () => 0.5, {
        type: 'flak',
        damage: 3
    });
    const game = {
        ...createGame([]),
        projectiles: [],
        audio: { play() {}, playEvent() {} }
    };

    drone.shoot(game, 0);

    assert.equal(game.projectiles.length, 7);
    assert.ok(Math.abs(game.projectiles[0].angle + 0.3) < 0.000001);
    assert.ok(Math.abs(game.projectiles[6].angle - 0.3) < 0.000001);
});

test('enemy repair drones heal enemy allies instead of the player crew', () => {
    const host = {
        id: 'host',
        x: 0,
        y: 0,
        ship: { hp: 20, maxHp: 100, isDead: false }
    };
    const ally = {
        x: 10,
        y: 0,
        hp: 40,
        maxHp: 100,
        isDead: false
    };
    const drone = new Drone(0, 0, null, 'enemy', () => 0.5, {
        type: 'mender',
        attackCooldown: 2
    });
    const game = {
        ...createGame([host]),
        enemies: [ally],
        projectiles: [],
        audio: { play() {} }
    };

    assert.equal(drone.findTarget(game), ally);
    drone.update(0.01, game);
    assert.equal(ally.hp, 44);
    assert.equal(host.ship.hp, 20);
});

test('enemy drones steer toward the selected guest instead of host coordinates', () => {
    const host = {
        id: 'host',
        x: 500,
        y: 0,
        ship: { isDead: false }
    };
    const guest = {
        id: 'guest_1',
        x: 100,
        y: 25,
        ship: { isDead: false }
    };
    const drone = new Drone(0, 0, null, 'enemy', () => 0.5);
    const game = createGame([host, guest]);

    assert.equal(drone.findTarget(game), guest.ship);
    assert.deepEqual(
        drone.getTargetPosition(game, guest.ship),
        { x: 100, y: 25 }
    );
});

test('drone state remains a plain behavior value', () => {
    const drone = new Drone(0, 0, null, 'player', () => 0.5, {
        type: 'rammer',
        damage: 30
    });

    assert.equal(drone.state, 'idle');
    drone.state = 'chase';
    assert.equal(drone.state, 'chase');
});
