import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ship } from '../entities/Ship.js';
import { PartsLibrary } from '../parts/Part.js';
import {
    createShipBuildProfile,
    getBuildRatings,
    getInstalledDoctrine,
    getWeaponPayloadMultiplier,
    getWeaponProfile,
    massMovementMultipliers
} from './ShipBuildProfile.js';

function shipWithDoctrine(partId) {
    const ship = new Ship();
    assert.equal(ship.addPart(2, 0, partId), true);
    return ship;
}

test('all ten doctrine parts are legendary physical modules with exact shop metadata', () => {
    const doctrines = Object.values(PartsLibrary).filter(def => def.uniqueGroup === 'doctrine');
    assert.equal(doctrines.length, 10);
    for (const def of doctrines) {
        assert.equal(def.rarity, 'legendary');
        assert.equal(def.width, 2);
        assert.equal(def.height, 2);
        assert.equal(def.shopCategory, 'doctrine');
        assert.equal(def.shopPrice, 90);
        assert.ok(def.bonuses.length > 0);
        assert.ok(def.drawbacks.length > 0);
        assert.ok(Object.isFrozen(def.buildModifiers));
        assert.ok(def.buildModifiers.multiply);
    }
});

test('all ten doctrine profiles expose the exact authored baseline tradeoffs', () => {
    const expected = {
        interceptor: { accelerationMul: 1.35, speedMul: 1.25, turnMul: 1.3, directFireRateMul: 1.15, maxHpMul: 0.75, directRangeMul: 0.65 },
        hive: { droneCapacityAdd: 4, droneDeployRateMul: 1.25, droneDamageMul: 1.2, droneRepairMul: 1.2, droneHpMul: 1.2, speedMul: 0.85, turnMul: 0.8, directFireRateMul: 0.8 },
        bastion: { maxHpMul: 1.4, regenMul: 1.3, shieldCooldownMul: 0.75, laserDamageMul: 1.15, accelerationMul: 0.75, speedMul: 0.8, turnMul: 0.75, laserAutofire: true },
        siege: { velocityRangeMul: 1.5, rocketRangeMul: 1.5, velocityProjectileSpeedMul: 1.3, rocketProjectileSpeedMul: 1.3, velocityDamageMul: 1.2, rocketDamageMul: 1.2, directFireRateMul: 0.75, accelerationMul: 0.8, speedMul: 0.85, turnMul: 0.8 },
        reaver: { collisionDamageMul: 1.75, collisionDamageTakenMul: 0.3, meleeDamageMul: 1.35, accelerationMul: 1.2, rangedDamageMul: 0.7, turnMul: 0.8 },
        phantom: { ambushDamageMul: 1.6, stealthDurationMul: 1.35, decoyDurationMul: 1.35, quietSpeedMul: 1.2, maxHpMul: 0.75, directFireRateMul: 0.8 },
        disruptor: { hackDurationMul: 1.5, empDurationMul: 1.5, abilityCooldownMul: 0.75, disabledTargetDamageMul: 1.3, directDamageMul: 0.75, maxHpMul: 0.8 },
        demolition: { explosionRadiusMul: 1.35, explosiveDamageMul: 1.25, mineArmingMul: 0.6, shrapnelDamageMul: 1.25, rocketSpeedMul: 0.75, rocketFireRateMul: 1 / 1.3, maxHpMul: 0.8 },
        gunship: { directDamageMul: 0.82, speedMul: 0.85, turnMul: 0.75 },
        warden: { shieldRadiusMul: 1.3, shieldCooldownMul: 0.65, regenMul: 1.4, droneRepairMul: 1.4, maxHpMul: 1.2, directDamageMul: 0.7, speedMul: 0.75 }
    };
    for (const [id, fields] of Object.entries(expected)) {
        const profile = createShipBuildProfile(shipWithDoctrine(`doctrine_${id}`), PartsLibrary);
        for (const [field, value] of Object.entries(fields)) {
            assert.ok(Math.abs(profile[field] - value) < 1e-12, `${id}.${field}`);
        }
    }
});

test('a ship accepts one doctrine and rejects a second without changing its build', () => {
    const ship = shipWithDoctrine('doctrine_interceptor');
    const before = [...ship.getUniqueParts()].length;
    assert.equal(ship.addPart(2, 2, 'doctrine_hive'), false);
    assert.equal([...ship.getUniqueParts()].length, before);
    assert.equal(getInstalledDoctrine(ship, PartsLibrary).doctrineId, 'interceptor');
});

test('doctrine removal and swapping recalculate immediately without separate state', () => {
    const ship = shipWithDoctrine('doctrine_interceptor');
    assert.equal(ship.stats.profile.doctrineId, 'interceptor');
    ship.removePart(2, 0);
    assert.equal(ship.stats.profile.doctrineId, null);
    assert.equal(ship.addPart(2, 0, 'doctrine_warden'), true);
    assert.equal(ship.stats.profile.doctrineId, 'warden');
});

test('starter mass remains neutral while light and heavy frames receive bounded movement', () => {
    assert.deepEqual(massMovementMultipliers(13), { acceleration: 1, speed: 1 });
    assert.deepEqual(massMovementMultipliers(1), { acceleration: 1.25, speed: 1.15 });
    assert.deepEqual(massMovementMultipliers(1000), { acceleration: 0.55, speed: 0.75 });
});

test('starter ship is the exact 100-point baseline in every hangar rating', () => {
    const ship = new Ship();
    assert.deepEqual(getBuildRatings(ship, PartsLibrary), {
        mobility: 100,
        durability: 100,
        directFirepower: 100,
        droneCommand: 100,
        effectiveRange: 100
    });
});

