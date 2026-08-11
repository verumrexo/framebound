import { PartType } from '../../shared/parts/PartDefinitions.js';
import {
    SOUND_EVENTS,
    getPartFireDefault,
    getSoundEvent,
    partSoundEventKey
} from '../audio/SoundEventRegistry.js';

export const PART_SOUND_DRAFT_SCHEMA_VERSION = 1;

const ACTIVE_ABILITY_SOUND_DEFAULTS = Object.freeze({
    blink: { activate: 'dash', effect: 'nova' },
    emp: { activate: 'reload', effect: 'nova' },
    decoy: { activate: 'reload', effect: 'hit' },
    stealth: { activate: 'dash', effect: 'hit' }
});

function hasAudioSound(audio, name) {
    if (!audio || !name) return false;
    if (typeof audio.hasSound === 'function') return Boolean(audio.hasSound(name));
    if (audio.sounds instanceof Map) return audio.sounds.has(name);
    return Boolean(audio.sounds?.[name]);
}

function savedAudioName(signalForge, soundId) {
    if (typeof signalForge?.audioName === 'function') return signalForge.audioName(soundId);
    return `forge:${soundId}`;
}

function activeUtility(part) {
    const stats = part?.stats || {};
    return part?.type === PartType.BOOSTER || (
        part?.type === PartType.UTILITY &&
        (typeof stats.activeAbility === 'string' || Number.isFinite(stats.abilityCooldown))
    );
}

function activeUtilityFallbacks(part) {
    const ability = String(part?.stats?.activeAbility || '').toLowerCase();
    return ACTIVE_ABILITY_SOUND_DEFAULTS[ability] || {
        activate: 'reload',
        effect: 'hit'
    };
}

function freezeSlots(slots) {
    return Object.freeze(slots.map(slot => Object.freeze({ ...slot })));
}

/**
 * Return the two semantic sound slots shown by Part Lab.
 *
 * `eventSlot` deliberately keeps compatibility with the runtime event names:
 * the human-facing weapon "hit" slot is currently the projectile "impact" key.
 *
 * @param {{ id: string, type: string, stats?: object }} part
 * @returns {ReadonlyArray<object>}
 */
export function getPartLabSoundSlots(part) {
    if (!part?.id || !part?.type) return [];

    if (part.type === PartType.WEAPON) {
        return freezeSlots([
            {
                id: 'fire',
                label: 'fire',
                eventSlot: 'fire',
                fallback: getPartFireDefault(part.id),
                optional: false
            },
            {
                id: 'hit',
                label: 'hit',
                eventSlot: 'impact',
                fallback: 'hit',
                optional: false
            }
        ]);
    }

    if (part.type === PartType.DRONE) {
        return freezeSlots([
            {
                id: 'deploy',
                label: 'deploy',
                eventSlot: 'deploy',
                fallback: 'reload',
                optional: false
            },
            {
                id: 'action',
                label: 'action',
                eventSlot: 'attack',
                fallback: 'shoot_dart',
                optional: false
            }
        ]);
    }

    if (activeUtility(part)) {
        const fallbacks = activeUtilityFallbacks(part);
        return freezeSlots([
            {
                id: 'activate',
                label: 'activate',
                eventSlot: 'activate',
                fallback: fallbacks.activate,
                optional: false
            },
            {
                id: 'effect',
                label: 'effect',
                eventSlot: 'effect',
                fallback: fallbacks.effect,
                optional: false
            }
        ]);
    }

    return freezeSlots([
        {
            id: 'attach',
            label: 'attach',
            eventSlot: 'attach',
            fallback: 'item_pickup',
            optional: true
        },
        {
            id: 'damage',
            label: 'damage',
            eventSlot: 'damage',
            fallback: 'hit',
            optional: true
        }
    ]);
}

function normalizeAssignment(assignment) {
    if (!assignment || typeof assignment !== 'object') return null;
    if (assignment.source === 'runtime' && typeof assignment.eventId === 'string') {
        return { source: 'runtime', eventId: assignment.eventId };
    }
    if (
        (assignment.source === 'signal-forge' || assignment.source === 'saved') &&
        typeof assignment.soundId === 'string'
    ) {
        return { source: 'signal-forge', soundId: assignment.soundId };
    }
    return null;
}

function readDraftAssignment(draft, slotId) {
    if (!draft) return null;
    if (Array.isArray(draft.slots)) {
        return draft.slots.find(slot => slot.id === slotId)?.assignment || null;
    }
    if (draft.slots) return draft.slots[slotId]?.assignment ?? draft.slots[slotId] ?? null;
    return draft[slotId] ?? null;
}

/**
 * Build the serializable draft consumed by the shared Part Lab.
 * No audio or source files are changed by this function.
 *
 * @param {{ id: string, name?: string, type: string, stats?: object }} part
 * @param {object|Map<string, object>} [assignments]
 * @returns {object}
 */
