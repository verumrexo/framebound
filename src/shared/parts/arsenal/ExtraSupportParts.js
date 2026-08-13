// @ts-check

/**
 * freeze a plain data tree so authored part specs cannot drift at runtime.
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeData(value) {
    if (value === null || typeof value !== 'object') return value;
    for (const child of Object.values(value)) freezeData(child);
    return Object.freeze(value);
}

const PATCH_PLATE = freezeData({
    id: 'patch_plate',
    name: 'patch plate',
    type: 'hull',
    width: 1,
    height: 1,
    stats: {
        hp: 30,
        mass: 3
    },
    spriteRows: [
        '21100112',
        '11111111',
        '11222211',
        '11122111',
        '11112211',
        '11222211',
        '11111111',
        '21000012'
    ]
});

const KEEL_BEAM = freezeData({
    id: 'keel_beam',
    name: 'keel beam',
    type: 'hull',
    width: 1,
    height: 2,
    stats: {
        hp: 55,
        mass: 5
    },
    spriteRows: [
        '00011000',
        '00111100',
        '00122100',
        '00122100',
        '01122110',
        '01122110',
        '00122100',
        '00122100',
        '01122210',
        '01122110',
        '00122100',
        '00122100',
        '00111100',
        '00011000',
        '00011000'
    ]
});

const BULKHEAD = freezeData({
    id: 'bulkhead',
    name: 'bulkhead',
    type: 'hull',
    width: 2,
    height: 2,
    stats: {
        hp: 120,
        mass: 12
    },
    spriteRows: [
        '111111111111111',
        '122222222222221',
        '121111111111121',
        '121122222211121',
        '121121111112121',
        '121121222112121',
        '121121211112121',
        '121122222211121',
        '121121111112121',
        '121121222112121',
        '121121111112121',
        '121122222211121',
        '121111111111121',
        '122222222222221',
        '111111111111111'
    ]
});

const COFFIN_HULL = freezeData({
    id: 'coffin_hull',
    name: 'coffin hull',
    type: 'hull',
    width: 2,
    height: 4,
    stats: {
        hp: 260,
        mass: 28
    },
    spriteRows: [
        '000011111100000',
        '000111111110000',
        '001111222111000',
        '011111111111110',
        '011122222221110',
        '111111111111111',
        '111111222111111',
        '111111222111111',
        '111112222211111',
        '111111111111111',
        '111222222221111',
        '111111111111111',
        '111111222111111',
        '111111222111111',
        '111112222211111',
        '111111111111111',
        '111112222211111',
        '111111222111111',
        '111111222111111',
        '111111111111111',
        '111122222211111',
        '111111111111111',
        '011111111111110',
        '011122222221110',
        '001111111111000',
        '001111222111000',
        '000111111110000',
        '000011111100000',
        '000011111100000'
    ]
});

const GLASSWING = freezeData({
    id: 'glasswing',
    name: 'glasswing',
    type: 'hull',
    width: 1,
    height: 2,
    stats: {
        hp: 24,
        mass: 1,
        turnSpeed: 0.35
    },
    spriteRows: [
        '00000001',
        '00000011',
        '00000112',
        '00001112',
        '00011122',
        '00111112',
        '00111222',
        '01112222',
        '00111222',
        '00111112',
        '00011122',
        '00001112',
        '00000112',
        '00000011',
        '00000001'
    ]
});

const ENGINE_BRACE = freezeData({
    id: 'engine_brace',
    name: 'engine brace',
    type: 'hull',
    width: 1,
    height: 1,
    stats: {
        hp: 18,
        mass: 1,
        thrust: 1
    },
    spriteRows: [
        '11111110',
        '11221110',
        '11122110',
        '11001110',
        '11011110',
        '11111110',
        '00011000',
        '00000000'
    ]
});

const SALVAGE_MAGNET = freezeData({
    id: 'salvage_magnet',
    name: 'salvage magnet',
    type: 'utility',
    width: 1,
    height: 1,
    stats: {
        hp: 18,
        mass: 2,
        pickupRadiusMul: 2
    },
    spriteRows: [
        '11000011',
        '11000011',
        '11200021',
        '11122211',
        '11111111',
        '01111110',
        '00111000',
        '00000000'
    ]
});

const COOLANT_LOOP = freezeData({
    id: 'coolant_loop',
    name: 'coolant loop',
    type: 'utility',
    width: 1,
    height: 1,
    stats: {
        hp: 16,
        mass: 2,
        globalFireRateMul: 1.12
    },
    spriteRows: [
        '00111100',
        '01122210',
        '11200211',
        '12000021',
        '12000021',
        '11200211',
        '01122210',
        '00111100'
    ]
});

const GYRO_RING = freezeData({
    id: 'gyro_ring',
    name: 'gyro ring',
    type: 'utility',
    width: 1,
    height: 2,
    stats: {
        hp: 35,
        mass: 3,
        turnSpeed: 1.2
    },
    spriteRows: [
        '00111000',
        '01122110',
        '11211211',
        '12222221',
        '11211211',
        '01122110',
        '00111000',
        '00011000',
        '00122100',
        '01222210',
        '12211221',
        '01222210',
        '00122100',
        '00011000',
        '00011000'
    ]
});

const RANGEFINDER = freezeData({
    id: 'rangefinder',
    name: 'rangefinder',
    type: 'utility',
    width: 1,
    height: 1,
    stats: {
        hp: 16,
        mass: 2
    },
    spriteRows: [
        '00011000',
        '00111100',
        '01122110',
        '11222211',
        '11222211',
        '01122110',
        '00111100',
        '01001010'
    ]
});

/** @type {ReadonlyArray<object>} */
export const EXTRA_SUPPORT_PART_SPECS = Object.freeze([
    PATCH_PLATE,
    KEEL_BEAM,
    BULKHEAD,
    COFFIN_HULL,
    GLASSWING,
    ENGINE_BRACE,
    SALVAGE_MAGNET,
    COOLANT_LOOP,
    GYRO_RING,
    RANGEFINDER
]);
