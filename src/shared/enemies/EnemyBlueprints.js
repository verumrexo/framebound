import { PartsLibrary } from '../parts/Part.js';

const blueprint = (behavior, stats, parts, options = {}) => ({
    behavior,
    stats,
    parts,
    weaponAimLock: options.weaponAimLock === true
});

// Enemy bodies live here instead of inside Enemy. These manifests deliberately
// use the same partId/x/y/rotation language as player ships so a future editor
// can rearrange a body without rewriting its AI.
export const EnemyBlueprints = {
    basic: blueprint('pursuer', {
        maxHp: 50,
        radiusTiles: 1.2,
        speed: 100,
        turnRate: 2.5,
        engagementDist: 300,
        detectionDist: 1000,
        damageMultiplier: 1
    }, [
        { x: 0, y: 0, partId: 'custom_1768410823264', rotation: 0 },
        { x: -1, y: 0, partId: 'gun_basic', rotation: 0 },
        { x: -1, y: -1, partId: 'custom_1767997148612', rotation: 3 }
    ]),
    striker: blueprint('skirmisher', {
        maxHp: 120,
        radiusTiles: 1.5,
        speed: 160,
        turnRate: 3.5,
        engagementDist: 500,
        detectionDist: 1200,
        damageMultiplier: 0.3
    }, [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: 0, y: 1, partId: 'custom_1767997148612', rotation: 1 },
        { x: 0, y: -1, partId: 'custom_1767997148612', rotation: 3 },
        { x: -1, y: 0, partId: 'lps', rotation: 3 }
    ], { weaponAimLock: true }),
    rocketeer: blueprint('artillery', {
        maxHp: 200,
        radiusTiles: 2,
        speed: 80,
        turnRate: 2,
        engagementDist: 600,
        detectionDist: 1200,
        damageMultiplier: 0.4
    }, [
        { x: -1, y: -1, partId: 'core', rotation: 0 },
        { x: -1, y: -2, partId: 'hull', rotation: 0 },
        { x: -2, y: -1, partId: 'hull', rotation: 0 },
        { x: -1, y: 0, partId: 'hull', rotation: 0 },
        { x: 0, y: -1, partId: 'hull', rotation: 0 },
        { x: 0, y: -3, partId: 'custom_1768036702131', rotation: 0 },
        { x: 0, y: 0, partId: 'custom_1768036702131', rotation: 1 },
        { x: -3, y: 0, partId: 'custom_1768036702131', rotation: 2 },
        { x: -3, y: -3, partId: 'custom_1768036702131', rotation: 3 },
        { x: -3, y: -1, partId: 'custom_1767997495375', rotation: 1 }
    ], { weaponAimLock: true }),
    sniper: blueprint('sniper', {
        maxHp: 100,
        radiusTiles: 1.8,
        speed: 60,
        turnRate: 1.5,
        engagementDist: 900,
        detectionDist: 1500,
        damageMultiplier: 0.6
    }, [
        { x: 1, y: -4, partId: 'custom_1768857172136', rotation: 0 },
        { x: 0, y: -3, partId: 'custom_1768676906827', rotation: 1 },
        { x: 0, y: -2, partId: 'core', rotation: 1 },
        { x: 0, y: -1, partId: 'core', rotation: 1 },
        { x: 0, y: 0, partId: 'core', rotation: 1 },
        { x: 0, y: 1, partId: 'custom_1768676906827', rotation: 3 },
        { x: 1, y: 1, partId: 'custom_1768857172136', rotation: 0 },
        { x: 0, y: -4, partId: 'custom_1768410823264', rotation: 0 },
        { x: 0, y: 2, partId: 'custom_1768410823264', rotation: 0 },
        { x: -2, y: -1, partId: 'custom_1768035239205', rotation: 3 },
        { x: -3, y: -1, partId: 'custom_1767997495375', rotation: 1 }
    ]),
    hive_carrier: blueprint('carrier', {
        maxHp: 250,
        radiusTiles: 4,
        speed: 120,
        turnRate: 1.8,
        engagementDist: 800,
        detectionDist: 1500,
        damageMultiplier: 0.5
    }, [
        { x: -4, y: -1, partId: 'custom_1769974460678', rotation: 3 },
        { x: 0, y: -1, partId: 'custom_1769974460678', rotation: 1 },
        { x: -3, y: -2, partId: 'custom_1768410823264', rotation: 1 },
        { x: 2, y: -2, partId: 'custom_1768410823264', rotation: 1 },
        { x: -3, y: 1, partId: 'custom_1768410823264', rotation: 1 },
        { x: 2, y: 1, partId: 'custom_1768410823264', rotation: 1 },
        { x: -2, y: -2, partId: 'custom_1768035239205', rotation: 1 },
        { x: -2, y: 1, partId: 'custom_1768035239205', rotation: 1 },
        { x: 0, y: 1, partId: 'custom_1767997148612', rotation: 1 },
        { x: 0, y: -2, partId: 'custom_1767997148612', rotation: 3 }
    ]),
    circler: blueprint('orbiter', {
        maxHp: 80,
        radiusTiles: 1.3,
        speed: 250,
        turnRate: 4,
        engagementDist: 300,
        detectionDist: 1200,
        damageMultiplier: 0.5
    }, [
        { x: -2, y: -1, partId: 'custom_1768392079955', rotation: 1 },
        { x: 0, y: -1, partId: 'rocketle', rotation: 1 },
        { x: 0, y: 0, partId: 'rocketle', rotation: 1 },
        { x: 1, y: -1, partId: 'custom_1767997148612', rotation: 0 }
    ]),
    interceptor: blueprint('flanker', {
        maxHp: 90,
        radiusTiles: 1.5,
        speed: 220,
        turnRate: 5,
        engagementDist: 420,
        detectionDist: 1400,
        damageMultiplier: 0.35
    }, [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: 0, y: -1, partId: 'lps', rotation: 0 },
        { x: 0, y: 1, partId: 'lps', rotation: 0 },
        { x: -1, y: -1, partId: 'custom_1768676906827', rotation: 3 },
        { x: -1, y: 1, partId: 'custom_1768676906827', rotation: 1 },
        { x: -1, y: 0, partId: 'custom_1767997148612', rotation: 0 }
    ], { weaponAimLock: true }),
    repair_tender: blueprint('support', {
        maxHp: 160,
        radiusTiles: 2,
        speed: 130,
        turnRate: 2.4,
        engagementDist: 650,
        detectionDist: 1400,
        damageMultiplier: 0
    }, [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: -1, y: -1, partId: 'custom_1768035239205', rotation: 0 },
        { x: 1, y: -1, partId: 'custom_1768035239205', rotation: 0 },
        { x: 0, y: -1, partId: 'custom_1768410823264', rotation: 0 },
        { x: -1, y: 1, partId: 'custom_1768676906827', rotation: 1 },
        { x: 1, y: 1, partId: 'custom_1768676906827', rotation: 1 }
    ]),
    bulwark: blueprint('rammer', {
        maxHp: 320,
        radiusTiles: 2.4,
        speed: 75,
        turnRate: 1.6,
        engagementDist: 110,
        detectionDist: 1200,
        damageMultiplier: 0.28
    }, [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: -1, y: -2, partId: 'custom_1768410456823', rotation: 0 },
        { x: -1, y: 1, partId: 'minigun', rotation: 0 },
        { x: -2, y: 0, partId: 'hull', rotation: 0 },
        { x: 2, y: 0, partId: 'hull', rotation: 0 },
        { x: -2, y: 1, partId: 'custom_1767997495375', rotation: 1 },
        { x: 2, y: 1, partId: 'custom_1767997495375', rotation: 1 }
    ])
};