export function serializePartSoundDraft(part, assignments = {}) {
    const slots = getPartLabSoundSlots(part);
    return {
        schemaVersion: PART_SOUND_DRAFT_SCHEMA_VERSION,
        partId: part.id,
        partName: part.name || part.id,
        profile: getPartSoundProfile(part),
        slots: slots.map(slot => ({
            id: slot.id,
            label: slot.label,
            eventKey: partSoundEventKey(part.id, slot.eventSlot),
            fallback: slot.fallback,
            optional: slot.optional,
            assignment: normalizeAssignment(
                assignments instanceof Map
                    ? assignments.get(slot.id)
                    : readDraftAssignment(assignments, slot.id)
            )
        }))
    };
}

/**
 * Read current Signal Forge part bindings into a draft. Existing broken
 * bindings are retained so the UI can show them as missing instead of hiding
 * the problem.
 */
export function createPartSoundDraft(part, signalForge) {
    const assignments = {};
    for (const slot of getPartLabSoundSlots(part)) {
        const eventKey = partSoundEventKey(part.id, slot.eventSlot);
        const soundId = signalForge?.getBinding?.(eventKey) || signalForge?.bindings?.get?.(eventKey);
        if (soundId) assignments[slot.id] = { source: 'signal-forge', soundId };
    }
    return serializePartSoundDraft(part, assignments);
}

/**
 * Return a new draft with one staged assignment changed.
 */
export function withPartSoundAssignment(draft, slotId, assignment) {
    const slot = draft?.slots?.find?.(entry => entry.id === slotId);
    if (!slot) throw new Error(`unknown part sound slot: ${slotId}`);
    return {
        ...draft,
        slots: draft.slots.map(entry => entry.id === slotId
            ? { ...entry, assignment: normalizeAssignment(assignment) }
            : { ...entry, assignment: normalizeAssignment(entry.assignment) })
    };
}

export function getPartSoundProfile(part) {
    if (part?.type === PartType.WEAPON) return 'weapon';
    if (part?.type === PartType.DRONE) return 'drone';
    if (activeUtility(part)) return 'active-utility';
    return 'passive';
}

function choiceKey(source, id) {
    return `${source}:${encodeURIComponent(id)}`;
}

export function soundChoiceKey(choice) {
    if (choice.source === 'runtime') return choiceKey('runtime', choice.eventId);
    return choiceKey('signal-forge', choice.soundId);
}

export function parseSoundChoiceKey(value) {
    const separator = String(value || '').indexOf(':');
    if (separator < 0) return null;
    const source = value.slice(0, separator);
    const id = decodeURIComponent(value.slice(separator + 1));
    if (source === 'runtime') return { source, eventId: id };
    if (source === 'signal-forge') return { source, soundId: id };
    return null;
}

/**
 * Catalog public runtime events and saved Signal Forge records for a slot.
 * Missing packaged files remain visible and are marked unavailable so the
 * editor explains why a preview cannot play.
 */
export function listPartSoundChoices({ audio, signalForge } = {}) {
    const runtime = SOUND_EVENTS
        .filter(event => event.id !== 'bgm')
        .map(event => ({
            source: 'runtime',
            eventId: event.id,
            label: event.label,
            category: event.category,
            available: hasAudioSound(audio, event.id),
            choiceKey: choiceKey('runtime', event.id)
        }));
    const saved = [...(signalForge?.sounds?.values?.() || [])]
        .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
        .map(sound => ({
            source: 'signal-forge',
            soundId: sound.id,
            label: sound.name || sound.id,
            category: 'saved signal forge',
            available: hasAudioSound(audio, savedAudioName(signalForge, sound.id)),
            choiceKey: choiceKey('signal-forge', sound.id)
        }));
    return [...runtime, ...saved];
}

/**
 * Inspect a staged slot without applying it to AudioManager or Signal Forge.
 */
export function inspectPartSoundSlot(slot, assignment, { audio, signalForge } = {}) {
    const normalized = normalizeAssignment(assignment);
    if (normalized?.source === 'runtime') {
        const event = getSoundEvent(normalized.eventId);
        const available = hasAudioSound(audio, normalized.eventId);
        return {
            status: available ? 'custom' : 'missing',
            source: 'runtime',
            soundName: available ? normalized.eventId : null,
            label: event?.label || normalized.eventId,
            detail: available ? 'public runtime sound' : 'runtime sound is missing'
        };
    }

    if (normalized?.source === 'signal-forge') {
        const record = signalForge?.sounds?.get?.(normalized.soundId);
        const available = Boolean(record) && hasAudioSound(
            audio,
            savedAudioName(signalForge, normalized.soundId)
        );
        return {
            status: available ? 'custom' : 'missing',
            source: 'signal-forge',
            soundName: available ? savedAudioName(signalForge, normalized.soundId) : null,
            label: record?.name || normalized.soundId,
            detail: available ? 'saved Signal Forge sound' : 'saved sound is missing'
        };
    }

    const fallbackEvent = getSoundEvent(slot.fallback);
    const available = hasAudioSound(audio, slot.fallback);
    return {
        status: available ? 'default' : 'missing',
        source: 'default',
        soundName: available ? slot.fallback : null,
        label: fallbackEvent?.label || slot.fallback,
        detail: available ? 'built-in default' : 'default sound is missing'
    };
}

export function getAssignmentForSlot(draft, slotId) {
    return normalizeAssignment(readDraftAssignment(draft, slotId));
}
