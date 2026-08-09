import {
    MAX_FORGE_PACK_BYTES,
    validateForgeBinding,
    validateForgeSound
} from './SignalForgeStore.js';

export const SIGNAL_FORGE_PACK_VERSION = 1;

function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function base64ToBytes(encoded) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

export function serializeSignalForgePack({ sounds, bindings, modifiedAt }) {
    const payload = {
        version: SIGNAL_FORGE_PACK_VERSION,
        modifiedAt,
        sounds: [...sounds]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(sound => ({ ...sound, wavBase64: bytesToBase64(sound.wavBytes), wavBytes: undefined })),
        bindings: [...bindings].sort((a, b) => a.eventKey.localeCompare(b.eventKey))
    };
    return JSON.stringify(payload);
}

export function parseSignalForgePack(raw) {
    if (typeof raw !== 'string' || raw.length > 48 * 1024 * 1024) throw new Error('invalid native sound pack');
    const payload = JSON.parse(raw);
    if (payload.version !== SIGNAL_FORGE_PACK_VERSION) throw new Error('unsupported sound pack version');
    if (!Number.isFinite(Date.parse(payload.modifiedAt))) throw new Error('invalid sound pack timestamp');
    if (!Array.isArray(payload.sounds) || !Array.isArray(payload.bindings)) throw new Error('invalid sound pack collections');

    let totalBytes = 0;
    const sounds = payload.sounds.map(entry => {
        const { wavBase64, ...record } = entry;
        if (typeof wavBase64 !== 'string') throw new Error('missing sound data');
        record.wavBytes = base64ToBytes(wavBase64);
        totalBytes += record.wavBytes.byteLength;
        return validateForgeSound(record);
    });
    if (totalBytes > MAX_FORGE_PACK_BYTES) throw new Error('sound pack is too large');
    const soundIds = new Set(sounds.map(sound => sound.id));
    const bindings = payload.bindings.map(validateForgeBinding);
    if (bindings.some(binding => !soundIds.has(binding.soundId))) {
        throw new Error('sound pack contains a dangling binding');
    }
    return { sounds, bindings, modifiedAt: payload.modifiedAt };
}

export function newestSignalForgePack(packs) {
    return [...packs].sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))[0] || null;
}

export async function loadPromotedSignalForgePack(
    audio,
    fetchImpl = globalThis.fetch
) {
    if (typeof fetchImpl !== 'function') return null;
    let response;
    try {
        response = await fetchImpl('./generated-sounds/sound-pack.json');
    } catch {
        return null;
    }
    if (!response.ok) return null;
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.toLowerCase().includes('text/html')) return null;
    const manifest = await response.json();
    if (manifest?.version !== SIGNAL_FORGE_PACK_VERSION || !Array.isArray(manifest.sounds) || !Array.isArray(manifest.bindings)) {
        throw new Error('invalid promoted sound pack');
    }
    const soundIds = new Set();
    for (const sound of manifest.sounds) {
        if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(sound.id || '')) throw new Error('invalid promoted sound id');
        if (typeof sound.asset !== 'string' || !/^\.\/generated-sounds\/[a-z0-9-]+\.wav$/.test(sound.asset)) {
            throw new Error('invalid promoted sound asset');
        }
        soundIds.add(sound.id);
        await audio.load(`forge:${sound.id}`, sound.asset, { preserveDefault: false });
    }
    for (const binding of manifest.bindings) {
        validateForgeBinding(binding);
        if (!soundIds.has(binding.soundId)) throw new Error('promoted sound pack contains a dangling binding');
        audio.bindEvent(binding.eventKey, `forge:${binding.soundId}`);
    }
    return manifest;
}
