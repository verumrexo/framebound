import { isDoctrineDefinition } from '../parts/arsenal/DoctrineParts.js';

const REFERENCE_MASS = 13;
const MELEE_TYPES = new Set(['beam_sword', 'saber', 'arc_welder']);
const BEAM_TYPES = new Set(['railgun', 'saber', 'beam_freeze', 'beam_sword', 'arc_welder']);
const EXPLOSIVE_TYPES = new Set([
    'rocket_he', 'rocket_le', 'ggbm', 'proximity_mine',
    'shrapnel_grenade', 'cluster_grenade', 'micro_missile', 'torpedo'
]);

export function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export function isDirectWeapon(definition) {
    if (definition?.type !== 'weapon') return false;
    const type = definition.stats?.projectileType;
    return type !== 'proximity_mine' && type !== 'hack_dart' && definition.stats?.weaponGroup !== 'utility';
}

export function isMeleeWeapon(definition) {
    return MELEE_TYPES.has(definition?.stats?.projectileType);
}

export function isExplosiveWeapon(definition) {
    const stats = definition?.stats || {};
    return stats.weaponGroup === 'rocket' || EXPLOSIVE_TYPES.has(stats.projectileType) || Number.isFinite(stats.aoeRadius);
}

export function isBeamWeapon(definition) {
    return BEAM_TYPES.has(definition?.stats?.projectileType);
}

export function getProjectileLaunchSpeed(definition) {
    const stats = definition?.stats || {};
    const type = stats.projectileType || 'bullet';
    if (type === 'laser') return 1500;
    if (type === 'small_laser') return 1800;
    return stats.projectileSpeed || 600;
}

export function getBaseProjectileSpeed(definition) {
    const stats = definition?.stats || {};
    const type = stats.projectileType || 'bullet';
    if (isBeamWeapon(definition) || type === 'proximity_mine') return 0;
    if (type === 'pellet') return 800;
    if (type === 'cluster_grenade') return 210;
    const launchSpeed = getProjectileLaunchSpeed(definition);
    return type === 'ggbm' ? launchSpeed * 0.7 : launchSpeed;
}

export function getBaseWeaponRange(definition) {
    const stats = definition?.stats || {};
    if (stats.projectileType === 'proximity_mine') return 0;
    if (Number.isFinite(stats.range) && stats.range > 0) return stats.range;
    const type = stats.projectileType || 'bullet';
    const beamRanges = {
        railgun: 3000,
        saber: 3000,
        beam_freeze: 600,
        beam_sword: 120,
        arc_welder: 140
    };
    if (beamRanges[type]) return beamRanges[type];
    const speed = getBaseProjectileSpeed(definition);
    if (Number.isFinite(stats.lifetime) && stats.lifetime > 0) {
        return speed * stats.lifetime;
    }
    if (type === 'pellet') return 180;
    if (type === 'mini_bullet') return 350;
    return 450;
}

/**
 * Estimates the complete damage delivered by one trigger pull relative to one
 * authored damage packet. This mirrors runtime multi-hit, chain, ricochet, and
 * explosion behavior so hangar ratings do not pretend those payloads are free.
 */
export function getWeaponPayloadMultiplier(definition) {
    const stats = definition?.stats || {};
    const type = stats.projectileType || 'bullet';
    if (type === 'railgun') return 24;
    if (type === 'saber') return 16;
    if (type === 'shrapnel_grenade') {
        return (stats.shrapnelCount || 10) * (stats.shrapnelDamage || 0) /
            Math.max(0.001, stats.damage || 1);
    }
    if (type === 'cluster_grenade') return 6.5;
    if (Number.isFinite(stats.baseChainCount) && stats.baseChainCount > 0) {
        let total = 1;
        let chainedDamage = 1;
        for (let index = 0; index < stats.baseChainCount; index++) {
            chainedDamage *= 0.55;
            total += chainedDamage;
        }
        return total;
    }
    if (Number.isFinite(stats.ricochetCount) && stats.ricochetCount > 0) {
        let total = 1;
        let ricochetDamage = 1;
        for (let index = 0; index < stats.ricochetCount; index++) {
            ricochetDamage *= stats.ricochetDamageMul || 0.7;
            total += ricochetDamage;
        }
        return total;
    }
    if (type === 'proximity_mine') return 1;
    if (isExplosiveWeapon(definition)) return Number.isFinite(stats.aoeRadius) ? 2 : 1.5;
    return 1;
}

