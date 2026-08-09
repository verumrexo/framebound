export const SOUND_EVENT_REGISTRY_VERSION = 1;

const event = (id, category, label, defaultAsset = null, policy = {}) => Object.freeze({
    id,
    category,
    label,
    defaultAsset,
    policy: Object.freeze({ ...policy })
});

export const SOUND_EVENTS = Object.freeze([
    event('bgm', 'music', 'background music', './sounds/bgm.mp3', { type: 'music', loop: true }),

    event('shoot_dart', 'weapons', 'dart fire', './sounds/dart.wav'),
    event('shoot_scattr', 'weapons', 'scattr fire', './sounds/scattr.wav'),
    event('shoot_lps', 'weapons', 'lps fire', './sounds/lps.wav'),
    event('shoot_ggbm', 'weapons', 'ggbm fire', './sounds/ggbm.wav'),
    event('shoot_rocketle', 'weapons', 'rocketle fire', './sounds/rocketle.wav'),
    event('shoot_minigun', 'weapons', 'minigun fire', './sounds/minigun.wav', { isSpammy: true }),
    event('shoot_lsr', 'weapons', 'lsr fire', './sounds/lsr.wav', { isSpammy: true }),
    event('shoot_rocket_he', 'weapons', 'rocket he fire', './sounds/rocket_he.wav'),
    event('shoot_sniper', 'weapons', 'sniper fire', './sounds/sniper.wav'),
    event('rail_charge', 'weapons', 'rail charge', './sounds/rail_charge.wav', { isSpammy: true }),
    event('rail', 'weapons', 'rail sweep', './sounds/rail.wav', { isSpammy: true }),
    event('rail_shot', 'weapons', 'rail shot', './sounds/rail_shot.wav', { isSpammy: true }),

    event('hit', 'combat', 'projectile hit', './sounds/hit.wav'),
    event('explosion', 'combat', 'explosion', './sounds/explosion.wav'),
    event('shield_hit', 'combat', 'shield hit', './sounds/shield_hit.wav'),
    event('dash', 'player', 'dash', './sounds/dash.wav'),
    event('enemy_death1', 'enemies', 'enemy death a', './sounds/enemy_death1.wav'),
    event('enemy_death2', 'enemies', 'enemy death b', './sounds/enemy_death2.wav'),
    event('frame_death', 'player', 'frame death', './sounds/frame_death.wav'),

    event('xp_pickup', 'rewards', 'xp pickup', './sounds/xp_pickup.wav'),
    event('gold_pickup', 'rewards', 'gold pickup', './sounds/gold_pickup.wav'),
    event('item_pickup', 'rewards', 'part pickup', './sounds/item_pickup.wav'),
    event('crate_break', 'environment', 'crate break', './sounds/crate_break.wav'),
    event('asteroid_break', 'environment', 'asteroid break', './sounds/asteroid_break.wav'),

    event('nova', 'weapons', 'nova explosion', './sounds/nova.wav'),
    event('room_enter', 'rooms', 'room enter', './sounds/room_enter.wav'),
    event('room_unlock', 'rooms', 'room unlock', './sounds/room_unlock.wav'),
    event('wave_start', 'rooms', 'wave start', './sounds/wave_start.wav'),
    event('vault_offer', 'vault', 'vault offer reveal', './sounds/vault_offer.wav'),
    event('vault_gilded_commit', 'vault', 'gilded payment', './sounds/vault_gilded_commit.wav'),
    event('vault_blood_commit', 'vault', 'blood payment', './sounds/vault_blood_commit.wav'),
    event('vault_seal', 'vault', 'contract seal', './sounds/vault_seal.wav'),
    event('vault_surge', 'vault', 'containment surge', './sounds/vault_surge.wav'),
    event('vault_unlock', 'vault', 'reliquary unlock', './sounds/vault_unlock.wav'),
    event('vault_claim', 'vault', 'vault cache claim', './sounds/vault_claim.wav'),

    event('overheat', 'weapons', 'weapon overheat'),
    event('reload', 'utilities', 'utility ready'),
    event('respawn', 'player', 'respawn'),
    event('click_short', 'ui', 'ui confirm')
]);

export const SOUND_EVENT_BY_ID = new Map(SOUND_EVENTS.map(entry => [entry.id, entry]));

export const PART_FIRE_DEFAULTS = Object.freeze({
    gun_basic: 'shoot_dart',
    scattr: 'shoot_scattr',
    lps: 'shoot_lps',
    ggbm: 'shoot_ggbm',
    rocketle: 'shoot_rocketle',
    minigun: 'shoot_minigun',
    custom_1767999386292: 'shoot_lsr',
    custom_1768036702131: 'shoot_rocket_he',
    custom_1768397007593: 'rail_shot',
    custom_1768857172136: 'shoot_sniper',
    custom_1769204337665: 'shoot_dart',
    custom_1769336961268: 'shoot_lsr',
    custom_1769514097773: 'nova',
    railgun: 'rail_shot'
});

export function getPartFireDefault(partId) {
    return PART_FIRE_DEFAULTS[partId] || 'hit';
}

export function getPartSoundSlots(part) {
    if (!part?.id || !part?.type) return [];
    if (part.type === 'weapon') {
        const slots = [
            { id: 'fire', fallback: getPartFireDefault(part.id) },
            { id: 'impact', fallback: 'hit' }
        ];
        if (part.stats?.chargeTime) {
            slots.push(
                { id: 'charge', fallback: 'rail_charge' },
                { id: 'release', fallback: 'rail' }
            );
        }
        if (part.stats?.weaponGroup === 'rocket') {
            slots.push({ id: 'detonate', fallback: 'explosion' });
        }
        return slots;
    }
    if (part.type === 'drone') {
        return [
            { id: 'deploy', fallback: 'reload' },
            { id: 'attack', fallback: 'shoot_dart' },
            { id: 'impact', fallback: 'hit' }
        ];
    }
    if (part.type === 'shield') return [{ id: 'hit', fallback: 'shield_hit' }];
    if (part.type === 'booster') return [{ id: 'dash', fallback: 'dash' }];
    return [];
}

export function getSoundEvent(eventId) {
    return SOUND_EVENT_BY_ID.get(eventId) || null;
}

export function getPackagedSoundManifest() {
    return SOUND_EVENTS
        .filter(entry => entry.defaultAsset)
        .map(entry => ({ name: entry.id, url: entry.defaultAsset }));
}

export function auditSoundEvents(requestedIds = []) {
    const requested = new Set(requestedIds);
    const known = new Set(SOUND_EVENTS.map(entry => entry.id));
    return {
        missing: [...requested].filter(id => !known.has(id)).sort(),
        withoutPackagedDefault: SOUND_EVENTS
            .filter(entry => !entry.defaultAsset)
            .map(entry => entry.id)
            .sort(),
        unusedPackaged: SOUND_EVENTS
            .filter(entry => entry.defaultAsset && !requested.has(entry.id))
            .map(entry => entry.id)
            .sort()
    };
}
export {
    globalSoundEventKey,
    partSoundEventKey
} from '../../shared/audio/SoundEventKeys.js';
