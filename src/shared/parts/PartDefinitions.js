
// @ts-check

// A 16x16 authored raster is rendered at 2x = 32 world px.
// One authored-pixel seam overlap is 2 world px, so adjacent cell centers
// are 32 - 2 = 30 world px apart. Legacy 8x8 sprites remain 32 world px.
export const TILE_SIZE = 30;

export const PartType = {
    HULL: 'hull',
    WEAPON: 'weapon',
    THRUSTER: 'thruster',
    ACCELERANT: 'accelerant',
    ROCKET_BAY: 'rocket_bay',
    BOOSTER: 'booster',
    DRONE: 'drone',
    UTILITY: 'utility',
    CORE: 'core',
    SHIELD: 'shield'
};

/**
 * @typedef {object} PartStats
 * @property {number} [hp]
 * @property {number} [mass]
 * @property {number} [energy]
 * @property {number} [thrust]
 * @property {number} [turnSpeed]
 * @property {number} [regen]
 * @property {number} [damage]
 * @property {number} [cooldown]
 * @property {number} [projectileSpeed]
 * @property {string} [projectileType]
 * @property {'velocity' | 'laser' | 'rocket' | 'drone' | 'utility'} [weaponGroup]
 * @property {number} [droneSpawnCooldown]
 * @property {number} [droneCapacity]
 * @property {number} [droneDamage]
 * @property {number} [droneAttackCooldown]
 * @property {string} [droneType]
 * @property {'impact'} [droneDamageType]
 * @property {number} [droneRepairAmount]
 * @property {'drones'} [droneTargetPriority]
 * @property {'repair' | 'ram' | 'attack'} [droneRole]
 * @property {number} [lifetime]
 * @property {number} [range]
 * @property {number} [spread]
 * @property {number} [aoeRadius]
 * @property {number} [burstCount]
 * @property {number} [burstInterval]
 * @property {number} [chargeTime]
 * @property {boolean} [rampUp]
 * @property {number} [maxRamp]
 * @property {number} [rampRate]
 * @property {number} [peakDuration]
 * @property {number} [overheatCooldown]
 * @property {number} [pelletCount]
 * @property {number} [pelletInterval]
 * @property {number} [barrelSpacing]
 * @property {{ x?: number, y?: number }} [barrelPosition]
 * @property {number} [shieldCooldown]
 * @property {number} [shieldRadiusScale]
 * @property {number} [soundPitch]
 * @property {number} [soundVolume]
 * @property {string} [activeAbility]
 * @property {number} [abilityCooldown]
 * @property {number} [abilityRange]
 * @property {number} [abilityDuration]
 * @property {number} [abilityRadius]
 * @property {number} [cameraZoom]
 * @property {number} [pickupRadiusMul]
 * @property {number} [globalFireRateMul]
 * @property {number} [projectileSpeedMul]
 * @property {number} [velocityDamageMul]
 * @property {number} [velocityPierceAdd]
 * @property {number} [aimAssistAngle]
 * @property {number} [aimAssistRange]
 * @property {number} [laserSplitCount]
 * @property {number} [laserSplitAngle]
 * @property {number} [laserSplitDamageMul]
 * @property {number} [decoyHp]
 * @property {number} [bossDuration]
 * @property {number} [hackDuration]
 * @property {number} [armingTime]
 * @property {number} [triggerRadius]
 * @property {number} [shrapnelCount]
 * @property {number} [shrapnelDamage]
 * @property {number} [ricochetCount]
 * @property {number} [ricochetRange]
 * @property {number} [ricochetDamageMul]
 * @property {number} [baseChainCount]
 */

export class PartDef {
    /**
     * @param {string} id
     * @param {string} name
     * @param {string} type
     * @param {unknown} sprite
     * @param {PartStats} stats
     * @param {number} width
     * @param {number} height
     */
    constructor(id, name, type, sprite, stats = {}, width = 1, height = 1) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.sprite = sprite;
        this.width = width;
        this.height = height;
        this.baseSprite = null; // Optional custom base frame
        this.description = ''; // Plain-English explanation shown in the UI
        this.rotationOffset = 0; // Optional rotation offset for turrets
        this.turretDrawOffset = 0; // Optional positional offset for turrets (along aim vector)
        this.projectileLook = 'default'; // Renderer-only weapon projectile skin
        this.projectileTrail = 'default'; // Renderer-only weapon trail skin

        // Auto-assign rarity based on size
        const size = width * height;
        this.rarity = 'common';
        if (size === 2) this.rarity = 'rare'; // 1x2 or 2x1
        if (size === 4) this.rarity = 'epic'; // 2x2
        if (size === 8) this.rarity = 'legendary'; // 2x4 or 4x2

        this.stats = {
            hp: 10,
            mass: 1,
            energy: 0,
            ...stats
        };
    }
}
