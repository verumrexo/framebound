export const PROJECTILE_LOOK_PRESETS = Object.freeze([
    Object.freeze({ id: 'default', label: 'game default' }),
    Object.freeze({ id: 'tracer', label: 'tracer' }),
    Object.freeze({ id: 'heavy-slug', label: 'heavy slug' }),
    Object.freeze({ id: 'plasma-bolt', label: 'plasma bolt' }),
    Object.freeze({ id: 'missile', label: 'missile' }),
    Object.freeze({ id: 'needle', label: 'needle' })
]);

export const PROJECTILE_TRAIL_PRESETS = Object.freeze([
    Object.freeze({ id: 'default', label: 'game default' }),
    Object.freeze({ id: 'none', label: 'none' }),
    Object.freeze({ id: 'sparks', label: 'sparks' }),
    Object.freeze({ id: 'smoke', label: 'smoke' }),
    Object.freeze({ id: 'ion', label: 'ion' })
]);

export const DEFAULT_PROJECTILE_LOOK = 'default';
export const DEFAULT_PROJECTILE_TRAIL = 'default';

const PROJECTILE_LOOK_IDS = new Set(PROJECTILE_LOOK_PRESETS.map(preset => preset.id));
const PROJECTILE_TRAIL_IDS = new Set(PROJECTILE_TRAIL_PRESETS.map(preset => preset.id));

export function isProjectileLook(value) {
    return PROJECTILE_LOOK_IDS.has(value);
}

export function isProjectileTrail(value) {
    return PROJECTILE_TRAIL_IDS.has(value);
}

export function normalizeProjectileLook(value) {
    if (value === undefined || value === null) return DEFAULT_PROJECTILE_LOOK;
    if (!isProjectileLook(value)) throw new Error(`invalid projectile look preset: ${value}`);
    return value;
}

export function normalizeProjectileTrail(value) {
    if (value === undefined || value === null) return DEFAULT_PROJECTILE_TRAIL;
    if (!isProjectileTrail(value)) throw new Error(`invalid projectile trail preset: ${value}`);
    return value;
}

export function normalizeProjectileVisuals({ look, trail } = {}) {
    return {
        look: normalizeProjectileLook(look),
        trail: normalizeProjectileTrail(trail)
    };
}
