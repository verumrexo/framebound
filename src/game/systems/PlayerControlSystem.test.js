import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerControlSystem } from './PlayerControlSystem.js';

function createHarness({
    keys = [],
    parts = [],
    shipUpdate = null
} = {}) {
    const calls = [];
    const down = new Set(keys);
    const ship = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotation: 0,
        stats: { boosterCount: 0 },
        parts: new Map(parts.map((part, index) => [index, part])),
        update(dt, inputState, options) {
            calls.push([
                'ship-update',
                dt,
                { ...inputState },
                { ...options },
                this.x,
                this.y,
                this.vx,
                this.vy,
                this.rotation
            ]);
            if (shipUpdate) shipUpdate.call(this, dt, inputState, options);
        }
    };
    const game = {
        x: 100,
        y: 200,
        vx: 0,
        vy: 0,
        rotation: 0,
        dashCooldown: 0,
        dashMaxCooldown: 10,
        dashActiveTimer: 0,
        dashDuration: 1.5,
        dashPower: 4000,
        playerShip: ship,
        input: { isKeyDown: key => down.has(key) },
        camera: { x: 20, y: 30, zoom: 2 },
        currentRoom: { cleared: false },
        showNotification: (...args) => calls.push(['notification', ...args]),
        audio: { play: (...args) => calls.push(['audio', ...args]) },
        network: {
            isConnected: false,
            sendInput: input => calls.push(['network', input])
        }
    };
    return { game, ship, calls, system: new PlayerControlSystem(game) };
}

test('dash keeps the original cooldown, duration, thrust, feedback, and update order', () => {
    const { game, ship, calls, system } = createHarness({ keys: ['ShiftLeft'] });
    ship.stats.boosterCount = 2;

    system.updateDash(0.1);

    assert.equal(game.dashCooldown, 5);
    assert.equal(game.dashActiveTimer, 1.4);
    assert.ok(Math.abs(game.vx) < 1e-9);
    assert.equal(game.vy, -400);
    assert.deepEqual(calls, [
        ['notification', 'dash system pulse', '#00ffff'],
        ['audio', 'dash', { volume: 0.7 }]
    ]);
});

test('movement axes sample desktop wasd controls', () => {
    const { system } = createHarness({ keys: ['KeyW', 'KeyD'] });

    const axes = system.sampleMovementAxes();
    const { inputState } = system.applyMovement(0.016, { x: 0, y: 0 }, axes);

    assert.deepEqual(axes, { inputX: 1, inputY: -1 });
    assert.equal(inputState.up, true);
    assert.equal(inputState.down, false);
    assert.equal(inputState.left, false);
    assert.equal(inputState.right, true);
    assert.equal(inputState.analogX, 1);
    assert.equal(inputState.analogY, -1);
});

test('ship state is synchronized both directions with movement options', () => {
    const { game, ship, calls, system } = createHarness({
        shipUpdate() {
            this.x += 3;
            this.y += 4;
            this.vx = 5;
            this.vy = 6;
            this.rotation = 7;
        }
    });
    game.x = 11;
    game.y = 12;
    game.vx = 13;
    game.vy = 14;
    game.rotation = 15;
    game.currentRoom.cleared = true;
    game.dashActiveTimer = 1;
    game.network.isConnected = true;

    const result = system.applyMovement(0.25, { x: 40, y: 60 }, { inputX: 0, inputY: 0 });

    assert.equal(result.inputState.aimAngle, null);
    assert.equal(result.worldMouseX, 40);
    assert.equal(result.worldMouseY, 60);
    assert.deepEqual(calls[0].slice(0, 3), ['ship-update', 0.25, result.inputState]);
    assert.deepEqual(calls[0][3], {
        movementMultiplier: 2,
        externalDashActive: true
    });
    assert.deepEqual(calls[0].slice(4), [11, 12, 13, 14, 15]);
    assert.deepEqual(
        { x: game.x, y: game.y, vx: game.vx, vy: game.vy, rotation: game.rotation },
        { x: 14, y: 16, vx: 5, vy: 6, rotation: 7 }
    );
    assert.equal(calls[1][0], 'network');
    assert.equal(calls[1][1], result.inputState);
    assert.equal(ship.x, 14);
});

test('tracker aim uses world mouse while ordinary ships face velocity only above 50 speed', () => {
    const tracked = createHarness({
        parts: [{ partId: 'custom_1768410456823' }]
    });
    const trackedResult = tracked.system.applyMovement(
        0.016,
        { x: 160, y: 340 },
        { inputX: 0, inputY: 0 }
    );
    assert.equal(trackedResult.worldMouseX, 100);
    assert.equal(trackedResult.worldMouseY, 200);
    assert.equal(trackedResult.inputState.aimAngle, Math.PI / 2);

    const ordinary = createHarness();
    ordinary.game.vx = 50;
    let result = ordinary.system.applyMovement(0.016, { x: 0, y: 0 }, { inputX: 0, inputY: 0 });
    assert.equal(result.inputState.aimAngle, null);

    ordinary.game.vx = 51;
    result = ordinary.system.applyMovement(0.016, { x: 0, y: 0 }, { inputX: 0, inputY: 0 });
    assert.equal(result.inputState.aimAngle, Math.PI / 2);
});
