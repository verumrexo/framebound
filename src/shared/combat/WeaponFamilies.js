export const WEAPON_FAMILIES = Object.freeze({
    velocity: Object.freeze({
        id: 'velocity',
        label: 'ballistic',
        rateStat: 'velocityRateAdd',
        damageStat: 'velocityDamageMul',
        color: '#74ff6a'
    }),
    laser: Object.freeze({
        id: 'laser',
        label: 'laser',
        rateStat: 'laserRateAdd',
        damageStat: 'laserDamageMul',
        color: '#35f2ff'
    }),
    rocket: Object.freeze({
        id: 'rocket',
        label: 'missile',
        rateStat: 'rocketRateAdd',
        damageStat: 'rocketDamageMul',
        color: '#ff8a3d'
    })
});

export const WEAPON_FAMILY_IDS = Object.freeze(Object.keys(WEAPON_FAMILIES));

export const PERMANENT_STAT_DEFAULTS = Object.freeze({
    hpMul: 1,
    regenAdd: 0,
    velocityRateAdd: 0,
    laserRateAdd: 0,
    rocketRateAdd: 0,
    speedMul: 1,
    turnMul: 1,
    missileSpeedMul: 1,
    velocityDamageMul: 1,
    laserDamageMul: 1,
    rocketDamageMul: 1,
    velocityPierce: 0,
    laserChain: 0,
    rocketBlastMul: 1
});

export const PERMANENT_STAT_KEYS = Object.freeze(
    Object.keys(PERMANENT_STAT_DEFAULTS)
);

export function createPermanentStats() {
    return { ...PERMANENT_STAT_DEFAULTS };
}

export function normalizePermanentStats(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
    const normalized = createPermanentStats();
    for (const key of PERMANENT_STAT_KEYS) {
        if (Number.isFinite(source[key]) && source[key] >= 0 && source[key] <= 1000) {
            normalized[key] = source[key];
        }
    }
    return normalized;
}

export function isValidPermanentStats(value, { allowLegacy = false } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (!Object.keys(value).every(key => PERMANENT_STAT_KEYS.includes(key))) return false;
    const required = allowLegacy
        ? [
            'hpMul',
            'regenAdd',
            'velocityRateAdd',
            'laserRateAdd',
            'speedMul',
            'turnMul',
            'missileSpeedMul'
        ]
        : PERMANENT_STAT_KEYS;
    return required.every(key => (
        Number.isFinite(value[key]) &&
        value[key] >= 0 &&
        value[key] <= 1000
    ));
}

export function getInstalledWeaponFamilies(ship, partsLibrary) {
    const counts = Object.fromEntries(WEAPON_FAMILY_IDS.map(id => [id, 0]));
    if (!ship?.getUniqueParts) return counts;
    for (const part of ship.getUniqueParts()) {
        const family = partsLibrary[part.partId]?.stats?.weaponGroup;
        if (Object.hasOwn(counts, family)) counts[family]++;
    }
    return counts;
}

export function getFamilyFireRateMultiplier(ship, familyId) {
    const family = WEAPON_FAMILIES[familyId];
    if (!family) return 1;
    return 1 + Math.max(0, ship?.permanentStats?.[family.rateStat] || 0);
}

export function getFamilyDamageMultiplier(ship, familyId) {
    const family = WEAPON_FAMILIES[familyId];
    if (!family) return 1;
    return Math.max(0, ship?.permanentStats?.[family.damageStat] || 1);
}
