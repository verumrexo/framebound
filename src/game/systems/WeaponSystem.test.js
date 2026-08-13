import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { WeaponSystem } = await import('./WeaponSystem.js');
const { PartsLibrary, TILE_SIZE } = await import('../../shared/parts/Part.js');
const { createShipBuildProfile } = await import('../../shared/combat/ShipBuildProfile.js');

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

test('stealth breaks when the real weapon spawn path creates a volley', () => {
    const part = { partId: 'gun_basic', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.stealthTimer = 4;
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });
    game.spawnProjectile = (...args) => system.spawnProjectile(...args);

    system.update(0.016, updateState());

    assert.equal(game.projectiles.length, 1);
    assert.equal(game.playerShip.stealthTimer, 0);
});

test('stealth survives a held-fire frame while the weapon is still on cooldown', () => {
    const part = {
        partId: 'gun_basic',
        x: 0,
        y: 0,
        rotation: 0,
        cooldown: 1
    };
    const { game, calls } = makeGame(part);
    game.playerShip.stealthTimer = 4;
    const system = new WeaponSystem(game);
    game.spawnProjectile = (...args) => system.spawnProjectile(...args);

    system.update(0.016, updateState());

    assert.equal(game.playerShip.stealthTimer, 4);
    assert.equal(game.projectiles.length, 0);
    assert.equal(calls.some(call => call[0] === 'shot'), false);
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

test('v2 shots and bursts share authored geometry and alternate multiple muzzles', () => {
    const part = { partId: 'authored', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    const system = new WeaponSystem(game, { ProjectileClass: ProjectileStub, random: () => .5 });
    const def = {
        id: 'authored', name: 'authored', width: 1, height: 1,
        stats: { pelletCount: 2, damage: 5 },
        visualGeometry: {
            version: 2, scale: 2,
            baseGrid: { width: 16, height: 16 },
            turretGrid: { width: 31, height: 16 },
            baseMount: { x: 8, y: 8 },
            turretPivot: { x: 4, y: 8 },
            muzzles: [{ x: 14, y: 5 }, { x: 14, y: 11 }]
        }
    };
    const initial = system.getInitialShotOrigin(part, def, 1000, 200);
    assert.deepEqual(initial, { fireX: 120, fireY: 194, angle: 0 });
    system.spawnProjectile(def, initial.fireX, initial.fireY, initial.angle, part);
    assert.deepEqual(game.projectiles.map(projectile => projectile.args.slice(0, 2)), [[120, 194], [120, 206]]);
    const burst = system.getBurstShotOrigin(part, def, 1000, 200);
    assert.deepEqual(burst, { fireX: 120, fireY: 206, angle: 0 });
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
        },
        projectileLook: 'missile',
        projectileTrail: 'ion'
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
    assert.equal(game.projectiles[0].projectileLook, 'missile');
    assert.equal(game.projectiles[0].projectileTrail, 'ion');
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

test('family upgrades affect actual cooldown, damage, and projectile mechanics', () => {
    const part = { partId: 'gun_basic', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.permanentStats = {
        velocityRateAdd: 0.25,
        velocityDamageMul: 1.4,
        velocityPierce: 2
    };
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });
    const def = PartsLibrary.gun_basic;

    system.update(0.016, updateState());
    assert.equal(part.cooldown, def.stats.cooldown / 1.25);

    system.spawnProjectile(def, 0, 0, 0, part);
    const projectile = game.projectiles[0];
    assert.equal(projectile.args[6], def.stats.damage * 1.4);
    assert.equal(projectile.remainingPierces, 2);
});

test('new ship stats defensively modify cooldown, projectile speed, fmj damage, and pierce', () => {
    const part = { partId: 'needler', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.stats = {
        accelerantCount: 0,
        rocketBayCount: 0,
        globalFireRateMul: 1.25,
        projectileSpeedMul: 1.5,
        velocityDamageMul: 1.1,
        velocityPierceAdd: 1
    };
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });
    const def = {
        id: 'needler',
        stats: {
            weaponGroup: 'velocity',
            projectileType: 'mini_bullet',
            projectileSpeed: 1000,
            damage: 2
        }
    };

    system.spawnProjectile(def, 0, 0, 0, part);

    assert.equal(game.projectiles[0].args[4], 1500);
    assert.equal(game.projectiles[0].args[6], 2.2);
    assert.equal(game.projectiles[0].remainingPierces, 1);

    system.update(0.016, updateState());
    assert.equal(part.cooldown, PartsLibrary.needler.stats.cooldown / 1.25);
});

test('auto aim follows the closest live hostile inside the exact assist cone and range', () => {
    const part = { partId: 'needler', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part, {
        enemies: [
            { x: 300, y: 230, isDead: false },
            { x: 300, y: 360, isDead: false },
            { x: 2000, y: 200, isDead: false }
        ]
    });
    game.playerShip.stats.aimAssistAngle = 0.2;
    game.playerShip.stats.aimAssistRange = 750;
    const system = new WeaponSystem(game);

    const result = system.getInitialShotOrigin(part, PartsLibrary.needler, 1000, 200);

    assert.ok(Math.abs(result.angle - Math.atan2(30, 200)) < 1e-9);
});

test('prism creates two non-recursive side beams with the corrected laser split stat keys', () => {
    const part = { partId: 'pulse_lance', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.stats = {
        accelerantCount: 0,
        rocketBayCount: 0,
        laserSplitCount: 2,
        laserSplitAngle: 0.1396263402,
        laserSplitDamageMul: 0.45
    };
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });

    system.spawnProjectile(PartsLibrary.pulse_lance, 0, 0, 0, part);

    assert.equal(game.projectiles.length, 3);
    assert.deepEqual(game.projectiles.map(projectile => projectile.args[2]), [
        0,
        -0.1396263402,
        0.1396263402
    ]);
    assert.deepEqual(game.projectiles.map(projectile => projectile.args[6]), [
        10.5,
        10.5 * 0.45,
        10.5 * 0.45
    ]);
    assert.deepEqual(game.projectiles.map(projectile => projectile.prismChild === true), [
        false,
        true,
        true
    ]);
});

test('global projectile speed upgrades still scale lasers at the weapon boundary', () => {
    const part = { partId: 'pulse_lance', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.stats.projectileSpeedMul = 1.2;
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });

    system.spawnProjectile(PartsLibrary.pulse_lance, 0, 0, 0, part);

    assert.equal(game.projectiles[0].speed, 1800);
    assert.equal(game.projectiles[0].vx, 1800);
    assert.equal(game.projectiles[0].vy, 0);
});

