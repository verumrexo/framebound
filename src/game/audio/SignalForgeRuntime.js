import {
    SIGNAL_FORGE_SCHEMA_VERSION,
    SignalForgeStore
} from './SignalForgeStore.js';
import {
    newestSignalForgePack,
    loadPromotedSignalForgePack,
    parseSignalForgePack,
    serializeSignalForgePack
} from './SignalForgePack.js';
import { SignalForgeNativeBridge } from './SignalForgeNativeBridge.js';

function slugify(value) {
    const slug = String(value || 'sound')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return slug || 'sound';
}

function randomSuffix() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().slice(0, 8);
    return Math.random().toString(36).slice(2, 10);
}

export class SignalForgeRuntime {
    constructor(audio, {
        store = new SignalForgeStore(),
        nativeBridge = new SignalForgeNativeBridge()
    } = {}) {
        this.audio = audio;
        this.store = store;
        this.nativeBridge = nativeBridge;
        this.sounds = new Map();
        this.bindings = new Map();
        this.ready = false;
        this.error = null;
        this.modifiedAt = null;
    }

    async initialize() {
        try {
            await loadPromotedSignalForgePack(this.audio);
            const browserPack = await this.store.loadPack();
            const nativePacks = [];
            for (const raw of await this.nativeBridge.loadCandidates()) {
                try {
                    nativePacks.push(parseSignalForgePack(raw));
                } catch (error) {
                    console.warn('[Signal Forge] Ignoring corrupt native sound pack:', error);
                }
            }
            const candidates = [browserPack, ...nativePacks]
                .filter(pack => Number.isFinite(Date.parse(pack.modifiedAt)));
            const pack = newestSignalForgePack(candidates) || browserPack;
            if (pack !== browserPack) await this.store.replacePack(pack);
            this.modifiedAt = pack.modifiedAt;
            for (const record of pack.sounds) {
                const audioBuffer = await this.audio.decodeAudioBytes(record.wavBytes);
                this.audio.replace(this.audioName(record.id), audioBuffer);
                this.sounds.set(record.id, record);
            }
            for (const binding of pack.bindings) {
                if (this.audio.bindEvent(binding.eventKey, this.audioName(binding.soundId))) {
                    this.bindings.set(binding.eventKey, binding.soundId);
                }
            }
            if (pack.sounds.length || pack.bindings.length) await this.mirrorNative();
        } catch (error) {
            this.error = error;
            console.warn('[Signal Forge] Persistent sound pack is unavailable:', error);
        } finally {
            this.ready = true;
        }
        return this;
    }

    audioName(soundId) {
        return `forge:${soundId}`;
    }

    createAudioBuffer(rendered) {
        const buffer = this.audio.context.createBuffer(1, rendered.samples.length, rendered.sampleRate);
        buffer.getChannelData(0).set(rendered.samples);
        return buffer;
    }

    async saveRendered({ name, recipe, rendered, id = null }) {
        const now = new Date().toISOString();
        const soundId = id || `${slugify(name)}-${randomSuffix()}`;
        const previous = this.sounds.get(soundId);
        const record = {
            id: soundId,
            schemaVersion: SIGNAL_FORGE_SCHEMA_VERSION,
            jfxrVersion: rendered.jfxrVersion,
            name: String(name || 'untitled').toLowerCase().slice(0, 64),
            recipe,
            wavBytes: rendered.wavBytes,
            sampleRate: rendered.sampleRate,
            channels: 1,
            duration: rendered.duration,
            peak: rendered.peak,
            createdAt: previous?.createdAt || now,
            modifiedAt: now
        };
        await this.store.putSound(record);
        this.audio.replace(this.audioName(soundId), this.createAudioBuffer(rendered));
        this.sounds.set(soundId, record);
        this.modifiedAt = record.modifiedAt;
        await this.mirrorNative();
        return record;
    }

    async bind(eventKey, soundId) {
        if (!this.sounds.has(soundId)) throw new Error(`unknown forged sound: ${soundId}`);
        const binding = { eventKey, soundId, modifiedAt: new Date().toISOString() };
        await this.store.putBinding(binding);
        if (!this.audio.bindEvent(eventKey, this.audioName(soundId))) {
            throw new Error(`failed to bind ${eventKey}`);
        }
        this.bindings.set(eventKey, soundId);
        this.modifiedAt = binding.modifiedAt;
        await this.mirrorNative();
        return binding;
    }

    async unbind(eventKey) {
        await this.store.deleteBinding(eventKey);
        this.audio.unbindEvent(eventKey);
        this.bindings.delete(eventKey);
        this.modifiedAt = new Date().toISOString();
        await this.mirrorNative();
    }

    async deleteSound(soundId) {
        if (!this.sounds.has(soundId)) return false;
        const eventKeys = [...this.bindings.entries()]
            .filter(([, boundSoundId]) => boundSoundId === soundId)
            .map(([eventKey]) => eventKey);
        for (const eventKey of eventKeys) await this.unbind(eventKey);
        await this.store.deleteSound(soundId);
        this.audio.remove(this.audioName(soundId));
        this.sounds.delete(soundId);
        this.modifiedAt = new Date().toISOString();
        await this.mirrorNative();
        return true;
    }

    getBinding(eventKey) {
        return this.bindings.get(eventKey) || null;
    }

    inspectEvent(eventKey, fallbackName) {
        const soundId = this.getBinding(eventKey);
        const customName = soundId ? this.audioName(soundId) : null;
        if (soundId && this.sounds.has(soundId) && this.audio.hasSound(customName)) {
            return {
                status: 'custom',
                eventKey,
                fallbackName,
                soundId,
                soundName: customName,
                label: this.sounds.get(soundId).name
            };
        }
        if (this.audio.hasSound(fallbackName)) {
            return {
                status: 'default',
                eventKey,
                fallbackName,
                soundId: null,
                soundName: fallbackName,
                label: fallbackName.replaceAll('_', ' ')
            };
        }
        return {
            status: 'missing',
            eventKey,
            fallbackName,
            soundId: null,
            soundName: null,
            label: 'no sound assigned'
        };
    }

    previewEvent(eventKey, fallbackName, options = {}) {
        const state = this.inspectEvent(eventKey, fallbackName);
        if (!state.soundName) return false;
        return Boolean(this.audio.previewSound(state.soundName, options));
    }

    previewSaved(soundId, options = {}) {
        if (!this.sounds.has(soundId)) return false;
        return Boolean(this.audio.previewSound(this.audioName(soundId), options));
    }

    async mirrorNative() {
        if (!this.nativeBridge.available) return false;
        const raw = serializeSignalForgePack({
            sounds: this.sounds.values(),
            bindings: [...this.bindings].map(([eventKey, soundId]) => ({ eventKey, soundId })),
            modifiedAt: this.modifiedAt || new Date().toISOString()
        });
        try {
            return await this.nativeBridge.write(raw);
        } catch (error) {
            console.warn('[Signal Forge] Failed to mirror native sound pack:', error);
            return false;
        }
    }

    async promote() {
        const raw = serializeSignalForgePack({
            sounds: this.sounds.values(),
            bindings: [...this.bindings].map(([eventKey, soundId]) => ({ eventKey, soundId })),
            modifiedAt: this.modifiedAt || new Date().toISOString()
        });
        return this.nativeBridge.promote(raw);
    }
}
