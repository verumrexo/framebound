import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomTransitionSystem } from './RoomTransitionSystem.js';

function createHarness({ locked = false, visited = false } = {}) {
    const calls = [];
    const currentRoom = {
        locked,
        deactivate(game) {
            calls.push(['deactivate', game]);
        }
    };
    const nextRoom = {
        visited,
        onEnter(game) {
            calls.push(['enter', game]);
        }
    };
    const game = {
        x: 2200,
        y: 1000,
        currentRoom,
        playerShip: {},
        levelGen: {
            getRoomAtWorldPos: () => nextRoom
        },
        autoSave: () => calls.push(['save']),
        asteroids: [{}],
        lootCrates: [{}],
        shipwrecks: [{}],
        explosions: [{}]
    };

    return {
        calls,
        currentRoom,
        game,
        nextRoom,
        transitions: new RoomTransitionSystem(game)
    };
}

test('entering a new room saves first, clears old-room debris, and enters once', () => {
    const { calls, game, nextRoom, transitions } = createHarness();

    assert.equal(transitions.update(), true);
    assert.deepEqual(calls, [
        ['save'],
        ['deactivate', game],
        ['enter', game]
    ]);
    assert.equal(game.currentRoom, nextRoom);
    assert.deepEqual(game.asteroids, []);
    assert.deepEqual(game.lootCrates, []);
    assert.deepEqual(game.shipwrecks, []);
    assert.deepEqual(game.explosions, []);
});

test('revisiting a room preserves the transition but does not autosave again', () => {
    const { calls, game, nextRoom, transitions } = createHarness({ visited: true });

    assert.equal(transitions.update(), true);
    assert.deepEqual(calls, [
        ['deactivate', game],
        ['enter', game]
    ]);
    assert.equal(game.currentRoom, nextRoom);
});

test('locked rooms prevent transitions and preserve active entities', () => {
    const { calls, currentRoom, game, transitions } = createHarness({ locked: true });

    assert.equal(transitions.update(), false);
    assert.deepEqual(calls, []);
    assert.equal(game.currentRoom, currentRoom);
    assert.equal(game.asteroids.length, 1);
    assert.equal(game.lootCrates.length, 1);
    assert.equal(game.shipwrecks.length, 1);
    assert.equal(game.explosions.length, 1);
});

test('a guest room crossing pulls every ship into the destination', () => {
    const { game, currentRoom, nextRoom, transitions } = createHarness();
    currentRoom.locked = false;
    nextRoom.x = 2000;
    nextRoom.y = 0;
    nextRoom.width = 2000;
    nextRoom.height = 2000;
    game.x = 1000;
    game.y = 1000;
    const peer = {
        ship: {
            x: 2050,
            y: 1100,
            vx: 50,
            vy: -20,
            isDead: false
        },
        suspended: false
    };
    game.peerNetwork = {
        isHost: true,
        simulation: {
            peers: new Map([['guest_1', peer]]),
            getPickupPlayers: () => [{
                id: 'host',
                ship: game.playerShip,
                x: game.x,
                y: game.y
            }, {
                id: 'guest_1',
                ship: peer.ship,
                x: peer.ship.x,
                y: peer.ship.y
            }]
        }
    };
    game.levelGen.getRoomAtWorldPos = x =>
        x >= 2000 ? nextRoom : currentRoom;

    assert.equal(transitions.update(), true);
    assert.equal(game.currentRoom, nextRoom);
    assert.equal(game.x, 2050);
    assert.equal(game.y, 1100);
    assert.equal(peer.ship.x, 2050);
    assert.equal(peer.ship.y, 1100);
    assert.equal(peer.ship.vx, 0);
    assert.equal(peer.ship.vy, 0);
});

test('map teleport stores the old room and activates the destination room', () => {
    const audioCalls = [];
    const notifications = [];
    const room = {
        x: 4000,
        y: 6000,
        width: 2000,
        height: 4000,
        onEnter(game) {
            game.asteroids = [{ room: 'destination' }];
            game.lootCrates = [{ room: 'destination' }];
            game.shipwrecks = [{ room: 'destination' }];
        }
    };
    const oldRoom = {
        deactivate(game) {
            this.asteroids = [...game.asteroids];
            this.lootCrates = [...game.lootCrates];
            this.shipwrecks = [...game.shipwrecks];
        }
    };
    const game = {
        x: 1,
        y: 2,
        vx: 3,
        vy: 4,
        currentRoom: oldRoom,
        projectiles: [{}],
        asteroids: [{}],
        lootCrates: [{}],
        shipwrecks: [{}],
        explosions: [{}],
        audio: {
            sounds: {},
            play: (...args) => audioCalls.push(args)
        },
        showNotification: (...args) => notifications.push(args)
    };
    const transitions = new RoomTransitionSystem(game);

    assert.equal(transitions.teleportToRoom(room), true);
    assert.equal(game.x, 5000);
    assert.equal(game.y, 8000);
    assert.equal(game.vx, 0);
    assert.equal(game.vy, 0);
    assert.equal(game.currentRoom, room);
    assert.deepEqual(game.projectiles, []);
    assert.deepEqual(oldRoom.asteroids, [{}]);
    assert.deepEqual(oldRoom.lootCrates, [{}]);
    assert.deepEqual(oldRoom.shipwrecks, [{}]);
    assert.deepEqual(game.asteroids, [{ room: 'destination' }]);
    assert.deepEqual(game.lootCrates, [{ room: 'destination' }]);
    assert.deepEqual(game.shipwrecks, [{ room: 'destination' }]);
    assert.deepEqual(game.explosions, []);
    assert.deepEqual(notifications, [['teleported!', '#00ffff']]);
    assert.deepEqual(audioCalls, [
        ['respawn', { volume: 0.5 }],
        ['dash', { volume: 0.5, pitch: 0.5 }]
    ]);
});

