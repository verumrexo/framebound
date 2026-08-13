import { BASE_ENEMY_BLUEPRINTS, normalizeEnemyBlueprint } from '../../shared/enemies/EnemyBlueprints.js';

export const ENEMY_LAB_DRAFT_KEY = 'framebound.enemy-lab.drafts.v1';

export class EnemyLabDraftStore {
    constructor(storage = globalThis.localStorage) {
        this.storage = storage;
        this.enemies = structuredClone(BASE_ENEMY_BLUEPRINTS);
        this.saved = new Map(Object.keys(this.enemies).map(id => [id, JSON.stringify(this.enemies[id])]));
        this.load();
    }

    load() {
        try {
            const raw = this.storage?.getItem?.(ENEMY_LAB_DRAFT_KEY);
            if (!raw) return this.enemies;
            const value = JSON.parse(raw);
            for (const entry of value.enemies || []) {
                if (Object.hasOwn(this.enemies, entry.id)) this.enemies[entry.id] = normalizeEnemyBlueprint(entry);
            }
            this.saved = new Map(Object.keys(this.enemies).map(id => [id, JSON.stringify(this.enemies[id])]));
        } catch (error) {
            console.warn('[EnemyLab] ignored invalid local drafts:', error);
        }
        return this.enemies;
    }

    get(id) {
        return this.enemies[id] ? structuredClone(this.enemies[id]) : null;
    }

    set(entry) {
        const normalized = normalizeEnemyBlueprint(entry);
        if (!Object.hasOwn(this.enemies, normalized.id)) throw new Error('unknown enemy draft');
        this.enemies[normalized.id] = normalized;
        return this.get(normalized.id);
    }

    save(id) {
        if (id) this.saved.set(id, JSON.stringify(this.enemies[id]));
        this.storage?.setItem?.(ENEMY_LAB_DRAFT_KEY, JSON.stringify({ enemies: Object.values(this.enemies) }));
    }

    saveAll() {
        for (const id of Object.keys(this.enemies)) this.saved.set(id, JSON.stringify(this.enemies[id]));
        this.save();
    }

    isDirty(id) {
        return this.saved.get(id) !== JSON.stringify(this.enemies[id]);
    }

    reset(id) {
        this.enemies[id] = structuredClone(BASE_ENEMY_BLUEPRINTS[id]);
        return this.get(id);
    }
}
