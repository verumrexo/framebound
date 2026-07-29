import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { WeaponSystem } = await import('./WeaponSystem.js');
const { PartsLibrary, TILE_SIZE } = await import('../../shared/parts/Part.js');

function makeGame(part, overrides = {}) {
    const calls = [];
    const game = {
        x: 100,
        y: 200,
        rotation: 0,
        playerShip: {
            stats: { accelerantCount: 0, rocketBayCount: 0 },
            getUniqueParts: () => [part]
        },
        input: { getMousePos: () => ({ x: 0, y: 0 }) },
        designer: { active: false },
        mouseDownLastFrame: false,
        audio: {
            play: (...args) => {
                calls.push(['audio', ...args]);
                return { stop: () => calls.push(['stop-charge']) };
            }
        },
        network: {
            isConnected: false,
            sendShoot: (...args) => calls.push(['network', ...args])
        },
        spawnProjectile: (...args) => calls.push(['shot', ...args]),
        projectiles: [],
        ...overrides
    };
    return { game, calls };
}

class ProjectileStub {
    constructor(...args) {
        this.args = args;
    }
}

function updateState(overrides = {}) {
    return {
        isMouseDown: true,
        worldMouseX: 1000,
        worldMouseY: 200,
        levelBonus: 1,
        ...overrides
    };
}

test('a basic weapon fires immediately from the original muzzle and applies cooldown', () => {
    const part = { partId: 'gun_basic', x: 0, y: 0, rotation: 0 };
    const { game, calls } = makeGame(part);
    const system = new WeaponSystem(game);
    const def = PartsLibrary.gun_basic;

    const result = system.update(0.016, updateState());

    const shot = calls.find(call => call[0] === 'shot');
    assert.ok(shot);
    assert.equal(shot[1], def);
    assert.equal(shot[5], part);
    assert.ok(Math.abs(shot[2] - (100 + TILE_SIZE * 0.6)) < 1e-9);
    assert.equal(shot[3], 200);
    assert.equal(shot[4], 0);
    assert.equal(part.cooldown, def.stats.cooldown);
    assert.deepEqual(result, { isMouseDown: true, blockedFrame: false });
});

test('rocket bay bonus creates a same-frame burst and preserves its shortened interval', () => {
    const rocketId = Object.keys(PartsLibrary).find(id =>
        PartsLibrary[id]?.type === 'weapon' &&
        PartsLibrary[id]?.stats?.weaponGroup === 'rocket'
    );
    assert.ok(rocketId, 'expected a rocket weapon definition');

    const part = { partId: rocketId, x: 0, y: 0, rotation: 0 };
    const { game, calls } = makeGame(part);
    game.playerShip.stats.rocketBayCount = 2;
    const system = new WeaponSystem(game);
    const def = PartsLibrary[rocketId];

    system.update(0.016, updateState());

    assert.equal(calls.filter(call => call[0] === 'shot').length, 1);
    assert.equal(part.burstLeft, (def.stats.burstCount || 1) + 1);
    assert.equal(part.burstTimer, (def.stats.burstInterval || 0.1) / 3);
});

test('charge weapons retain charge across release and fire on the next press', () => {
    const chargeId = Object.keys(PartsLibrary).find(id =>
        PartsLibrary[id]?.type === 'weapon' &&
        PartsLibrary[id]?.stats?.chargeTime
    );
    assert.ok(chargeId, 'expected a charge weapon definition');

    const part = { partId: chargeId, x: 0, y: 0, rotation: 0 };
    const { game, calls } = makeGame(part);
    const system = new WeaponSystem(game);
    const def = PartsLibrary[chargeId];

    system.update(0.016, updateState());
    assert.equal(part.chargeLeft, def.stats.chargeTime);
    assert.equal(calls.filter(call => call[0] === 'shot').length, 0);

    system.update(def.stats.chargeTime + 0.01, updateState({ isMouseDown: false }));
    assert.equal(part.chargeReady, true);
    assert.equal(calls.filter(call => call[0] === 'shot').length, 0);

    system.update(0.016, updateState());
    assert.equal(part.chargeLeft, undefined);
    assert.equal(part.chargeReady, false);
    assert.equal(calls.filter(call => call[0] === 'shot').length, 1);
    assert.ok(calls.some(call => call[0] === 'stop-charge'));
});

