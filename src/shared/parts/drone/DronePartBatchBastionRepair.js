const freezeRows = (rows, width, label) => {
    if (rows.length !== width) {
        throw new Error(`${label} must have ${width} rows`);
    }
    for (const row of rows) {
        if (row.length !== width || !/^[012]+$/.test(row)) {
            throw new Error(`${label} rows must be ${width} chars of 0, 1, or 2`);
        }
    }
    return Object.freeze([...rows]);
};

const bastionCarrierRows = freezeRows([
    '000001110000000',
    '000111111100000',
    '001112221110000',
    '011111111111110',
    '011122222111110',
    '111112221111111',
    '111111111111111',
    '111112221111111',
    '111111111111111',
    '011122222111110',
    '011111111111110',
    '001112221110000',
    '000111111100000',
    '000001110000000',
    '000000000000000'
], 15, 'bastion carrier');

const bastionDroneRows = freezeRows([
    '01111110',
    '12222221',
    '12111121',
    '12122121',
    '12111121',
    '12222221',
    '01111110',
    '00011000'
], 8, 'bastion drone');

const repairCarrierRows = freezeRows([
    '000000000000000',
    '000000011100000',
    '000000011100000',
    '000001111110000',
    '000001122110000',
    '000001122110000',
    '001111122111100',
    '011111122111110',
    '001111122111100',
    '000001122110000',
    '000001122110000',
    '000001111110000',
    '000000011100000',
    '000000011100000',
    '000000000000000'
], 15, 'repair carrier');

const repairDroneRows = freezeRows([
    '00011000',
    '00011000',
    '00122100',
    '11211211',
    '11211211',
    '00122100',
    '00011000',
    '00011000'
], 8, 'repair drone');

const bastionPart = Object.freeze({
    id: 'drone_bastion_foundry',
    name: 'bastion foundry',
    type: 'drone',
    width: 2,
    height: 2,
    stats: Object.freeze({
        hp: 80,
        mass: 8,
        weaponGroup: 'drone',
        droneSpawnCooldown: 10,
        droneCapacity: 2,
        droneDamage: 12,
        droneAttackCooldown: 1,
        droneType: 'bastion'
    }),
    carrierRows: bastionCarrierRows,
    droneRows: bastionDroneRows
});

const repairPart = Object.freeze({
    id: 'drone_repair_choir',
    name: 'repair choir',
    type: 'drone',
    width: 2,
    height: 2,
    stats: Object.freeze({
        hp: 80,
        mass: 8,
        weaponGroup: 'drone',
        droneSpawnCooldown: 9,
        droneCapacity: 2,
        droneDamage: 0,
        droneAttackCooldown: 2,
        droneType: 'mender',
        droneRole: 'repair'
    }),
    carrierRows: repairCarrierRows,
    droneRows: repairDroneRows
});

const bastionBlueprint = Object.freeze({
    id: 'bastion',
    label: 'bastion',
    hp: 90,
    speed: 90,
    turnRate: 2,
    range: 380,
    optimalRange: 260,
    projectileType: 'laser',
    projectileSpeed: 1500,
    attackCooldown: 1,
    oneShot: true,
    role: 'attack'
});

const menderBlueprint = Object.freeze({
    id: 'mender',
    label: 'mender',
    hp: 35,
    speed: 200,
    turnRate: 4,
    range: 360,
    optimalRange: 120,
    attackCooldown: 2,
    role: 'repair',
    repairAmount: 4
});

export const DRONE_PART_SPECS_BASTION_REPAIR = Object.freeze([
    bastionPart,
    repairPart
]);

export const DRONE_BLUEPRINT_SPECS_BASTION_REPAIR = Object.freeze([
    bastionBlueprint,
    menderBlueprint
]);
