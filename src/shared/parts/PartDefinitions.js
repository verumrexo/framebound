
// @ts-check

// Asset is 8x8 scaled by 4 = 32px.
// Border is 1px scaled by 4 = 4px.
// To have single-width walls, we must overlap by the border width (4px).
// So effective tile stride is 32 - 4 = 28.
export const TILE_SIZE = 28;

export const PartType = {
    HULL: 'hull',
    WEAPON: 'weapon',
    THRUSTER: 'thruster',
    ACCELERANT: 'accelerant',
    ROCKET_BAY: 'rocket_bay',
    BOOSTER: 'booster',
    DRONE: 'drone',
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
        this.rotationOffset = 0; // Optional rotation offset for turrets
        this.turretDrawOffset = 0; // Optional positional offset for turrets (along aim vector)

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
