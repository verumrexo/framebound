import test from 'node:test';
import assert from 'node:assert/strict';

function createCanvas() {
    const canvas = { width: 0, height: 0 };
    const context = {
        canvas,
        clearRect() {},
        drawImage() {},
        fillRect() {}
    };
    canvas.getContext = () => context;
    return canvas;
}

globalThis.document = {
    createElement() {
        return createCanvas();
    }
};

const {
    PART_LAB_REVIEW_STATUS,
    PartLabEnemyDartCadence,
    PartLabSimulationController,
    capturePartLabGameState,
    restorePartLabGameState
} = await import('./PartLabSimulation.js');

const PARTS = {
    alpha: { name: 'alpha', type: 'weapon' },
    beta: { name: 'beta', type: 'hull' },
    gamma: { name: 'gamma', type: 'utility' },
    delta: { name: 'delta', type: 'drone' }
};

function createAdapter() {
    const liveState = {
        playerShip: { id: 'live-ship' },
        enemies: ['live-enemy'],
        paused: true
    };
    const calls = [];
    return {
        calls,
        liveState,
        captureState() {
            calls.push(['capture']);
            return liveState;
        },
        resetPart(partId) {
            calls.push(['reset', partId]);
            return { partId, test: true };
        },
        update(dt) {
            calls.push(['update', dt]);
            return { dt };
        },
        stop() {
            calls.push(['stop']);
        },
        restoreState(snapshot) {
            calls.push(['restore', snapshot]);
        }
    };
}

test('part lab navigation resets the arena and skips reviewed parts', () => {
    const adapter = createAdapter();
    const controller = new PartLabSimulationController({
        partsLibrary: PARTS,
        adapter,
        documentRef: null,
        autoMount: false
    });

    controller.start('alpha');
    assert.equal(controller.getState().currentPartId, 'alpha');
    assert.equal(controller.next().currentPartId, 'beta');
    assert.equal(controller.previous().currentPartId, 'alpha');
    controller.recordStatus('good', 'fine');
    controller.selectPart('gamma');
    controller.recordStatus('needs-work', 'needs a louder hit');
    controller.selectPart('alpha');

    assert.equal(controller.nextUntested().currentPartId, 'beta');
    assert.deepEqual(
        adapter.calls.filter(call => call[0] === 'reset').map(call => call[1]),
        ['alpha', 'beta', 'alpha', 'gamma', 'alpha', 'beta']
    );
});

test('enemy dart cadence emits exactly one dart per two seconds', () => {
    const cadence = new PartLabEnemyDartCadence();
    let shots = 0;

    assert.equal(cadence.update(1.99, () => shots++), 0);
    assert.equal(shots, 0);
    assert.equal(cadence.update(0.01, () => shots++), 1);
    assert.equal(shots, 1);
    assert.equal(cadence.update(4, () => shots++), 2);
    assert.equal(shots, 3);
});

test('stopping the simulation stops the adapter and restores the captured state', () => {
    const adapter = createAdapter();
    const controller = new PartLabSimulationController({
        partsLibrary: PARTS,
        adapter,
        documentRef: null,
        autoMount: false
    });

    const before = controller.start('beta');
    assert.equal(before.active, true);
    assert.equal(controller.stop(), true);
    assert.equal(controller.stop(), false);
    assert.equal(controller.getState().active, false);
    assert.deepEqual(adapter.calls.map(call => call[0]), [
        'capture',
        'reset',
        'stop',
        'restore'
    ]);
    assert.equal(adapter.calls[3][1], adapter.liveState);
});

test('reviews keep short notes per part and preserve them when status changes', () => {
    const adapter = createAdapter();
    const controller = new PartLabSimulationController({
        partsLibrary: PARTS,
        adapter,
        documentRef: null,
        autoMount: false
    });

    controller.start('delta');
    controller.recordStatus('good', 'flies nicely');
    assert.deepEqual(controller.getReview('delta'), {
        status: PART_LAB_REVIEW_STATUS.GOOD,
        notes: 'flies nicely'
    });
    controller.recordStatus('needs-work');
    assert.deepEqual(controller.getReview('delta'), {
        status: PART_LAB_REVIEW_STATUS.NEEDS_WORK,
        notes: 'flies nicely'
    });
    controller.setNotes('  shorter note  ');
    assert.deepEqual(controller.getReview('delta'), {
        status: PART_LAB_REVIEW_STATUS.NEEDS_WORK,
        notes: 'shorter note'
    });
});

