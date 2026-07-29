import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameRuntimeSystem } from './FrameRuntimeSystem.js';

function createGame(overrides = {}) {
    const calls = [];
    const record = name => (...args) => {
        calls.push([name, ...args]);
    };
    const game = {
        running: true,
        playerShip: {},
        mouseDownLastFrame: false,
        level: 4,
        coreSpinAngle: 1,
        x: 120,
        y: 240,
        input: {
            isMouseDown: () => true,
            getMousePos: () => ({ x: 12, y: 34 }),
            clearPressed: record('clear-input')
        },
        fullscreenMapInput: { update: () => false },
        gameOverController: { update: () => false },
        effects: {
            updateDamageNumbers: record('damage-numbers'),
            updateExplosions: record('explosions'),
            updateNotifications: record('notifications')
        },
        gameplayOverlays: { update: () => false },
        playerStateGuard: { repairNonFiniteState: record('state-guard') },
        itemPickupSystem: { update: record('pickups') },
        playerControls: {
            updateDash: record('dash'),
            sampleMovementAxes: () => {
                calls.push(['sample-movement']);
                return { x: 0.5, y: -0.25 };
            },
            applyMovement: (...args) => {
                calls.push(['movement', ...args]);
                return { worldMouseX: 700, worldMouseY: 800 };
            }
        },
        worldInteractions: { update: record('interactions') },
        roomRuntime: { update: record('room') },
        weaponSystem: {
            update: (...args) => {
                calls.push(['weapons', ...args]);
                return { isMouseDown: false, blockedFrame: false };
            }
        },
        projectileSystem: { update: record('projectiles') },
        floorProgression: {
            updatePortals: dt => {
                calls.push(['portals', dt]);
                return false;
            }
        },
        droneSystem: { update: record('drones') },
        enemyLifecycle: { update: record('enemies') },
        resourceOrbs: { update: record('orbs') },
        playerRecovery: { update: record('recovery') },
        physicsSystem: { update: record('physics') },
        camera: {
            follow: record('camera-follow'),
            update: record('camera-update')
        },
        networkManager: { update: record('network') },
        ...overrides
    };

    return { game, calls };
}

test('frame runtime preserves the complete active-frame order and derived values', () => {
    const { game, calls } = createGame();

    new FrameRuntimeSystem(game).update(0.25);

    assert.deepEqual(calls, [
        ['damage-numbers', 0.25],
        ['state-guard'],
        ['pickups', 0.25],
        ['dash', 0.25],
        ['sample-movement'],
        ['interactions', 0.25],
        ['movement', 0.25, { x: 12, y: 34 }, { x: 0.5, y: -0.25 }],
        ['room'],
        ['weapons', 0.25, {
            isMouseDown: true,
            worldMouseX: 700,
            worldMouseY: 800,
            levelBonus: 1.03
        }],
        ['projectiles', 0.25],
        ['portals', 0.25],
        ['explosions', 0.25],
        ['drones', 0.25],
        ['enemies', 0.25],
        ['orbs', 0.25],
        ['recovery', 0.25, 1.03],
        ['physics', 0.25],
        ['notifications', 0.25],
        ['camera-follow', { x: 120, y: 240 }],
        ['camera-update', 0.25],
        ['clear-input'],
        ['network', 0.25]
    ]);
    assert.equal(game.coreSpinAngle, 1 + Math.PI / 2);
    assert.equal(game.mouseDownLastFrame, false);
});

test('frame runtime does nothing before a run and before a local player exists', () => {
    for (const overrides of [
        { running: false },
        { playerShip: null }
    ]) {
        const { game, calls } = createGame(overrides);
        new FrameRuntimeSystem(game).update(0.1);
        assert.deepEqual(calls, []);
    }
});

test('frame runtime preserves fullscreen-map and overlay early-return boundaries', () => {
    const mapCase = createGame({
        fullscreenMapInput: { update: () => true }
    });
    new FrameRuntimeSystem(mapCase.game).update(0.1);
    assert.deepEqual(mapCase.calls, []);

    const overlayCase = createGame({
        gameplayOverlays: { update: () => true }
    });
    new FrameRuntimeSystem(overlayCase.game).update(0.1);
    assert.deepEqual(overlayCase.calls, [['damage-numbers', 0.1]]);
});

