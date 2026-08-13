import { EnemyBlueprints } from './EnemyBlueprints.js';

export function getEligibleEnemies(floor, {
    role = 'standard',
    vault = false,
    blueprints = EnemyBlueprints
} = {}) {
    const level = Number.isFinite(Number(floor)) ? Math.max(1, Math.round(Number(floor))) : 1;
    return Object.values(blueprints).filter(entry => {
        if (!entry.combatReady || entry.spawnWeight <= 0) return false;
        if (level < entry.floor.min || level > entry.floor.max) return false;
        if (role === 'boss') return entry.encounterRole === 'boss';
        if (role === 'miniboss') return entry.encounterRole === 'miniboss';
        if (vault) return entry.encounterRole !== 'boss';
        return entry.encounterRole === 'standard';
    });
}

export function selectEnemyType(floor, roll, options = {}) {
    const eligible = getEligibleEnemies(floor, options);
    if (eligible.length === 0) return null;
    const total = eligible.reduce((sum, entry) => sum + entry.spawnWeight, 0);
    let cursor = Math.min(0.999999999, Math.max(0, Number(roll) || 0)) * total;
    for (const entry of eligible) {
        cursor -= entry.spawnWeight;
        if (cursor < 0) return entry.id;
    }
    return eligible.at(-1)?.id || null;
}
