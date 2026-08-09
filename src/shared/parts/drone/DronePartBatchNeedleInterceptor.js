// @ts-check

/**
 * Freeze a plain data tree so part and blueprint specs cannot drift at runtime.
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeData(value) {
    if (value === null || typeof value !== 'object') return value;
    for (const child of Object.values(value)) freezeData(child);
    return Object.freeze(value);
}

const NEEDLE_NEST = freezeData({
    id: 'drone_needle_nest',
    name: 'needle nest',
    type: 'drone',
    width: 1,
    height: 1,
    stats: {
        hp: 20,
        mass: 2,
        weaponGroup: 'drone',
        spawnCooldown: 4,
        capacity: 2,
        damage: 3,
        attackCooldown: 0.45,
        droneType: 'needle'
    },
    spriteRows: [
        '00111000',
        '01111100',
        '11022110',
        '11022110',
        '01111100',
        '00111000',
        '00101000',
        '00101000'
    ]
});

const INTERCEPTOR_RACK = freezeData({
    id: 'drone_interceptor_rack',
    name: 'interceptor rack',
    type: 'drone',
    width: 1,
    height: 2,
    stats: {
        hp: 40,
        mass: 4,
        weaponGroup: 'drone',
        spawnCooldown: 5,
        capacity: 3,
        damage: 6,
        attackCooldown: 0.65,
        droneType: 'interceptor'
    },
    spriteRows: [
        '00110000',
        '01111000',
        '11001100',
        '11111111',
        '11111111',
        '11001100',
        '11221100',
        '01221022',
        '01111000',
        '11111111',
        '11001111',
        '11111100',
        '11111100',
        '01111000',
        '00000000'
    ]
});

const NEEDLE_BLUEPRINT = freezeData({
    id: 'needle',
    label: 'needle drone',
    hp: 10,
    speed: 300,
    turnRate: 6,
    range: 280,
    optimalDistance: 180,
    projectileType: 'mini_bullet',
    projectileSpeed: 1000,
    shotCount: 1,
    role: 'attack',
    spriteRows: [
        '00011000',
        '00111100',
        '01122110',
        '00111100',
        '00011000',
        '00011000',
        '00011000',
        '00010000'
    ]
});

const INTERCEPTOR_BLUEPRINT = freezeData({
    id: 'interceptor',
    label: 'interceptor drone',
    hp: 14,
    speed: 360,
    turnRate: 7,
    range: 260,
    optimalDistance: 130,
    projectileType: 'mini_bullet',
    projectileSpeed: 1100,
    shotCount: 2,
    spread: 0.08,
    targetPriority: 'drones',
    role: 'attack',
    spriteRows: [
        '00100100',
        '01111110',
        '11011011',
        '11122111',
        '11011011',
        '01111110',
        '00100100',
        '00011000'
    ]
});

/** @type {ReadonlyArray<object>} */
export const DRONE_PART_SPECS_NEEDLE_INTERCEPTOR = Object.freeze([
    NEEDLE_NEST,
    INTERCEPTOR_RACK
]);

/** @type {ReadonlyArray<object>} */
export const DRONE_BLUEPRINT_SPECS_NEEDLE_INTERCEPTOR = Object.freeze([
    NEEDLE_BLUEPRINT,
    INTERCEPTOR_BLUEPRINT
]);
