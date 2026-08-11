// @ts-check

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeData(value) {
    if (value === null || typeof value !== 'object') return value;
    for (const child of Object.values(value)) freezeData(child);
    return Object.freeze(value);
}

const REQUESTED_SPECS = [
    {
        id: 'warp_gate',
        name: 'warp gate',
        type: 'utility',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            activeAbility: 'blink',
            abilityCooldown: 7,
            abilityRange: 260
        },
        spriteRows: [
            '00000000',
            '00111100',
            '01122110',
            '11000211',
            '11000211',
            '11200211',
            '11000211',
            '11000021',
            '11000211',
            '11000211',
            '11000211',
            '01122110',
            '00111100',
            '00011000',
            '00000000'
        ]
    },
    {
        id: 'mine_placer',
        name: 'mine placer',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            damage: 18,
            cooldown: 2.6,
            projectileType: 'proximity_mine',
            weaponGroup: 'rocket',
            armingTime: 0.65,
            triggerRadius: 80,
            aoeRadius: 90,
            lifetime: 18
        },
        spriteRows: [
            '00011000',
            '00111100',
            '01122110',
            '11022111',
            '11000111',
            '11000111',
            '11000111',
            '11000111',
            '11010111',
            '11010111',
            '11010111',
            '11010111',
            '10111011',
            '10000011',
            '00000000'
        ]
    },
    {
        id: 'captain_seat',
        name: 'captain seat',
        type: 'utility',
        width: 2,
        height: 2,
        stats: {
            hp: 80,
            mass: 8,
            cameraZoom: 0.48
        },
        spriteRows: [
            '000011111100000',
            '000111222111000',
            '001111111111100',
            '011110222011110',
            '011110222011110',
            '011111111111110',
            '011111111111110',
            '011100222001110',
            '011100222001110',
            '011111111111110',
            '011111111111110',
            '001111111111100',
            '001110000011100',
            '001100000001100',
            '000000000000000'
        ]
    },
    {
        id: 'beam_sword',
        name: 'beam sword',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            damage: 28,
            cooldown: 0.85,
            projectileType: 'beam_sword',
            weaponGroup: 'laser',
            range: 120,
            lifetime: 0.22
        },
        spriteRows: [
            '00010000',
            '00111000',
            '01122110',
            '11111111',
            '00111000',
            '00010000',
            '00010000',
            '00012220',
            '00012220',
            '00012220',
            '00012220',
            '00012220',
            '00012220',
            '00011110',
            '00000000'
        ]
    },
    {
        id: 'shrapnel_grenade',
        name: 'shrapnel grenade',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            damage: 12,
            cooldown: 3.2,
            projectileType: 'shrapnel_grenade',
            weaponGroup: 'rocket',
            lifetime: 1.35,
            aoeRadius: 70,
            shrapnelCount: 10,
            shrapnelDamage: 3.5
        },
        spriteRows: [
            '00011000',
            '00111100',
            '01122110',
            '11011211',
            '11011211',
            '11011211',
            '11011211',
            '11011211',
            '11011211',
            '11011211',
            '11011211',
            '01122110',
            '00111100',
            '00011000',
            '00000000'
        ]
    },
    {
        id: 'decoy',
        name: 'decoy',
        type: 'utility',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            activeAbility: 'decoy',
            abilityCooldown: 12,
            abilityDuration: 6,
            decoyHp: 35,
            abilityRange: 180
        },
        spriteRows: [
            '00110000',
            '01111000',
            '11022110',
            '11000110',
            '11100110',
            '11100110',
            '11022110',
            '01111000',
            '00110000',
            '00011000',
            '00111100',
            '01122110',
            '11000110',
            '11000110',
            '00000000'
        ]
    },
    {
        id: 'stealth',
        name: 'stealth',
        type: 'utility',
        width: 1,
        height: 2,
        stats: {
            hp: 35,
            mass: 3,
            activeAbility: 'stealth',
            abilityCooldown: 14,
            abilityDuration: 4
        },
        coreEffectColor: '#b56cff',
        coreEffectRows: [
            '00010000',
            '00111000',
            '01101100',
            '11000110',
            '01101100',
            '00111000',
            '00010000',
            '00000000'
        ],
        spriteRows: [
            '00000000',
            '00111000',
            '01000100',
            '10000010',
            '10011010',
            '10000010',
            '01000100',
            '00111000',
            '00011000',
            '00001100',
            '00000110',
            '00000011',
            '00000112',
            '00000000',
            '00000000'
        ]
    },
    {
        id: 'hack_dart',
        name: 'hack dart',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 35,
            mass: 4,
            damage: 1,
            cooldown: 6,
            projectileType: 'hack_dart',
            projectileSpeed: 900,
            weaponGroup: 'utility',
            hackDuration: 8
        },
        spriteRows: [
            '00010000',
            '00111000',
            '01121100',
            '00111000',
            '00010000',
            '00010000',
            '00010000',
            '00010000',
            '00010000',
            '00010000',
            '00111000',
            '01121100',
            '11000110',
            '00000000',
            '00000000'
        ]
    },
    {
        id: 'auto_aim',
        name: 'auto aim',
        type: 'utility',
        width: 1,
        height: 1,
        rarity: 'legendary',
        coreEffectColor: '#ff4444',
        stats: {
            hp: 18,
            mass: 2,
            aimAssistAngle: 0.2443460953,
            aimAssistRange: 750
        },
        spriteRows: [
            '00000000',
            '01111110',
            '11022111',
            '11011211',
            '11022111',
            '01111110',
            '00111000',
            '00000000'
        ]
    },
    {
        id: 'prism',
        name: 'prism',
        type: 'utility',
        width: 1,
        height: 1,
        stats: {
            hp: 18,
            mass: 2,
            laserSplitCount: 2,
            laserSplitAngle: 0.1396263402,
            laserSplitDamageMul: 0.45
        },
        spriteRows: [
            '00010000',
            '00111000',
            '01111110',
            '11122111',
            '01111110',
            '00111000',
            '00010000',
            '00000000'
        ]
    },
    {
        id: 'emp',
        name: 'emp',
        type: 'utility',
        width: 2,
        height: 2,
        stats: {
            hp: 75,
            mass: 8,
            activeAbility: 'emp',
            abilityCooldown: 16,
            abilityRadius: 360,
            abilityDuration: 3,
            bossDuration: 1.25
        },
        spriteRows: [
            '000011111100000',
            '001110000011100',
            '011001111110011',
            '110011222110011',
            '110110000011011',
            '111100000001111',
            '011001111110011',
            '001110000011100',
            '000011111100000',
            '000000000000000',
            '001110000011100',
            '011001111110011',
            '110011222110011',
            '011000000001100',
            '000011111100000'
        ]
    },
    {
        id: 'fmj',
        name: 'fmj',
        type: 'utility',
        width: 1,
        height: 1,
        stats: {
            hp: 18,
            mass: 2,
            velocityDamageMul: 1.1,
            velocityPierceAdd: 1
        },
        spriteRows: [
            '00011000',
            '00111100',
            '01122110',
            '11011211',
            '11011211',
            '01122110',
            '00111100',
            '00011000'
        ]
    }
];

/** @type {ReadonlyArray<object>} */
export const REQUESTED_ARSENAL_PART_SPECS = /** @type {ReadonlyArray<object>} */ (
    freezeData(REQUESTED_SPECS)
);
