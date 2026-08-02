import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsSystem } from './PhysicsSystem.js';

function createBody(overrides = {}) {
    return {
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        radius: 10,
        rotSpeed: 0,
        isDead: false,
        isBroken: false,
        isOpened: false,
        update() {},
        ...overrides
    };
}

function createHarness(overrides = {}) {
    const game = {
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        rotation: 0,
        currentRoom: null,
        camera: { shake: 0 },
        playerShip: {
            isDead: false,
            getUniqueParts: () => [{ x: 0, y: 0 }]
        },
        asteroids: [],
        lootCrates: [],
        ...overrides
    };

    return {
        game,
        system: new PhysicsSystem(game, {
            random: () => 0.5,
            tileSize: 28
        })
    };
}

test('exact-center asteroid hits keep the original player bump finite', () => {
    const asteroid = createBody({ radius: 20 });
    const { game, system } = createHarness({
        asteroids: [asteroid]
    });

    system.update(0.1);

    assert.equal(game.x, 102);
    assert.equal(game.y, 100);
    assert.equal(game.vx, 300);
    assert.equal(game.vy, 0);
    assert.equal(asteroid.vx, -150);
    assert.equal(asteroid.vy, 0);
    assert.equal(game.camera.shake, 5);
});

test('perfectly overlapping asteroids separate without corrupting physics', () => {
    const first = createBody();
    const second = createBody();
    const { system } = createHarness({
        x: 1000,
        y: 1000,
        asteroids: [first, second]
    });

    system.update(0.1);

    assert.equal(first.x, 110);
    assert.equal(second.x, 90);
    assert.equal(first.vx, 10);
    assert.equal(second.vx, -10);
    for (const value of [
        first.x,
        first.y,
        first.vx,
        first.vy,
        second.x,
        second.y,
        second.vx,
        second.vy
    ]) {
        assert.equal(Number.isFinite(value), true);
    }
});

test('near-overlap asteroid separation keeps the original normalized direction', () => {
    const first = createBody({ x: 100.03, y: 100.04 });
    const second = createBody();
    const { system } = createHarness({
        x: 1000,
        y: 1000,
        asteroids: [first, second]
    });

    system.update(0.1);

    assert.ok(Math.abs(first.vx - 6) < 0.000001);
    assert.ok(Math.abs(first.vy - 8) < 0.000001);
    assert.ok(Math.abs(second.vx + 6) < 0.000001);
    assert.ok(Math.abs(second.vy + 8) < 0.000001);
});

test('exact-center crate hits keep the original momentum transfer', () => {
    const crate = createBody({ radius: 20 });
    const { game, system } = createHarness({
        lootCrates: [crate]
    });

    system.update(0.1);

    assert.equal(game.x, 102);
    assert.equal(game.y, 100);
    assert.equal(game.vx, 200);
    assert.equal(game.vy, 0);
    assert.equal(crate.vx, -300);
    assert.equal(crate.vy, 0);
    assert.equal(crate.rotSpeed, 0);
});

test('dead spectators do not collide while world debris keeps updating', () => {
    const asteroid = createBody({
        radius: 20,
        update() {
            this.x += 1;
        }
    });
    const crate = createBody({
        radius: 20,
        update() {
            this.y += 1;
        }
    });
    const { game, system } = createHarness({
        playerShip: {
            isDead: true,
            getUniqueParts: () => [{ x: 0, y: 0 }]
        },
        asteroids: [asteroid],
        lootCrates: [crate]
    });

    system.collidePlayerWithAsteroid(asteroid, 0.1);
    system.collidePlayerWithCrate(crate, 0.1);
    crate.x = 500;
    crate.y = 500;
    system.update(0.1);

    assert.equal(game.x, 100);
    assert.equal(game.y, 100);
    assert.equal(game.vx, 0);
    assert.equal(game.vy, 0);
    assert.equal(asteroid.x, 101);
    assert.equal(crate.y, 501);
});

test('perfectly overlapping crates and asteroids retain the heavy impact ratio', () => {
    const asteroid = createBody();
    const crate = createBody();
    const { system } = createHarness({
        x: 1000,
        y: 1000,
        asteroids: [asteroid],
        lootCrates: [crate]
    });

    system.update(0.1);

    assert.equal(crate.x, 90);
    assert.equal(asteroid.x, 110);
    assert.equal(crate.vx, -100);
    assert.equal(asteroid.vx, 10);
    assert.equal(crate.rotSpeed, 0);
});

test('room containment preserves the original edge bounce signs', () => {
    const asteroid = createBody({
        x: 0,
        y: 500,
        vx: -20,
        vy: 0,
        radius: 10
    });
    const crate = createBody({
        x: 500,
        y: 1000,
        vx: 0,
        vy: 20,
        radius: 10,
        isOpened: true
    });
    const { system } = createHarness({
        x: 500,
        y: 500,
        currentRoom: {
            x: 0,
            y: 0,
            width: 1000,
            height: 1000
        },
        asteroids: [asteroid],
        lootCrates: [crate]
    });

    system.update(0.1);

    assert.equal(asteroid.x, 10);
    assert.equal(asteroid.vx, 20);
    assert.equal(crate.y, 990);
    assert.equal(crate.vy, -20);
});

test('host physics applies the same asteroid collision to guest ships', () => {
    const asteroid = createBody({ radius: 20 });
    const guestShip = {
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        rotation: 0,
        isDead: false,
        getUniqueParts: () => [{ x: 0, y: 0 }]
    };
    const { game, system } = createHarness({
        x: 1000,
        y: 1000,
        asteroids: [asteroid],
        peerNetwork: {
            isHost: true,
            simulation: {
                peers: new Map([[
                    'guest_1',
                    { ship: guestShip, suspended: false }
                ]])
            }
        }
    });

    system.update(0.1);

    assert.equal(game.x, 1000);
    assert.equal(game.y, 1000);
    assert.equal(guestShip.x, 102);
    assert.equal(guestShip.y, 100);
    assert.equal(guestShip.vx, 300);
    assert.equal(guestShip.vy, 0);
    assert.equal(game.camera.shake, 0);
});