export function getInstalledDoctrine(ship, partsLibrary) {
    if (!ship?.getUniqueParts) return null;
    for (const part of ship.getUniqueParts()) {
        const definition = partsLibrary[part.partId];
        if (isDoctrineDefinition(definition)) return definition;
    }
    return null;
}

export function massMovementMultipliers(mass) {
    const safeMass = Math.max(1, Number.isFinite(mass) ? mass : REFERENCE_MASS);
    return {
        acceleration: clamp(Math.sqrt(REFERENCE_MASS / safeMass), 0.55, 1.25),
        speed: clamp((REFERENCE_MASS / safeMass) ** 0.25, 0.75, 1.15)
    };
}

function neutralProfile() {
    return {
        doctrineId: null,
        doctrineName: 'balanced',
        maxHpMul: 1,
        regenMul: 1,
        regenAdd: 0,
        accelerationMul: 1,
        speedMul: 1,
        turnMul: 1,
        directDamageMul: 1,
        rangedDamageMul: 1,
        directFireRateMul: 1,
        globalFireRateMul: 1,
        directRangeMul: 1,
        velocityDamageMul: 1,
        velocityFireRateMul: 1,
        velocityRangeMul: 1,
        laserDamageMul: 1,
        laserFireRateMul: 1,
        laserRangeMul: 1,
        rocketDamageMul: 1,
        rocketFireRateMul: 1,
        rocketRangeMul: 1,
        projectileSpeedMul: 1,
        velocityProjectileSpeedMul: 1,
        rocketProjectileSpeedMul: 1,
        rocketSpeedMul: 1,
        rocketExplosionRadiusMul: 1,
        explosionRadiusMul: 1,
        explosiveDamageMul: 1,
        shrapnelDamageMul: 1,
        mineArmingMul: 1,
        meleeDamageMul: 1,
        collisionDamageMul: 1,
        collisionDamageTakenMul: 1,
        droneCapacityAdd: 0,
        droneDeployRateMul: 1,
        droneDamageMul: 1,
        droneRepairMul: 1,
        droneHpMul: 1,
        shieldRadiusMul: 1,
        shieldCooldownMul: 1,
        abilityCooldownMul: 1,
        hackDurationMul: 1,
        empDurationMul: 1,
        stealthDurationMul: 1,
        decoyDurationMul: 1,
        disabledTargetDamageMul: 1,
        ambushDamageMul: 1,
        ambushArmSeconds: 2.5,
        quietSpeedMul: 1,
        quietSpeedDelay: 1.5,
        laserAutofire: false,
        directWeaponCount: 0,
        gunshipRateBonus: 0,
        velocityPierceAdd: 0,
        laserChainAdd: 0
    };
}

function applySupportPart(profile, definition) {
    const id = definition.id;
    if (definition.type === 'accelerant') {
        profile.laserFireRateMul *= 1.12;
        profile.laserDamageMul *= 0.92;
    }
    if (definition.type === 'rocket_bay') profile.rocketFireRateMul /= 1.2;
    if (id === 'coolant_loop') {
        profile.directDamageMul *= 0.92;
    }
    if (id === 'gyro_ring') profile.speedMul *= 0.9;
    if (id === 'rangefinder') {
        profile.velocityRangeMul *= 1.2;
        profile.rocketRangeMul *= 1.2;
        profile.velocityProjectileSpeedMul *= 1.15;
        profile.rocketProjectileSpeedMul *= 1.15;
        profile.velocityFireRateMul *= 0.9;
        profile.rocketFireRateMul *= 0.9;
    }
    if (id === 'auto_aim') profile.directDamageMul *= 0.88;
    if (id === 'fmj') {
        profile.velocityFireRateMul *= 0.85;
    }
}

function doctrineStacks(permanent, doctrineId) {
    return clamp(Math.floor(permanent?.[`doctrine_${doctrineId}_stacks`] || 0), 0, doctrineId === 'hive' ? 4 : 5);
}

export function hasDoctrineEquipment(doctrineId, definitions) {
    if (doctrineId === 'hive') return definitions.some(definition => definition.type === 'drone');
    if (doctrineId === 'siege') return definitions.some(definition =>
        definition.type === 'weapon' &&
        ['velocity', 'rocket'].includes(definition.stats?.weaponGroup)
    );
    if (doctrineId === 'disruptor') return definitions.some(definition =>
        definition.stats?.projectileType === 'hack_dart' ||
        definition.stats?.activeAbility === 'emp'
    );
    if (doctrineId === 'demolition') return definitions.some(isExplosiveWeapon);
    return true;
}