export function getEnemyBlueprint(type) {
    const selected = EnemyBlueprints[type] || EnemyBlueprints.basic;
    return {
        ...selected,
        stats: { ...selected.stats },
        parts: selected.parts.map(part => ({ ...part }))
    };
}

export function validateEnemyBlueprints(
    blueprints = EnemyBlueprints,
    partsLibrary = PartsLibrary
) {
    for (const [id, definition] of Object.entries(blueprints)) {
        if (!definition || typeof definition.behavior !== 'string') {
            throw new Error(`enemy blueprint ${id} is missing behavior`);
        }
        if (
            !definition.stats ||
            !Array.isArray(definition.parts) ||
            definition.parts.length === 0 ||
            definition.parts.length > 64
        ) {
            throw new Error(`enemy blueprint ${id} is incomplete`);
        }
        const positiveStats = [
            'maxHp',
            'radiusTiles',
            'speed',
            'turnRate',
            'engagementDist',
            'detectionDist'
        ];
        if (
            !positiveStats.every(key =>
                Number.isFinite(definition.stats[key]) &&
                definition.stats[key] > 0
            ) ||
            !Number.isFinite(definition.stats.damageMultiplier) ||
            definition.stats.damageMultiplier < 0
        ) {
            throw new Error(`enemy blueprint ${id} has invalid tuning`);
        }
        for (const part of definition.parts) {
            if (!Object.hasOwn(partsLibrary, part.partId)) {
                throw new Error(`enemy blueprint ${id} uses unknown part ${part.partId}`);
            }
            if (![part.x, part.y, part.rotation].every(Number.isInteger)) {
                throw new Error(`enemy blueprint ${id} has invalid part geometry`);
            }
        }
    }
    return true;
}

validateEnemyBlueprints();
