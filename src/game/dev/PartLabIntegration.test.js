import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameRuntimeSystem } from '../systems/FrameRuntimeSystem.js';
import { EnemyLifecycleSystem } from '../systems/EnemyLifecycleSystem.js';

test('part lab simulation owns one complete game update while active', () => {
    let updates = 0;
    const runtime = new FrameRuntimeSystem({
        partLabSimulation: { active: true, update: () => { updates++; } },
        running: false,
        playerShip: null
    });
    runtime.update(0.016);
    assert.equal(updates, 1);
});

test('part lab frame samples real control, runs each combat system once, and follows the arena', () => {
    const calls = [];
    const record = name => (...args) => calls.push([name, ...args]);
    const game = {
        running: true,
        playerShip: {},
        mouseDownLastFrame: false,
        level: 1,
        coreSpinAngle: 0,
        x: 20,
        y: 30,
        input: {
            isMouseDown: () => true,
            getMousePos: () => ({ x: 100, y: 120, wasRightPressed: false }),
            clearPressed: record('clear')
        },
        effects: {
            updateDamageNumbers: record('damage'),
            updateExplosions: record('explosions'),
            updateNotifications: record('notifications')
        },
        playerStateGuard: { repairNonFiniteState: record('guard') },
        abilitySystem: { update: record('abilities') },
        playerControls: {
            updateDash: record('dash'),
            sampleMovementAxes: () => {
                calls.push(['sample']);
                return { inputX: 1, inputY: 0 };
            },
            applyMovement: (...args) => {
                calls.push(['movement', ...args]);
                return { worldMouseX: 500, worldMouseY: 600 };
            }
        },
        weaponSystem: {
            update: (...args) => {
                calls.push(['weapons', ...args]);
                return { isMouseDown: true, blockedFrame: false };
            }
        },
        projectileSystem: { update: record('projectiles') },
        droneSystem: { update: record('drones') },
        enemyLifecycle: { update: record('enemies') },
        resourceOrbs: { update: record('orbs') },
        playerRecovery: { update: record('recovery') },
        physicsSystem: { update: record('physics') },
        camera: {
            follow: record('camera-follow'),
            update: record('camera-update')
        }
    };

    new FrameRuntimeSystem(game).updatePartLabFrame(0.25, {
        afterEnemyUpdate: () => calls.push(['dart-cadence'])
    });

    assert.deepEqual(calls.map(([name]) => name), [
        'damage', 'guard', 'abilities', 'dash', 'sample', 'movement',
        'weapons', 'projectiles', 'explosions', 'drones', 'enemies',
        'dart-cadence', 'orbs', 'recovery', 'physics', 'notifications',
        'camera-follow', 'camera-update', 'clear'
    ]);
    assert.equal(calls.filter(([name]) => name === 'weapons').length, 1);
    assert.equal(calls.filter(([name]) => name === 'projectiles').length, 1);
    assert.equal(calls.filter(([name]) => name === 'camera-follow').length, 1);
    assert.equal(calls.find(([name]) => name === 'weapons')[2].isMouseDown, true);
    assert.deepEqual(calls.find(([name]) => name === 'camera-follow')[1], { x: 20, y: 30 });
});

test('part lab enemy updates stay local when an existing multiplayer run is connected', () => {
    let updated = 0;
    let interpolated = 0;
    const localShip = { isDead: false };
    const peerShip = { isDead: false };
    const enemy = {
        id: 'lab-enemy',
        x: 600,
        y: 0,
        radius: 20,
        isDead: false,
        update() { updated++; },
        interpolate() { interpolated++; }
    };
    const game = {
        partLabSimulation: { active: true },
        networkManager: { isConnected: true },
        playerShip: localShip,
        x: 0,
        y: 0,
        enemies: [enemy],
        bosses: [],
        projectiles: [],
        asteroids: [],
        lootCrates: [],
        decoys: [],
        peerNetwork: {
            isHost: true,
            simulation: {
                getPickupPlayers: () => [{ id: 'peer', ship: peerShip, x: 999, y: 999 }]
            }
        }
    };

    const lifecycle = new EnemyLifecycleSystem(game);
    assert.equal(lifecycle.targetFor(enemy).id, 'host');
    lifecycle.update(0.016);

    assert.equal(updated, 1);
    assert.equal(interpolated, 0);
});
