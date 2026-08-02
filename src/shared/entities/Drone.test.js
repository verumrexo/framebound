import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Drone } = await import('./Drone.js');

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
