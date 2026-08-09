// @ts-check

/**
 * @param {string[]} rows
 * @param {number} width
 * @param {number} height
 * @param {string} label
 * @returns {ReadonlyArray<string>}
 */
function freezeRows(rows, width, height, label) {
    if (rows.length !== height) {
        throw new Error(`${label} must have ${height} rows`);
    }
    for (const row of rows) {
        if (row.length !== width || !/^[012]+$/.test(row)) {
            throw new Error(`${label} rows must be ${width} chars of 0, 1, or 2`);
        }
    }
    return Object.freeze([...rows]);
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeData(value) {
    if (value === null || typeof value !== 'object') return value;
    for (const child of Object.values(value)) freezeData(child);
    return Object.freeze(value);
}

const ramHiveCarrierRows = freezeRows([
    '00011000',
    '00111100',
    '01111110',
    '11111111',
    '11122211',
    '11222211',
    '11222211',
    '11111111',
    '11111111',
    '11222211',
    '11222211',
    '11122211',
    '11111111',
    '01111110',
    '00111100'
], 8, 15, 'ram hive carrier');

const rammerDroneRows = freezeRows([
    '00011000',
    '00111100',
    '01111110',
    '11122111',
    '11222211',
    '01122110',
    '00111000',
    '00111000'
], 8, 8, 'rammer drone');

const stormLatticeCarrierRows = freezeRows([
    '000011111100000',
    '000111111110000',
    '001111111111000',
    '011112222111110',
    '111112222111111',
    '111111111111111',
    '111112222111111',
    '011112222111110',
    '001111111111000',
    '011110222011110',
    '111110222011111',
    '111111111111111',
    '111110222011111',
    '011110222011110',
    '001111111111000',
    '011110222011110',
    '111110222011111',
    '111111111111111',
    '111110222011111',
    '011110222011110',
    '001111111111000',
    '011112222111110',
    '111112222111111',
    '111111111111111',
    '111112222111111',
    '011112222111110',
    '001111111111000',
    '000111111110000',
    '000011111100000'
], 15, 29, 'storm lattice carrier');

const stormDroneRows = freezeRows([
    '00111100',
    '01122110',
    '11211211',
    '12222221',
    '11211211',
    '01122110',
    '00111100',
    '00011000'
], 8, 8, 'storm drone');

const ramHive = freezeData({
    id: 'drone_ram_hive',
    name: 'ram hive',
    type: 'drone',
    width: 1,
    height: 2,
    stats: {
        hp: 40,
        mass: 4,
        weaponGroup: 'drone',
        droneSpawnCooldown: 7,
        droneCapacity: 3,
        droneDamage: 30,
        droneDamageType: 'impact',
        droneAttackCooldown: 1,
        droneType: 'rammer'
    },
    carrierRows: ramHiveCarrierRows,
    droneRows: rammerDroneRows
});

const stormLattice = freezeData({
    id: 'drone_storm_lattice',
    name: 'storm lattice',
    type: 'drone',
    width: 2,
    height: 4,
    stats: {
        hp: 160,
        mass: 16,
        weaponGroup: 'drone',
        droneSpawnCooldown: 6.5,
        droneCapacity: 5,
        droneDamage: 3,
        droneAttackCooldown: 0.9,
        droneType: 'storm'
    },
    carrierRows: stormLatticeCarrierRows,
    droneRows: stormDroneRows
});

const rammerBlueprint = freezeData({
    id: 'rammer',
    label: 'rammer drone',
    hp: 12,
    speed: 420,
    turnRate: 8,
    range: 700,
    optimalDistance: 0,
    role: 'ram',
    contactRange: 22
});

const stormBlueprint = freezeData({
    id: 'storm',
    label: 'storm drone',
    hp: 24,
    speed: 240,
    turnRate: 5,
    range: 320,
    optimalDistance: 190,
    projectileType: 'small_laser',
    projectileSpeed: 1800,
    shotCount: 2,
    spread: 0.18,
    role: 'attack'
});

/** @type {Readonly<Record<string, object>>} */
export const DRONE_PART_SPECS_RAM_STORM = Object.freeze({
    drone_ram_hive: ramHive,
    drone_storm_lattice: stormLattice
});

/** @type {Readonly<Record<string, object>>} */
export const DRONE_BLUEPRINT_SPECS_RAM_STORM = Object.freeze({
    rammer: rammerBlueprint,
    storm: stormBlueprint
});
