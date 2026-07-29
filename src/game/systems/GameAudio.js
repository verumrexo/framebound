export const GAME_SOUNDS = [
    // Music
    { name: 'bgm', url: './sounds/bgm.mp3' },

    // Weapons (per-part)
    { name: 'shoot_dart', url: './sounds/dart.wav' },
    { name: 'shoot_scattr', url: './sounds/scattr.wav' },
    { name: 'shoot_lps', url: './sounds/lps.wav' },
    { name: 'shoot_ggbm', url: './sounds/ggbm.wav' },
    { name: 'shoot_rocketle', url: './sounds/rocketle.wav' },
    { name: 'shoot_minigun', url: './sounds/minigun.wav' },
    { name: 'shoot_lsr', url: './sounds/lsr.wav' },
    { name: 'shoot_rocket_he', url: './sounds/rocket_he.wav' },
    { name: 'shoot_sniper', url: './sounds/sniper.wav' },
    { name: 'rail_charge', url: './sounds/rail_charge.wav' },
    { name: 'rail', url: './sounds/rail.wav' },
    { name: 'rail_shot', url: './sounds/rail_shot.wav' },

    // Combat
    { name: 'hit', url: './sounds/hit.wav' },
    { name: 'explosion', url: './sounds/explosion.wav' },
    { name: 'shield_hit', url: './sounds/shield_hit.wav' },
    { name: 'dash', url: './sounds/dash.wav' },
    { name: 'enemy_death1', url: './sounds/enemy_death1.wav' },
    { name: 'enemy_death2', url: './sounds/enemy_death2.wav' },
    { name: 'frame_death', url: './sounds/frame_death.wav' },

    // Pickups
    { name: 'xp_pickup', url: './sounds/xp_pickup.wav' },
    { name: 'gold_pickup', url: './sounds/gold_pickup.wav' },
    { name: 'item_pickup', url: './sounds/item_pickup.wav' },
    { name: 'crate_break', url: './sounds/crate_break.wav' },
    { name: 'asteroid_break', url: './sounds/asteroid_break.wav' }
];

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
