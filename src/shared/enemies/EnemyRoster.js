export function selectEnemyType(floor, roll, {
    vault = false,
    large = false
} = {}) {
    if (vault && floor >= 5 && roll < 0.08) return 'hive_carrier';

    const offset = vault ? 0.08 : 0;
    if (floor >= 5) {
        if (roll < offset + 0.10) return 'repair_tender';
        if (roll < offset + (large ? 0.24 : 0.20)) return 'bulwark';
        if (roll < offset + 0.32) return 'rocketeer';
        if (roll < offset + 0.44) return 'sniper';
        if (roll < offset + 0.57) return 'interceptor';
        if (roll < offset + 0.70) return 'circler';
        if (roll < 0.90) return 'striker';
        return 'basic';
    }
    if (floor >= 4) {
        if (roll < 0.08) return 'repair_tender';
        if (roll < (large ? 0.22 : 0.16)) return 'bulwark';
        if (roll < 0.30) return 'rocketeer';
        if (roll < 0.43) return 'sniper';
        if (roll < 0.57) return 'interceptor';
        if (roll < 0.69) return 'circler';
        if (roll < 0.88) return 'striker';
        return 'basic';
    }
    if (floor >= 3) {
        if (roll < (large ? 0.14 : 0.09)) return 'bulwark';
        if (roll < 0.24) return 'sniper';
        if (roll < 0.39) return 'interceptor';
        if (roll < 0.54) return 'circler';
        if (roll < 0.80) return 'striker';
        return 'basic';
    }
    if (floor >= 2) {
        if (roll < 0.18) return 'interceptor';
        if (roll < 0.36) return 'circler';
        if (roll < 0.68) return 'striker';
        return 'basic';
    }
    return roll < 0.5 ? 'striker' : 'basic';
}