test('initial and burst origins preserve their intentionally different turret-offset rules', () => {
    const part = { partId: 'gun_basic', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    const system = new WeaponSystem(game);
    const def = {
        width: 1,
        height: 1,
        turretDrawOffset: { x: 12, y: 7 },
        stats: { barrelPosition: { x: 20, y: 3 } }
    };

    const initial = system.getInitialShotOrigin(part, def, 1000, 200);
    const burst = system.getBurstShotOrigin(part, def, 1000, 200);

    assert.equal(initial.fireX, 132);
    assert.equal(initial.fireY, 210);
    assert.equal(burst.fireX, 120);
    assert.equal(burst.fireY, 203);
});

test('projectile construction preserves type, rocket speed, damage, lifetime, and sound identity', () => {
    const part = { partId: 'rocketle' };
    const { game, calls } = makeGame(part);
    game.playerShip.permanentStats = { missileSpeedMul: 1.5 };
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });
    const def = {
        id: 'rocketle',
        stats: {
            weaponGroup: 'rocket',
            projectileType: 'rocket',
            projectileSpeed: 400,
            damage: 25,
            lifetime: 7,
            soundVolume: 0.4,
            soundPitch: 0.8
        }
    };

    system.spawnProjectile(def, 10, 20, 0.25, part);

    assert.deepEqual(game.projectiles[0].args, [
        10, 20, 0.25, 'rocket', 600, 'player', 25, 7
    ]);
    assert.deepEqual(calls.at(-1), [
        'audio',
        'shoot_rocketle',
        { volume: 0.4, pitch: 0.8, randomizePitch: 0.15 }
    ]);
});

test('pellets retain perpendicular barrel spacing and randomized per-pellet delay', () => {
    const part = { partId: 'scattr' };
    const { game } = makeGame(part);
    const values = [0.5, 0, 0.5, 0.5, 0.5, 1];
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => values.shift()
    });
    const def = {
        id: 'scattr',
        stats: {
            pelletCount: 3,
            pelletInterval: 0.2,
            barrelSpacing: 10,
            spread: 0
        }
    };

    system.spawnProjectile(def, 100, 200, 0, part);

    assert.deepEqual(game.projectiles.map(projectile => projectile.args.slice(0, 2)), [
        [100, 190],
        [100, 200],
        [100, 210]
    ]);
    assert.deepEqual(game.projectiles.map(projectile => projectile.delay), [
        0,
        0.2,
        0.6000000000000001
    ]);
});

test('freeze beam keeps four visual-only ticks and one damaging/audio tick', () => {
    const part = { partId: 'custom_1769336961268' };
    const { game, calls } = makeGame(part);
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });
    const def = {
        id: 'custom_1769336961268',
        stats: {
            projectileType: 'beam_freeze'
        }
    };

    for (let i = 0; i < 5; i++) {
        system.spawnProjectile(def, 0, 0, 0, part);
    }

    assert.deepEqual(
        game.projectiles.map(projectile => ({
            beam: projectile.isBeam,
            visualOnly: projectile.isVisualOnly === true
        })),
        [
            { beam: true, visualOnly: true },
            { beam: true, visualOnly: true },
            { beam: true, visualOnly: true },
            { beam: true, visualOnly: true },
            { beam: true, visualOnly: false }
        ]
    );
    assert.equal(calls.filter(call => call[0] === 'audio').length, 1);
    assert.deepEqual(calls.at(-1), [
        'audio',
        'shoot_lsr',
        { volume: 0.6, pitch: 0.5, randomizePitch: 0.15 }
    ]);
});

test('velocity shots still apply visual recoil', () => {
    const part = { partId: 'gun_basic' };
    const { game } = makeGame(part);
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });

    system.spawnProjectile({
        id: 'gun_basic',
        stats: { weaponGroup: 'velocity' }
    }, 0, 0, 0, part);

    assert.equal(part.recoil, 5);
});