test('frame runtime preserves weapon and portal early-return boundaries', () => {
    const weaponCase = createGame();
    weaponCase.game.weaponSystem.update = (...args) => {
        weaponCase.calls.push(['weapons', ...args]);
        return { isMouseDown: true, blockedFrame: true };
    };
    new FrameRuntimeSystem(weaponCase.game).update(0.1);
    assert.equal(
        weaponCase.calls.some(([name]) => name === 'projectiles'),
        false
    );

    const portalCase = createGame();
    portalCase.game.floorProgression.updatePortals = dt => {
        portalCase.calls.push(['portals', dt]);
        return true;
    };
    new FrameRuntimeSystem(portalCase.game).update(0.1);
    assert.equal(
        portalCase.calls.some(([name]) => name === 'explosions'),
        false
    );
});

test('peer guests predict movement but skip local world authority', () => {
    const { game, calls } = createGame({
        peerNetwork: {
            isGuest: true,
            sendFireIntent: (...args) =>
                calls.push(['fire-intent', ...args]),
            updateGuest: (...args) =>
                calls.push(['peer-guest', ...args])
        }
    });

    new FrameRuntimeSystem(game).update(0.25);

    assert.deepEqual(calls.map(call => call[0]), [
        'damage-numbers',
        'state-guard',
        'dash',
        'sample-movement',
        'movement',
        'fire-intent',
        'peer-guest',
        'explosions',
        'notifications',
        'camera-follow',
        'camera-update',
        'clear-input'
    ]);
    assert.equal(calls.some(([name]) => name === 'interactions'), false);
    assert.equal(calls.some(([name]) => name === 'projectiles'), false);
    assert.equal(calls.some(([name]) => name === 'enemies'), false);
    assert.equal(calls.some(([name]) => name === 'physics'), false);
});

test('dead guest sends neutral input and follows a living teammate', () => {
    const teammate = { x: 900, y: 800, isDead: false };
    const { game, calls } = createGame({
        isSpectating: true,
        playerShip: { isDead: true },
        peerNetwork: {
            isGuest: true,
            spectatorTarget: teammate,
            sendInput: (...args) => calls.push(['peer-input', ...args]),
            sendFireIntent: (...args) =>
                calls.push(['fire-intent', ...args]),
            updateGuest: (...args) =>
                calls.push(['peer-guest', ...args])
        }
    });

    new FrameRuntimeSystem(game).update(0.25);

    assert.deepEqual(calls, [
        ['damage-numbers', 0.25],
        ['peer-input', {
            up: false,
            down: false,
            left: false,
            right: false,
            shift: false,
            analogX: 0,
            analogY: 0,
            aimAngle: null
        }],
        ['fire-intent', false, 0],
        ['peer-guest', 0.25],
        ['explosions', 0.25],
        ['notifications', 0.25],
        ['camera-follow', teammate],
        ['camera-update', 0.25],
        ['clear-input']
    ]);
});

test('dead host keeps world authority running until boss resurrection', () => {
    const teammate = { x: 700, y: 600, isDead: false };
    const { game, calls } = createGame({
        isSpectating: true,
        playerShip: { isDead: true },
        peerNetwork: {
            isGuest: false,
            spectatorTarget: teammate,
            updateHost: (...args) => calls.push(['peer-host', ...args])
        }
    });

    new FrameRuntimeSystem(game).update(0.25);

    assert.deepEqual(calls, [
        ['damage-numbers', 0.25],
        ['peer-host', 0.25],
        ['projectiles', 0.25],
        ['explosions', 0.25],
        ['drones', 0.25],
        ['enemies', 0.25],
        ['recovery', 0.25, 1.03],
        ['physics', 0.25],
        ['notifications', 0.25],
        ['camera-follow', teammate],
        ['camera-update', 0.25],
        ['clear-input']
    ]);
    assert.equal(calls.some(([name]) => name === 'movement'), false);
    assert.equal(calls.some(([name]) => name === 'weapons'), false);
    assert.equal(calls.some(([name]) => name === 'portals'), false);
    assert.equal(calls.some(([name]) => name === 'orbs'), false);
});