test('map teleport keeps the respawn sound when it exists', () => {
    const audioCalls = [];
    const game = {
        projectiles: [],
        asteroids: [],
        lootCrates: [],
        shipwrecks: [],
        explosions: [],
        audio: {
            sounds: { respawn: {} },
            play: (...args) => audioCalls.push(args)
        },
        showNotification() {}
    };
    const transitions = new RoomTransitionSystem(game);

    transitions.teleportToRoom({
        x: 0,
        y: 0,
        width: 2000,
        height: 2000,
        onEnter() {}
    });

    assert.deepEqual(audioCalls, [['respawn', { volume: 0.5 }]]);
});

test('host map teleport pulls every peer to the destination center', () => {
    const peer = {
        ship: { x: 20, y: 30, vx: 4, vy: 5 }
    };
    const game = {
        x: 10,
        y: 15,
        vx: 2,
        vy: 3,
        projectiles: [],
        asteroids: [],
        lootCrates: [],
        shipwrecks: [],
        explosions: [],
        peerNetwork: {
            isHost: true,
            simulation: {
                peers: new Map([['guest_1', peer]])
            }
        },
        audio: {
            sounds: { respawn: {} },
            play() {}
        },
        showNotification() {}
    };
    const transitions = new RoomTransitionSystem(game);

    transitions.teleportToRoom({
        x: 4000,
        y: 7000,
        width: 2000,
        height: 2000,
        onEnter() {}
    });

    assert.deepEqual(
        [game.x, game.y, game.vx, game.vy],
        [5000, 8000, 0, 0]
    );
    assert.deepEqual(
        [peer.ship.x, peer.ship.y, peer.ship.vx, peer.ship.vy],
        [5000, 8000, 0, 0]
    );
});

test('locked room bounds clamp both axes and stop outward velocity', () => {
    const game = {
        x: 50,
        y: 1050,
        vx: -200,
        vy: 300,
        currentRoom: {
            x: 100,
            y: 200,
            width: 1000,
            height: 800,
            locked: true
        }
    };
    const transitions = new RoomTransitionSystem(game);

    transitions.enforceCurrentRoomBounds();

    assert.equal(game.x, 130);
    assert.equal(game.y, 970);
    assert.equal(game.vx, 0);
    assert.equal(game.vy, 0);
});

test('open room edges clamp only when the exact neighbor probes miss', () => {
    const probes = [];
    const game = {
        x: 50,
        y: 1050,
        vx: -200,
        vy: 300,
        currentRoom: {
            x: 100,
            y: 200,
            width: 1000,
            height: 800,
            locked: false
        },
        levelGen: {
            getRoomAtWorldPos: (x, y) => {
                probes.push([x, y]);
                return null;
            }
        }
    };
    const transitions = new RoomTransitionSystem(game);

    transitions.enforceCurrentRoomBounds();

    assert.deepEqual(probes, [
        [90, 1050],
        [130, 1010]
    ]);
    assert.equal(game.x, 130);
    assert.equal(game.y, 970);
    assert.equal(game.vx, 0);
    assert.equal(game.vy, 0);
});

test('open room neighbors preserve edge crossing position and velocity', () => {
    const probes = [];
    const game = {
        x: 50,
        y: 1050,
        vx: -200,
        vy: 300,
        currentRoom: {
            x: 100,
            y: 200,
            width: 1000,
            height: 800,
            locked: false
        },
        levelGen: {
            getRoomAtWorldPos: (x, y) => {
                probes.push([x, y]);
                return {};
            }
        }
    };
    const transitions = new RoomTransitionSystem(game);

    transitions.enforceCurrentRoomBounds();

    assert.deepEqual(probes, [
        [90, 1050],
        [50, 1010]
    ]);
    assert.equal(game.x, 50);
    assert.equal(game.y, 1050);
    assert.equal(game.vx, -200);
    assert.equal(game.vy, 300);
});
