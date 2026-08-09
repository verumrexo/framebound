export class SignalForgeNativeBridge {
    constructor(invoke = globalThis.__TAURI__?.core?.invoke ?? null) {
        this.invoke = invoke;
    }

    get available() {
        return typeof this.invoke === 'function';
    }

    async loadCandidates() {
        if (!this.available) return [];
        const candidates = await this.invoke('load_signal_forge_pack');
        return Array.isArray(candidates) ? candidates.filter(value => typeof value === 'string') : [];
    }

    async write(raw) {
        if (!this.available) return false;
        await this.invoke('write_signal_forge_pack', { raw });
        return true;
    }

    async promote(raw) {
        if (!this.available) throw new Error('promotion requires the desktop development build');
        return this.invoke('promote_signal_forge_pack', { raw });
    }
}
