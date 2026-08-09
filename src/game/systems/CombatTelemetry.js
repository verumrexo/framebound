export class CombatTelemetry {
    constructor() {
        this.reset();
    }

    reset() {
        this.byPlayer = new Map();
    }

    record(amount, source = {}) {
        if (!Number.isFinite(amount) || amount <= 0 || source.isPlayer) return;
        const playerId = source.playerId || 'host';
        const sourceKey = source.partKey || source.partId || source.family || 'unknown';
        let entries = this.byPlayer.get(playerId);
        if (!entries) {
            entries = new Map();
            this.byPlayer.set(playerId, entries);
        }
        const current = entries.get(sourceKey) || {
            key: sourceKey,
            partId: source.partId || 'unknown',
            label: source.partName || source.partId || source.family || 'untracked',
            family: source.family || 'unknown',
            damage: 0
        };
        current.damage += amount;
        entries.set(sourceKey, current);
    }

    entriesFor(playerId = 'host') {
        return [...(this.byPlayer.get(playerId)?.values() || [])]
            .sort((a, b) => b.damage - a.damage);
    }

    snapshotFor(playerId = 'host') {
        return this.entriesFor(playerId).map(entry => ({ ...entry }));
    }

    replaceFor(playerId, entries) {
        const normalized = new Map();
        for (const entry of entries || []) {
            if (!validEntry(entry)) continue;
            normalized.set(entry.key, { ...entry });
        }
        this.byPlayer.set(playerId, normalized);
    }
}

function validEntry(entry) {
    return entry &&
        typeof entry.key === 'string' &&
        typeof entry.partId === 'string' &&
        typeof entry.label === 'string' &&
        typeof entry.family === 'string' &&
        Number.isFinite(entry.damage) &&
        entry.damage >= 0;
}

export function damageSourceFromProjectile(projectile) {
    return {
        playerId: projectile.sourcePlayerId || 'host',
        partKey: projectile.sourcePartKey,
        partId: projectile.sourcePartId,
        partName: projectile.sourcePartName,
        family: projectile.weaponFamily
    };
}
