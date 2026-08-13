// @ts-check

/**
 * Freeze a plain data tree so the arsenal manifest stays immutable at runtime.
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeData(value) {
    if (value === null || typeof value !== 'object') return value;
    for (const child of Object.values(value)) freezeData(child);
    return Object.freeze(value);
}

const NEEDLER = freezeData({
    id: 'needler',
    name: 'needler',
    type: 'weapon',
    width: 1,
    height: 1,
    stats: {
        hp: 15,
        mass: 2,
        damage: 0.6,
        cooldown: 0.12,
        projectileType: 'mini_bullet',
        projectileSpeed: 1050,
        weaponGroup: 'velocity'
    },
    spriteRows: [
        '00010000',
        '00010000',
        '00010000',
        '00111000',
        '00121000',
        '00111000',
        '00010000',
        '00010000'
    ]
});

const TWIN_DART = freezeData({
    id: 'twin_dart',
    name: 'twin dart',
    type: 'weapon',
    width: 1,
    height: 2,
    stats: {
        hp: 35,
        mass: 4,
        damage: 4,
        cooldown: 0.75,
        projectileSpeed: 900,
        projectileType: 'bullet',
        weaponGroup: 'velocity',
        pelletCount: 2,
        spread: 0.04,
        barrelSpacing: 10
    },
    spriteRows: [
        '01001000',
        '01001000',
        '01001000',
        '01001000',
        '01001000',
        '01001000',
        '01001000',
        '01111000',
        '01122000',
        '01111000',
        '01001000',
        '01001000',
        '01001000',
        '01001000',
        '00000000'
    ]
});

const HEAVY_SLUGGER = freezeData({
    id: 'heavy_slugger',
    name: 'heavy slugger',
    type: 'weapon',
    width: 1,
    height: 2,
    stats: {
        hp: 40,
        mass: 5,
        damage: 16,
        cooldown: 1.6,
        projectileSpeed: 850,
        projectileType: 'bullet',
        weaponGroup: 'velocity'
    },
    spriteRows: [
        '00000000',
        '00111100',
        '01111110',
        '01122110',
        '01122110',
        '01111110',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00000000'
    ]
});

const BURST_CANNON = freezeData({
    id: 'burst_cannon',
    name: 'burst cannon',
    type: 'weapon',
    width: 2,
    height: 2,
    stats: {
        hp: 75,
        mass: 9,
        damage: 7,
        cooldown: 1.8,
        projectileSpeed: 900,
        projectileType: 'bullet',
        weaponGroup: 'velocity',
        burstCount: 5,
        burstInterval: 0.07
    },
    spriteRows: [
        '000001000000000',
        '000011100000000',
        '000110110000000',
        '001111111000000',
        '011112111100000',
        '011122221100000',
        '111122222111000',
        '111111111111100',
        '111122222111000',
        '011122221100000',
        '011112111100000',
        '001111111000000',
        '000110110000000',
        '000011100000000',
        '000001000000000'
    ]
});

const RICOCHET_CANNON = freezeData({
    id: 'ricochet_cannon',
    name: 'ricochet cannon',
    type: 'weapon',
    width: 1,
    height: 2,
    stats: {
        hp: 35,
        mass: 4,
        damage: 5.5,
        cooldown: 0.9,
        projectileSpeed: 800,
        projectileType: 'ricochet_slug',
        weaponGroup: 'velocity',
        ricochetCount: 1,
        ricochetRange: 320,
        ricochetDamageMul: 0.7
    },
    spriteRows: [
        '00010000',
        '00011000',
        '00011100',
        '00001110',
        '00000110',
        '00000010',
        '00000010',
        '00111110',
        '00122210',
        '00111110',
        '00000010',
        '00000010',
        '00000010',
        '00000010',
        '00000000'
    ]
});

const ARC_WELDER = freezeData({
    id: 'arc_welder',
    name: 'arc welder',
    type: 'weapon',
    width: 1,
    height: 1,
    stats: {
        hp: 15,
        mass: 2,
        damage: 1.2,
        cooldown: 0.18,
        projectileType: 'arc_welder',
        weaponGroup: 'laser',
        range: 140,
        lifetime: 0.06
    },
    spriteRows: [
        '00000000',
        '00100000',
        '00101000',
        '00101000',
        '00111000',
        '00121000',
        '00111000',
        '00000000'
    ]
});

const PULSE_LANCE = freezeData({
    id: 'pulse_lance',
    name: 'pulse lance',
    type: 'weapon',
    width: 1,
    height: 2,
    stats: {
        hp: 35,
        mass: 4,
        damage: 10.5,
        cooldown: 1.05,
        projectileType: 'laser',
        projectileSpeed: 1500,
        weaponGroup: 'laser'
    },
    spriteRows: [
        '00000010',
        '00000011',
        '00000111',
        '00001111',
        '00011111',
        '00111111',
        '01111111',
        '11111111',
        '01111111',
        '00111111',
        '00011111',
        '00001111',
        '00000111',
        '00000011',
        '00000001'
    ]
});

const LIGHTNING_ROD = freezeData({
    id: 'lightning_rod',
    name: 'lightning rod',
    type: 'weapon',
    width: 2,
    height: 2,
    stats: {
        hp: 70,
        mass: 8,
        damage: 17,
        cooldown: 1.6,
        projectileType: 'small_laser',
        projectileSpeed: 1800,
        weaponGroup: 'laser',
        baseChainCount: 2
    },
    spriteRows: [
        '000100000010000',
        '000110000110000',
        '000111001110000',
        '000011111100000',
        '000001111000000',
        '000011111100000',
        '000111222111000',
        '001111222111100',
        '000111222111000',
        '000011111100000',
        '000001111000000',
        '000011111100000',
        '000111001110000',
        '000110000110000',
        '000100000010000'
    ]
});

const MICRO_MISSILE_POD = freezeData({
    id: 'micro_missile_pod',
    name: 'micro missile pod',
    type: 'weapon',
    width: 1,
    height: 1,
    stats: {
        hp: 20,
        mass: 2,
        damage: 1.5,
        cooldown: 1.7,
        projectileType: 'guided_rocket',
        projectileSpeed: 520,
        weaponGroup: 'rocket',
        burstCount: 3,
        burstInterval: 0.16,
        lifetime: 2.4
    },
    spriteRows: [
        '00101000',
        '01111100',
        '01212100',
        '01111100',
        '00101000',
        '00101000',
        '00101000',
        '00000000'
    ]
});

const TORPEDO_TUBE = freezeData({
    id: 'torpedo_tube',
    name: 'torpedo tube',
    type: 'weapon',
    width: 1,
    height: 2,
    stats: {
        hp: 40,
        mass: 5,
        damage: 18,
        cooldown: 4.8,
        projectileType: 'torpedo',
        projectileSpeed: 280,
        weaponGroup: 'rocket',
        lifetime: 4,
        aoeRadius: 100
    },
    spriteRows: [
        '00011000',
        '00111100',
        '01111110',
        '11111111',
        '11122111',
        '11111111',
        '01111110',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00111100',
        '00000000'
    ]
});

/** @type {ReadonlyArray<object>} */
export const EXTRA_WEAPON_PART_SPECS = Object.freeze([
    NEEDLER,
    TWIN_DART,
    HEAVY_SLUGGER,
    BURST_CANNON,
    RICOCHET_CANNON,
    ARC_WELDER,
    PULSE_LANCE,
    LIGHTNING_ROD,
    MICRO_MISSILE_POD,
    TORPEDO_TUBE
]);
