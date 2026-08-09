import { getPackagedSoundManifest } from '../audio/SoundEventRegistry.js';

export const GAME_SOUNDS = Object.freeze(getPackagedSoundManifest());

export async function loadGameSounds(audio) {
    for (const sound of GAME_SOUNDS) {
        await audio.load(sound.name, sound.url);
    }
}

export function hasLoadedSound(audio, name) {
    if (!audio?.sounds) return false;
    if (audio.sounds instanceof Map) return audio.sounds.has(name);
    return Boolean(audio.sounds[name]);
}