test('bastion autofire uses the nearest visible hostile and manual aim overrides it', () => {
    const part = { partId: 'pulse_lance', x: 0, y: 0, rotation: 0 };
    const { game, calls } = makeGame(part, {
        enemies: [
            { x: 250, y: 200, hp: 10, isDead: false, spotted: true },
            { x: 180, y: 200, hp: 10, isDead: false, spotted: false }
        ],
        bosses: []
    });
    game.playerShip.stats.profile = {
        laserAutofire: true,
        laserDamageMul: 1,
        laserFireRateMul: 1,
        laserRangeMul: 1
    };
    const system = new WeaponSystem(game);
    const autoAngle = system.getInitialShotOrigin(
        part,
        PartsLibrary.pulse_lance,
        250,
        200
    ).angle;

    system.update(0.016, updateState({ isMouseDown: false, worldMouseX: 100, worldMouseY: 1000 }));
    let shot = calls.find(call => call[0] === 'shot');
    assert.ok(shot);
    assert.equal(shot[4], autoAngle);

    calls.length = 0;
    part.cooldown = 0;
    system.staggerTimers = {};
    const manualAngle = system.getInitialShotOrigin(
        part,
        PartsLibrary.pulse_lance,
        100,
        1000
    ).angle;
    system.update(0.016, updateState({ isMouseDown: true, worldMouseX: 100, worldMouseY: 1000 }));
    shot = calls.find(call => call[0] === 'shot');
    assert.ok(shot);
    assert.equal(shot[4], manualAngle);
});

test('bastion autofire treats hostile drones as normal authoritative targets', () => {
    const part = { partId: 'pulse_lance', x: 0, y: 0, rotation: 0 };
    const hostileDrone = { x: 210, y: 200, hp: 10, isDead: false, owner: 'enemy' };
    const { game, calls } = makeGame(part, {
        enemies: [],
        bosses: [],
        drones: [hostileDrone]
    });
    game.playerShip.stats.profile = {
        laserAutofire: true,
        laserDamageMul: 1,
        laserFireRateMul: 1,
        laserRangeMul: 1
    };
    const system = new WeaponSystem(game);
    const expected = system.getInitialShotOrigin(
        part,
        PartsLibrary.pulse_lance,
        hostileDrone.x,
        hostileDrone.y
    ).angle;

    system.update(0.016, updateState({ isMouseDown: false }));

    const shot = calls.find(call => call[0] === 'shot');
    assert.ok(shot);
    assert.equal(shot[4], expected);
});

test('phantom ambush arms after silence, boosts one attack, and is consumed even on a miss', () => {
    const part = { partId: 'gun_basic', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.stats.profile = {
        doctrineId: 'phantom',
        ambushArmSeconds: 2.5,
        ambushDamageMul: 1.6,
        directFireRateMul: 0.8
    };
    game.playerShip.combatSilenceTimer = 2.49;
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });
    game.spawnProjectile = (...args) => system.spawnProjectile(...args);

    system.update(0.02, updateState({ worldMouseX: 5000 }));

    assert.equal(game.projectiles[0].args[6], PartsLibrary.gun_basic.stats.damage * 1.6);
    assert.equal(game.playerShip.combatSilenceTimer, 0);
    assert.equal(game.playerShip.ambushReady, false);
});