function applyPermanentUpgrades(profile, permanent = {}) {
    profile.maxHpMul *= permanent.hpMul || 1;
    profile.regenAdd += permanent.regenAdd || 0;
    profile.speedMul *= permanent.speedMul || 1;
    profile.turnMul *= permanent.turnMul || 1;
    profile.velocityFireRateMul *= 1 + (permanent.velocityRateAdd || 0);
    profile.laserFireRateMul *= 1 + (permanent.laserRateAdd || 0);
    profile.rocketFireRateMul *= 1 + (permanent.rocketRateAdd || 0);
    profile.velocityDamageMul *= permanent.velocityDamageMul || 1;
    profile.laserDamageMul *= permanent.laserDamageMul || 1;
    profile.rocketDamageMul *= permanent.rocketDamageMul || 1;
    profile.rocketSpeedMul *= permanent.missileSpeedMul || 1;
    profile.rocketExplosionRadiusMul *= permanent.rocketBlastMul || 1;
    profile.droneDeployRateMul *= 1 + (permanent.droneRateAdd || 0);
    profile.droneDamageMul *= permanent.droneDamageMul || 1;
    profile.droneCapacityAdd += permanent.droneCapacityAdd || 0;
    profile.velocityPierceAdd += permanent.velocityPierce || 0;
    profile.laserChainAdd += permanent.laserChain || 0;
}

function applyDoctrine(profile, doctrine, permanent, definitions) {
    if (!doctrine) return;
    const id = doctrine.doctrineId;
    const stacks = doctrineStacks(permanent, id);
    const hasRelevantEquipment = hasDoctrineEquipment(id, definitions);
    profile.doctrineId = id;
    profile.doctrineName = doctrine.name;
    const modifiers = doctrine.buildModifiers || {};
    for (const [key, value] of Object.entries(modifiers.multiply || {})) {
        profile[key] *= value;
    }
    for (const [key, value] of Object.entries(modifiers.add || {})) {
        profile[key] += value;
    }
    for (const [key, value] of Object.entries(modifiers.set || {})) {
        profile[key] = value;
    }
    if (modifiers.gunship) {
        profile.gunshipRateBonus = Math.min(
            modifiers.gunship.maximum + 0.04 * stacks,
            Math.max(0, profile.directWeaponCount - 1) *
                modifiers.gunship.perExtraWeapon
        );
        profile.directFireRateMul *= 1 + profile.gunshipRateBonus;
    }

    if (id === 'interceptor') {
        profile.speedMul *= 1 + 0.08 * stacks;
        profile.turnMul *= 1 + 0.08 * stacks;
        profile.directFireRateMul *= 1 + 0.05 * stacks;
    } else if (id === 'hive') {
        if (hasRelevantEquipment) {
            profile.droneCapacityAdd += stacks;
            profile.droneDeployRateMul *= 1 + 0.08 * stacks;
        } else {
            profile.maxHpMul *= 1 + 0.06 * stacks;
        }
    } else if (id === 'bastion') {
        profile.maxHpMul *= 1 + 0.1 * stacks;
        profile.regenAdd += 0.25 * stacks;
        profile.laserDamageMul *= 1 + 0.05 * stacks;
    } else if (id === 'siege') {
        if (hasRelevantEquipment) {
            profile.velocityRangeMul *= 1 + 0.1 * stacks;
            profile.rocketRangeMul *= 1 + 0.1 * stacks;
            profile.velocityProjectileSpeedMul *= 1 + 0.05 * stacks;
            profile.rocketProjectileSpeedMul *= 1 + 0.05 * stacks;
            profile.velocityDamageMul *= 1 + 0.05 * stacks;
            profile.rocketDamageMul *= 1 + 0.05 * stacks;
        } else {
            profile.speedMul *= 1 + 0.05 * stacks;
            profile.turnMul *= 1 + 0.05 * stacks;
        }
    } else if (id === 'reaver') {
        profile.collisionDamageMul *= 1 + 0.1 * stacks;
        profile.meleeDamageMul *= 1 + 0.1 * stacks;
        profile.accelerationMul *= 1 + 0.05 * stacks;
    } else if (id === 'phantom') {
        profile.ambushDamageMul = 1.6 + 0.1 * stacks;
        profile.stealthDurationMul *= 1 + 0.05 * stacks;
        profile.decoyDurationMul *= 1 + 0.05 * stacks;
        profile.quietSpeedMul *= 1 + 0.04 * stacks;
    } else if (id === 'disruptor') {
        if (hasRelevantEquipment) {
            profile.hackDurationMul *= 1 + 0.08 * stacks;
            profile.empDurationMul *= 1 + 0.08 * stacks;
            profile.disabledTargetDamageMul *= 1 + 0.05 * stacks;
        } else {
            profile.maxHpMul *= 1 + 0.06 * stacks;
        }
    } else if (id === 'demolition') {
        if (hasRelevantEquipment) {
            profile.explosionRadiusMul *= 1 + 0.08 * stacks;
            profile.explosiveDamageMul *= 1 + 0.06 * stacks;
        } else {
            profile.maxHpMul *= 1 + 0.06 * stacks;
        }
    } else if (id === 'warden') {
        profile.shieldRadiusMul *= 1 + 0.08 * stacks;
        profile.regenMul *= 1 + 0.08 * stacks;
        profile.droneRepairMul *= 1 + 0.08 * stacks;
    }
}

