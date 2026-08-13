export class EnemyLabNativeBridge {
    constructor(invoke = globalThis.__TAURI__?.core?.invoke ?? null) {
        this.invoke = invoke;
    }

    get available() {
        return typeof this.invoke === 'function';
    }

    async promote(raw) {
        if (!this.available) throw new Error('source promotion requires the enemy lab desktop app');
        return this.invoke('promote_enemy_lab_manifest', { raw });
    }
}

export function downloadEnemyLabManifest(raw, documentRef = globalThis.document) {
    if (!documentRef || typeof globalThis.URL?.createObjectURL !== 'function') return false;
    const link = documentRef.createElement('a');
    const url = globalThis.URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    link.href = url;
    link.download = 'enemy-lab-overrides.json';
    link.click();
    globalThis.URL.revokeObjectURL(url);
    return true;
}