test('range modifiers preserve exact travel distance while projectile speed changes', () => {
    const part = { partId: 'gun_basic', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    const doctrine = PartsLibrary.doctrine_siege;
    game.playerShip.getUniqueParts = () => [part, { partId: doctrine.id }];
    game.playerShip.stats.profile = createShipBuildProfile(game.playerShip, PartsLibrary);
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });

    system.spawnProjectile(PartsLibrary.gun_basic, 0, 0, 0, part);
    const projectile = game.projectiles[0];
    assert.equal(projectile.args[4], 780);
    assert.ok(Math.abs(projectile.life * projectile.args[4] - 675) < 1e-9);
});

test('special projectile constructors still preserve the exact profiled range', () => {
    const part = { partId: 'scattr', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.getUniqueParts = () => [part, { partId: 'doctrine_siege' }];
    game.playerShip.stats.profile = createShipBuildProfile(game.playerShip, PartsLibrary);
    const system = new WeaponSystem(game, { random: () => 0.5 });

    system.spawnProjectile(PartsLibrary.scattr, 0, 0, 0, part);

    assert.equal(game.projectiles.length, 15);
    for (const projectile of game.projectiles) {
        assert.ok(Math.abs(projectile.life * projectile.speed - 270) < 1e-9);
    }
});

test('guided ggbm speed is modified once and still travels its exact range', () => {
    const part = { partId: 'ggbm', x: 0, y: 0, rotation: 0 };
    const { game } = makeGame(part);
    game.playerShip.getUniqueParts = () => [part, { partId: 'doctrine_siege' }];
    game.playerShip.stats.profile = createShipBuildProfile(game.playerShip, PartsLibrary);
    const system = new WeaponSystem(game, { random: () => 0.5 });

    system.spawnProjectile(PartsLibrary.ggbm, 0, 0, 0, part);

    const projectile = game.projectiles[0];
    assert.equal(projectile.speed, 600 * 0.7 * 1.3);
    assert.ok(Math.abs(projectile.life * projectile.speed - 1890) < 1e-9);
});

test('shrapnel payload receives doctrine and one-shot ambush damage modifiers', () => {
    const part = { partId: 'shrapnel_grenade', attackDamageMul: 1.6 };
    const { game } = makeGame(part);
    game.playerShip.getUniqueParts = () => [part, { partId: 'doctrine_demolition' }];
    game.playerShip.stats.profile = createShipBuildProfile(game.playerShip, PartsLibrary);
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });

    system.spawnProjectile(PartsLibrary.shrapnel_grenade, 0, 0, 0, part);

    assert.equal(
        game.projectiles[0].shrapnelDamage,
        PartsLibrary.shrapnel_grenade.stats.shrapnelDamage * 1.25 * 1.25 * 1.6
    );
});

test('demolition changes explosive payloads and mines but leaves ordinary bullets alone', () => {
    const mine = { partId: 'mine_placer', x: 0, y: 0, rotation: 0 };
    const doctrine = { partId: 'doctrine_demolition' };
    const { game } = makeGame(mine);
    game.playerShip.getUniqueParts = () => [mine, doctrine];
    game.playerShip.stats.profile = createShipBuildProfile(game.playerShip, PartsLibrary);
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });

    system.spawnProjectile(PartsLibrary.mine_placer, 0, 0, 0, mine);
    const projectile = game.projectiles[0];
    assert.equal(projectile.armingTime, PartsLibrary.mine_placer.stats.armingTime * 0.6);
    assert.equal(projectile.blastRadiusMul, 1.35);
    assert.equal(projectile.args[6], PartsLibrary.mine_placer.stats.damage * 1.25);
    assert.equal(
        system.getEffectiveRange(PartsLibrary.gun_basic),
        450
    );
});

test('ambush and disabled-target bonuses cannot push total damage past the safety cap', () => {
    const part = { partId: 'gun_basic', attackDamageMul: 1.6 };
    const { game } = makeGame(part);
    game.playerShip.stats.profile = {
        velocityDamageMul: 3,
        disabledTargetDamageMul: 1.55
    };
    const system = new WeaponSystem(game, {
        ProjectileClass: ProjectileStub,
        random: () => 0.5
    });

    system.spawnProjectile(PartsLibrary.gun_basic, 0, 0, 0, part);

    const projectile = game.projectiles[0];
    assert.equal(projectile.args[6], PartsLibrary.gun_basic.stats.damage * 3);
    assert.equal(projectile.disabledTargetDamageMul, 1);
});