export function createShipBuildProfile(ship, partsLibrary) {
    const profile = neutralProfile();
    profile.globalFireRateMul *= ship?.stats?.globalFireRateMul || 1;
    profile.projectileSpeedMul *= ship?.stats?.projectileSpeedMul || 1;
    profile.velocityDamageMul *= ship?.stats?.velocityDamageMul || 1;
    profile.velocityPierceAdd += ship?.stats?.velocityPierceAdd || 0;
    const definitions = [];
    if (ship?.getUniqueParts) {
        for (const part of ship.getUniqueParts()) {
            const definition = partsLibrary[part.partId];
            if (!definition) continue;
            definitions.push(definition);
            if (isDirectWeapon(definition)) profile.directWeaponCount++;
        }
    }
    for (const definition of definitions) applySupportPart(profile, definition);
    applyDoctrine(
        profile,
        definitions.find(isDoctrineDefinition),
        ship?.permanentStats,
        definitions
    );
    applyPermanentUpgrades(profile, ship?.permanentStats);

    for (const key of Object.keys(profile)) {
        if (!key.endsWith('Mul') || !Number.isFinite(profile[key])) continue;
        if (key.includes('FireRate')) profile[key] = clamp(profile[key], 0.45, 2.5);
        else if (key.includes('Range')) profile[key] = clamp(profile[key], 0.5, 2.25);
        else if (key === 'accelerationMul' || key === 'speedMul' || key === 'turnMul' || key === 'quietSpeedMul') profile[key] = clamp(profile[key], 0.4, 2);
        else if (key === 'droneDeployRateMul') profile[key] = clamp(profile[key], 0.5, 2.5);
        else if (key.includes('Damage') && key !== 'collisionDamageTakenMul') {
            profile[key] = clamp(profile[key], 0.5, 3);
        }
    }
    profile.droneCapacityAdd = clamp(profile.droneCapacityAdd, 0, 24);
    return profile;
}

export function getWeaponProfile(profile, definition) {
    const family = definition?.stats?.weaponGroup;
    const direct = isDirectWeapon(definition);
    const rangeEligible = definition?.type === 'weapon' &&
        definition.stats?.projectileType !== 'proximity_mine';
    const melee = isMeleeWeapon(definition);
    const explosive = isExplosiveWeapon(definition);
    let damageMul = direct ? (profile.directDamageMul || 1) : 1;
    let fireRateMul = profile.globalFireRateMul || 1;
    if (direct) fireRateMul *= profile.directFireRateMul || 1;
    let rangeMul = rangeEligible ? (profile.directRangeMul || 1) : 1;
    if (direct && !melee) damageMul *= profile.rangedDamageMul || 1;
    if (family === 'velocity') {
        damageMul *= profile.velocityDamageMul || 1;
        fireRateMul *= profile.velocityFireRateMul || 1;
        rangeMul *= profile.velocityRangeMul || 1;
    } else if (family === 'laser') {
        damageMul *= profile.laserDamageMul || 1;
        fireRateMul *= profile.laserFireRateMul || 1;
        rangeMul *= profile.laserRangeMul || 1;
    } else if (family === 'rocket') {
        damageMul *= profile.rocketDamageMul || 1;
        fireRateMul *= profile.rocketFireRateMul || 1;
        rangeMul *= profile.rocketRangeMul || 1;
    }
    if (melee) damageMul *= profile.meleeDamageMul || 1;
    if (explosive) damageMul *= profile.explosiveDamageMul || 1;
    return {
        damageMul: clamp(damageMul, 0.5, 3),
        fireRateMul: clamp(fireRateMul, 0.45, 2.5),
        rangeMul: clamp(rangeMul, 0.5, 2.25),
        projectileSpeedMul: clamp(
            (profile.projectileSpeedMul || 1) *
            (family === 'velocity' ? (profile.velocityProjectileSpeedMul || 1) : 1) *
            (family === 'rocket' ?
                (profile.rocketProjectileSpeedMul || 1) * (profile.rocketSpeedMul || 1) : 1),
            0.4,
            2
        ),
        explosionRadiusMul: (profile.explosionRadiusMul || 1) *
            (family === 'rocket' ? (profile.rocketExplosionRadiusMul || 1) : 1),
        shrapnelDamageMul: profile.shrapnelDamageMul || 1,
        mineArmingMul: profile.mineArmingMul || 1
    };
}

