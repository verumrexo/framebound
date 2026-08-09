// @ts-check

/**
 * freeze a plain data tree so part and blueprint specs cannot drift at runtime.
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeData(value) {
    if (value === null || typeof value !== 'object') return value;
    for (const child of Object.values(value)) freezeData(child);
    return Object.freeze(value);
}

const BOMBARD_ROOST = freezeData({
    id: 'drone_bombard_roost',
    name: 'bombard roost',
    type: 'drone',
    width: 2,
    height: 2,
    stats: {
        hp: 80,
        mass: 8,
        weaponGroup: 'drone',
        droneSpawnCooldown: 8.5,
        droneCapacity: 2,
        droneDamage: 24,
        droneAttackCooldown: 2.8,
        droneType: 'bomber'
    },
    carrierRows: [
        '000000200000000',
        '000001111100000',
        '000011111110000',
        '000111111111000',
        '001111111111100',
        '011111222111110',
        '111111222111111',
        '111111222111111',
        '111111222111111',
        '011111222111110',
        '001111111111100',
        '000111111111000',
        '000011111110000',
        '000001111100000',
        '000000200000000'
    ]
});

const FLAK_NURSERY = freezeData({
    id: 'drone_flak_nursery',
    name: 'flak nursery',
    type: 'drone',
    width: 2,
    height: 2,
    stats: {
        hp: 80,
        mass: 8,
        weaponGroup: 'drone',
        droneSpawnCooldown: 6.5,
        droneCapacity: 2,
        droneDamage: 3,
        droneAttackCooldown: 1.2,
        droneType: 'flak'
    },
    carrierRows: [
        '000001000010000',
        '000001111010000',
        '000001111010000',
        '000000111000000',
        '001111111111100',
        '001122222211100',
        '111122222211111',
        '111111111111111',
        '111122222211111',
        '001122222211100',
        '001111111111100',
        '000000111000000',
        '000001111010000',
        '000001000010000',
        '000001000010000'
    ]
});

const BOMBER_BLUEPRINT = freezeData({
    id: 'bomber',
    label: 'bomber drone',
    hp: 35,
    speed: 150,
    turnRate: 2.5,
    range: 520,
    optimalRange: 360,
    projectileType: 'rocket_he',
    projectileSpeed: 450,
    lifetime: 3,
    oneShot: true,
    role: 'attack',
    droneRows: [
        '00021000',
        '00111100',
        '01111110',
        '11122111',
        '11122111',
        '01111110',
        '00111100',
        '00021000'
    ]
});

const FLAK_BLUEPRINT = freezeData({
    id: 'flak',
    label: 'flak drone',
    hp: 28,
    speed: 210,
    turnRate: 4.5,
    range: 230,
    optimalRange: 150,
    projectileType: 'pellet',
    projectileSpeed: 800,
    shotCount: 7,
    spread: 0.6,
    role: 'attack',
    droneRows: [
        '00101000',
        '01111110',
        '11222211',
        '11122111',
        '11222211',
        '01111110',
        '00101000',
        '00000000'
    ]
});

/** @type {ReadonlyArray<object>} */
export const DRONE_PART_SPECS_BOMBARD_FLAK = Object.freeze([
    BOMBARD_ROOST,
    FLAK_NURSERY
]);

/** @type {ReadonlyArray<object>} */
export const DRONE_BLUEPRINT_SPECS_BOMBARD_FLAK = Object.freeze([
    BOMBER_BLUEPRINT,
    FLAK_BLUEPRINT
]);
