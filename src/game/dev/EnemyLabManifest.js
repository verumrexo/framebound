import {
    applyEnemyBlueprintManifest,
    BASE_ENEMY_BLUEPRINTS,
    normalizeEnemyBlueprint
} from '../../shared/enemies/EnemyBlueprints.js';

export const ENEMY_LAB_SCHEMA_VERSION = 1;
export const ENEMY_LAB_MANIFEST_PATH = './generated-enemies/enemy-lab-overrides.json';
export const MAX_ENEMY_LAB_BYTES = 1024 * 1024;

export function normalizeEnemyLabManifest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('enemy lab file must be an object');
    if (value.schemaVersion !== ENEMY_LAB_SCHEMA_VERSION) throw new Error('unsupported enemy lab file');
    if (!Number.isInteger(value.version) || value.version < 1) throw new Error('invalid enemy lab version');
    if (typeof value.modifiedAt !== 'string' || !Number.isFinite(Date.parse(value.modifiedAt))) throw new Error('invalid enemy lab timestamp');
    const enemies = Array.isArray(value.enemies) ? value.enemies : [];
    if (enemies.length !== 30) throw new Error('enemy lab must contain all 30 ships');
    const seen = new Set();
    const normalized = enemies.map(entry => {
        const enemy = normalizeEnemyBlueprint(entry);
        if (!Object.hasOwn(BASE_ENEMY_BLUEPRINTS, enemy.id) || seen.has(enemy.id)) throw new Error('enemy lab contains an unknown or duplicate ship');
        seen.add(enemy.id);
        return enemy;
    });
    return { schemaVersion: ENEMY_LAB_SCHEMA_VERSION, version: value.version, modifiedAt: value.modifiedAt, enemies: normalized };
}

export function buildEnemyLabManifest(enemies, now = new Date().toISOString()) {
    return normalizeEnemyLabManifest({
        schemaVersion: ENEMY_LAB_SCHEMA_VERSION,
        version: 1,
        modifiedAt: now,
        enemies: Object.values(enemies)
    });
}

export function parseEnemyLabManifest(raw) {
    if (typeof raw !== 'string' || raw.length > MAX_ENEMY_LAB_BYTES) throw new Error('invalid enemy lab file');
    try {
        return normalizeEnemyLabManifest(JSON.parse(raw));
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error('enemy lab file must be valid json');
        throw error;
    }
}

export function serializeEnemyLabManifest(manifest) {
    return JSON.stringify(normalizeEnemyLabManifest(manifest), null, 2);
}

export async function loadPromotedEnemyLabManifest(fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== 'function') return null;
    try {
        const response = await fetchImpl(ENEMY_LAB_MANIFEST_PATH, { cache: 'no-store' });
        if (!response.ok) return null;
        return parseEnemyLabManifest(await response.text());
    } catch {
        return null;
    }
}

export function applyPromotedEnemyLabManifest(manifest) {
    return applyEnemyBlueprintManifest(manifest);
}