test('payload ratings account for runtime beam, chain, ricochet, and explosive hits', () => {
    assert.equal(getWeaponPayloadMultiplier(PartsLibrary.railgun), 24);
    assert.equal(getWeaponPayloadMultiplier(PartsLibrary.beam_sword), 1);
    assert.equal(getWeaponPayloadMultiplier(PartsLibrary.lightning_rod), 1.8525);
    assert.equal(getWeaponPayloadMultiplier(PartsLibrary.ricochet_cannon), 1.7);
    assert.equal(getWeaponPayloadMultiplier(PartsLibrary.mine_placer), 1);
    assert.equal(getWeaponPayloadMultiplier(PartsLibrary.torpedo_tube), 2);
});

test('interceptor and siege apply their advertised weapon tradeoffs', () => {
    const interceptor = createShipBuildProfile(shipWithDoctrine('doctrine_interceptor'), PartsLibrary);
    const siege = createShipBuildProfile(shipWithDoctrine('doctrine_siege'), PartsLibrary);
    const dart = PartsLibrary.gun_basic;
    const interceptorWeapon = getWeaponProfile(interceptor, dart);
    const siegeWeapon = getWeaponProfile(siege, dart);
    assert.equal(interceptor.maxHpMul, 0.75);
    assert.equal(interceptorWeapon.rangeMul, 0.65);
    assert.equal(interceptorWeapon.fireRateMul, 1.15);
    assert.equal(siegeWeapon.rangeMul, 1.5);
    assert.equal(siegeWeapon.damageMul, 1.2);
    assert.equal(siegeWeapon.fireRateMul, 0.75);
    assert.equal(siegeWeapon.projectileSpeedMul, 1.3);
    assert.equal(getWeaponProfile(siege, PartsLibrary.pulse_lance).projectileSpeedMul, 1);
});

test('rangefinder speed and range bonuses apply to ballistic and rocket weapons only', () => {
    const ship = {
        stats: {},
        permanentStats: {},
        getUniqueParts: () => [{ partId: 'rangefinder' }]
    };
    const profile = createShipBuildProfile(ship, PartsLibrary);
    for (const definition of [PartsLibrary.gun_basic, PartsLibrary.rocketle]) {
        const weapon = getWeaponProfile(profile, definition);
        assert.equal(weapon.rangeMul, 1.2);
        assert.equal(weapon.projectileSpeedMul, 1.15);
    }
    assert.equal(getWeaponProfile(profile, PartsLibrary.pulse_lance).rangeMul, 1);
    assert.equal(getWeaponProfile(profile, PartsLibrary.pulse_lance).projectileSpeedMul, 1);
});

test('reaver buffs melee without applying its ranged-gun penalty to the blade', () => {
    const profile = createShipBuildProfile(shipWithDoctrine('doctrine_reaver'), PartsLibrary);
    assert.equal(getWeaponProfile(profile, PartsLibrary.gun_basic).damageMul, 0.7);
    assert.equal(getWeaponProfile(profile, PartsLibrary.beam_sword).damageMul, 1.35);
});

test('permanent upgrades enter the shared profile before final safety clamps', () => {
    const ship = shipWithDoctrine('doctrine_interceptor');
    ship.permanentStats.speedMul = 100;
    ship.permanentStats.velocityRateAdd = 100;
    ship.permanentStats.velocityDamageMul = 100;
    ship.recalculateStats();
    const weapon = getWeaponProfile(ship.stats.profile, PartsLibrary.gun_basic);
    assert.equal(ship.stats.profile.speedMul, 2);
    assert.equal(weapon.fireRateMul, 2.5);
    assert.equal(weapon.damageMul, 3);
});

test('gunship counts direct weapon parts rather than barrels, mines, or hack darts', () => {
    const ship = shipWithDoctrine('doctrine_gunship');
    ship.addPart(-2, 0, 'twin_dart');
    ship.addPart(-3, 0, 'mine_placer');
    ship.addPart(-4, 0, 'hack_dart');
    const profile = createShipBuildProfile(ship, PartsLibrary);
    assert.equal(profile.directWeaponCount, 4);
    assert.equal(profile.gunshipRateBonus, 0.18);
});

test('doctrine stacks apply only to the installed doctrine and honor hive cap', () => {
    const ship = shipWithDoctrine('doctrine_hive');
    ship.permanentStats.doctrine_hive_stacks = 999;
    ship.permanentStats.doctrine_siege_stacks = 5;
    const profile = createShipBuildProfile(ship, PartsLibrary);
    assert.equal(profile.droneCapacityAdd, 4);
    assert.equal(profile.maxHpMul, 1.24);
    assert.equal(profile.velocityRangeMul, 1);
});

test('equipment-specific doctrine stacks swap a useful fallback for their real bonus', () => {
    const ship = shipWithDoctrine('doctrine_hive');
    ship.permanentStats.doctrine_hive_stacks = 2;
    let profile = createShipBuildProfile(ship, PartsLibrary);
    assert.equal(profile.droneCapacityAdd, 4);
    assert.equal(profile.maxHpMul, 1.12);

    const originalParts = ship.getUniqueParts.bind(ship);
    ship.getUniqueParts = () => [
        ...originalParts(),
        { partId: 'drone_needle_nest' }
    ];
    profile = createShipBuildProfile(ship, PartsLibrary);
    assert.equal(profile.droneCapacityAdd, 6);
    assert.equal(profile.droneDeployRateMul, 1.25 * 1.16);
    assert.equal(profile.maxHpMul, 1);
});
