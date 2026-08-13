// @ts-check

const DOCTRINE_ROWS = Object.freeze([
    '000001111100000',
    '000111111111000',
    '001112222211100',
    '011221111122110',
    '011211111112110',
    '112110222011211',
    '112112222211211',
    '112112002211211',
    '112112222211211',
    '112110222011211',
    '011211111112110',
    '011221111122110',
    '001112222211100',
    '000111111111000',
    '000001111100000'
]);

const DEFINITIONS = [
    {
        id: 'doctrine_interceptor', name: 'interceptor drive', doctrineId: 'interceptor',
        description: 'makes you fast and deadly up close, but fragile and bad from far away.',
        bonuses: ['+35% acceleration', '+25% speed', '+30% turning', '+15% direct fire rate'],
        drawbacks: ['-25% maximum hp', '-35% direct-weapon range'],
        buildModifiers: { multiply: { accelerationMul: 1.35, speedMul: 1.25, turnMul: 1.3, directFireRateMul: 1.15, maxHpMul: 0.75, directRangeMul: 0.65 } }
    },
    {
        id: 'doctrine_hive', name: 'hive command', doctrineId: 'hive',
        description: 'runs a bigger, stronger drone fleet, but slows your ship and guns.',
        bonuses: ['+4 drone capacity', '+25% deployment speed', '+20% drone damage, repair, and hp'],
        drawbacks: ['-15% speed', '-20% turning', '-20% direct fire rate'],
        buildModifiers: { multiply: { droneDeployRateMul: 1.25, droneDamageMul: 1.2, droneRepairMul: 1.2, droneHpMul: 1.2, speedMul: 0.85, turnMul: 0.8, directFireRateMul: 0.8 }, add: { droneCapacityAdd: 4 } }
    },
    {
        id: 'doctrine_bastion', name: 'bastion lattice', doctrineId: 'bastion',
        description: 'turns you into a slow laser fortress that shoots by itself.',
        bonuses: ['+40% maximum hp', '+30% regeneration', '25% shorter shield cooldowns', '+15% laser damage', 'laser autofire'],
        drawbacks: ['-25% acceleration', '-20% speed', '-25% turning'],
        buildModifiers: { multiply: { maxHpMul: 1.4, regenMul: 1.3, shieldCooldownMul: 0.75, laserDamageMul: 1.15, accelerationMul: 0.75, speedMul: 0.8, turnMul: 0.75 }, set: { laserAutofire: true } }
    },
    {
        id: 'doctrine_siege', name: 'siege computer', doctrineId: 'siege',
        description: 'hits much harder from far away, but moves and reloads slowly.',
        bonuses: ['+50% ballistic and rocket range', '+30% projectile speed', '+20% ballistic and rocket damage'],
        drawbacks: ['-25% direct fire rate', '-20% acceleration', '-15% speed', '-20% turning'],
        buildModifiers: { multiply: { velocityRangeMul: 1.5, rocketRangeMul: 1.5, velocityProjectileSpeedMul: 1.3, rocketProjectileSpeedMul: 1.3, velocityDamageMul: 1.2, rocketDamageMul: 1.2, directFireRateMul: 0.75, accelerationMul: 0.8, speedMul: 0.85, turnMul: 0.8 } }
    },
    {
        id: 'doctrine_reaver', name: 'reaver drive', doctrineId: 'reaver',
        description: 'lets you ram and slice enemies apart, but makes normal guns much weaker.',
        bonuses: ['+75% collision damage', '-70% collision damage received', '+35% melee damage', '+20% acceleration'],
        drawbacks: ['-30% ranged damage', '-20% turning'],
        buildModifiers: { multiply: { collisionDamageMul: 1.75, collisionDamageTakenMul: 0.3, meleeDamageMul: 1.35, accelerationMul: 1.2, rangedDamageMul: 0.7, turnMul: 0.8 } }
    },
    {
        id: 'doctrine_phantom', name: 'phantom matrix', doctrineId: 'phantom',
        description: 'rewards sneaking in, hitting hard, and running away before they hit back.',
        bonuses: ['+60% first-hit ambush damage', '+35% stealth and decoy duration', '+20% quiet speed'],
        drawbacks: ['-25% maximum hp', '-20% sustained fire rate'],
        buildModifiers: { multiply: { stealthDurationMul: 1.35, decoyDurationMul: 1.35, quietSpeedMul: 1.2, maxHpMul: 0.75, directFireRateMul: 0.8 }, set: { ambushDamageMul: 1.6 } }
    },
    {
        id: 'doctrine_disruptor', name: 'disruptor array', doctrineId: 'disruptor',
        description: 'controls enemies and finishes helpless targets, but fights poorly without its tricks.',
        bonuses: ['+50% hack and emp duration', '+25% ability recharge', '+30% damage to disabled targets'],
        drawbacks: ['-25% ordinary direct damage', '-20% maximum hp'],
        buildModifiers: { multiply: { hackDurationMul: 1.5, empDurationMul: 1.5, abilityCooldownMul: 0.75, disabledTargetDamageMul: 1.3, directDamageMul: 0.75, maxHpMul: 0.8 } }
    },
    {
        id: 'doctrine_demolition', name: 'demolition reactor', doctrineId: 'demolition',
        description: 'makes enormous explosions, but your explosives travel and reload slowly.',
        bonuses: ['+35% explosion radius', '+25% explosive damage', '40% faster mine arming', '+25% shrapnel damage'],
        drawbacks: ['-25% rocket speed', '+30% rocket reload time', '-20% maximum hp'],
        buildModifiers: { multiply: { explosionRadiusMul: 1.35, explosiveDamageMul: 1.25, mineArmingMul: 0.6, shrapnelDamageMul: 1.25, rocketSpeedMul: 0.75, rocketFireRateMul: 1 / 1.3, maxHpMul: 0.8 } }
    },
    {
        id: 'doctrine_gunship', name: 'gunship synchronizer', doctrineId: 'gunship',
        description: 'rewards covering the ship in guns. one gun is weak; a stupid number of guns becomes terrifying.',
        bonuses: ['+6% direct fire rate per extra gun', 'maximum +48% synchronized fire rate'],
        drawbacks: ['-18% damage per shot', '-15% speed', '-25% turning'],
        buildModifiers: { multiply: { directDamageMul: 0.82, speedMul: 0.85, turnMul: 0.75 }, gunship: { perExtraWeapon: 0.06, maximum: 0.48 } }
    },
    {
        id: 'doctrine_warden', name: 'warden field', doctrineId: 'warden',
        description: 'keeps itself and friendly ships alive, but kills things slowly.',
        bonuses: ['+30% shield radius', '35% shorter shield cooldowns', '+40% regeneration and repair', '+20% maximum hp'],
        drawbacks: ['-30% direct damage', '-25% speed'],
        buildModifiers: { multiply: { shieldRadiusMul: 1.3, shieldCooldownMul: 0.65, regenMul: 1.4, droneRepairMul: 1.4, maxHpMul: 1.2, directDamageMul: 0.7, speedMul: 0.75 } }
    }
];

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

export const DOCTRINE_PART_SPECS = Object.freeze(DEFINITIONS.map(entry => deepFreeze({
    ...entry,
    type: 'utility',
    width: 2,
    height: 2,
    rarity: 'legendary',
    uniqueGroup: 'doctrine',
    shopCategory: 'doctrine',
    shopPrice: 90,
    stats: { hp: 60, mass: 8 },
    spriteRows: DOCTRINE_ROWS
})));

export const DOCTRINE_IDS = Object.freeze(DOCTRINE_PART_SPECS.map(spec => spec.doctrineId));

export function isDoctrineDefinition(definition) {
    return definition?.uniqueGroup === 'doctrine' && typeof definition.doctrineId === 'string';
}