test('simulation state restore puts world, camera, input, ability, telemetry, and audio state back exactly', () => {
    const originalShip = { id: 'original-ship' };
    const originalArrays = {
        enemies: ['enemy'],
        projectiles: ['projectile'],
        drones: ['drone'],
        decoys: ['decoy']
    };
    const game = {
        playerShip: originalShip,
        enemies: originalArrays.enemies,
        projectiles: originalArrays.projectiles,
        drones: originalArrays.drones,
        decoys: originalArrays.decoys,
        x: 12,
        y: 34,
        vx: 5,
        vy: 6,
        rotation: 0.4,
        running: true,
        paused: false,
        score: 17,
        camera: {
            x: 10,
            y: 20,
            zoom: 0.6,
            target: originalShip,
            shake: 2
        },
        input: {
            active: false,
            keys: new Set(['KeyA']),
            keysPressed: new Set(['KeyQ']),
            mouse: { x: 8, y: 9, isDown: true, wasPressed: false }
        },
        abilitySystem: { selectedIndex: 2, decoySerial: 7 },
        weaponSystem: { staggerTimers: { dart: 0.2 }, random: Math.random },
        projectileSystem: { projectileClock: 4, random: Math.random },
        combatTelemetry: {
            byPlayer: new Map([['host', new Map([['dart', { key: 'dart', damage: 9 }]])]])
        },
        audio: {
            eventBindings: new Map([['global:menu', 'menu']]),
            recentPlays: new Map([['global:menu', { count: 2, lastTime: 10 }]]),
            missingSoundWarnings: new Set(['menu'])
        }
    };
    const snapshot = capturePartLabGameState(game);

    game.playerShip = { id: 'simulation-ship' };
    game.enemies = [];
    game.projectiles = [{ id: 'new-projectile' }];
    game.drones = [{ id: 'new-drone' }];
    game.decoys = [{ id: 'new-decoy' }];
    game.x = 900;
    game.score = 999;
    game.camera.x = 900;
    game.camera.target = game.playerShip;
    game.input.active = true;
    game.input.keys.clear();
    game.input.keys.add('KeyD');
    game.input.mouse.x = 500;
    game.abilitySystem.selectedIndex = 0;
    game.abilitySystem.decoySerial = 99;
    game.combatTelemetry.byPlayer.clear();
    game.audio.eventBindings.set('part:dart:fire', 'forge:new');
    game.audio.recentPlays.set('part:dart:fire', { count: 12, lastTime: 20 });
    game.audio.missingSoundWarnings.add('forge:new');

    restorePartLabGameState(game, snapshot);

    assert.equal(game.playerShip, originalShip);
    assert.equal(game.enemies, originalArrays.enemies);
    assert.equal(game.projectiles, originalArrays.projectiles);
    assert.equal(game.drones, originalArrays.drones);
    assert.equal(game.decoys, originalArrays.decoys);
    assert.equal(game.x, 12);
    assert.equal(game.score, 17);
    assert.deepEqual(game.camera, {
        x: 10,
        y: 20,
        zoom: 0.6,
        target: originalShip,
        shake: 2
    });
    assert.deepEqual([...game.input.keys], ['KeyA']);
    assert.deepEqual([...game.input.keysPressed], ['KeyQ']);
    assert.equal(game.input.active, false);
    assert.equal(game.input.mouse.x, 8);
    assert.equal(game.abilitySystem.selectedIndex, 2);
    assert.equal(game.abilitySystem.decoySerial, 7);
    assert.deepEqual(game.audio.eventBindings, new Map([['global:menu', 'menu']]));
    assert.deepEqual(game.audio.recentPlays, new Map([['global:menu', { count: 2, lastTime: 10 }]]));
    assert.deepEqual(game.audio.missingSoundWarnings, new Set(['menu']));
    assert.deepEqual(game.combatTelemetry.byPlayer.get('host').get('dart'), {
        key: 'dart',
        damage: 9
    });
});