export function getBuildRatings(ship, partsLibrary) {
    const profile = ship?.stats?.profile || createShipBuildProfile(ship, partsLibrary);
    const mass = ship?.stats?.totalMass || REFERENCE_MASS;
    const movement = massMovementMultipliers(mass);
    const hp = ship?.stats?.totalHp || 50;
    const regen = ship?.stats?.regen || 1;
    const droneCapacity = ship?.stats?.droneCapacity || 0;
    const thrustMultiplier = 1 + (ship?.stats?.thrust || 0) * 0.05;
    const acceleration = thrustMultiplier * clamp(
        movement.acceleration * profile.accelerationMul,
        0.4,
        2
    );
    const speed = thrustMultiplier * clamp(
        movement.speed * profile.speedMul,
        0.4,
        2
    );
    const starterTurn = 5 * (5 / REFERENCE_MASS);
    const turning = (
        Math.max(0.5, 5 * (5 / mass)) + (ship?.stats?.turnSpeed || 0)
    ) * profile.turnMul / starterTurn;
    const weapons = ship?.getUniqueParts
        ? [...ship.getUniqueParts()].map(part => partsLibrary[part.partId]).filter(isDirectWeapon)
        : [];
    const directDps = weapons.reduce((total, definition) => {
        const stats = definition.stats || {};
        let triggerShots = Math.max(1, stats.burstCount || 1);
        if (stats.weaponGroup === 'rocket') {
            triggerShots += ship?.stats?.rocketBayCount || 0;
        }
        const shots = triggerShots *
            Math.max(1, stats.pelletCount || 1);
        const splitPayload = stats.weaponGroup === 'laser'
            ? 1 + (ship?.stats?.laserSplitCount || 0) *
                (ship?.stats?.laserSplitDamageMul || 1)
            : 1;
        const weapon = getWeaponProfile(profile, definition);
        return total + (stats.damage || 0) * shots *
            splitPayload * getWeaponPayloadMultiplier(definition) *
            weapon.damageMul * weapon.fireRateMul /
            Math.max(0.016, (stats.cooldown || 0.15) + (stats.chargeTime || 0));
    }, 0);
    const ranges = weapons.map(definition =>
        getBaseWeaponRange(definition) * getWeaponProfile(profile, definition).rangeMul
    );
    const averageRange = ranges.length > 0
        ? ranges.reduce((sum, value) => sum + value, 0) / ranges.length
        : 0;
    const starterDps = ['gun_basic', 'gun_basic', 'rocketle'].reduce((total, id) => {
        const definition = partsLibrary[id];
        const stats = definition?.stats || {};
        return total + (stats.damage || 0) * Math.max(1, stats.burstCount || 1) *
            Math.max(1, stats.pelletCount || 1) * getWeaponPayloadMultiplier(definition) /
            Math.max(0.016, stats.cooldown || 0.15);
    }, 0);
    const starterRange = (450 + 450 + 1800) / 3;
    return {
        mobility: Math.round(100 * Math.cbrt(acceleration * speed * turning)),
        durability: Math.round(100 * Math.sqrt((hp / 110) * Math.max(0.25, regen))),
        directFirepower: weapons.length > 0
            ? Math.round(100 * directDps / starterDps)
            : 0,
        droneCommand: Math.round(100 + droneCapacity * 12.5 * Math.sqrt(
            profile.droneDeployRateMul * profile.droneDamageMul *
            profile.droneHpMul * profile.droneRepairMul
        )),
        effectiveRange: weapons.length > 0
            ? Math.round(100 * averageRange / starterRange)
            : 0
    };
}
