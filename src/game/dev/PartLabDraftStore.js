import { parsePartDesign } from './PartDesignDocument.js';
import { serializePartSoundDraft } from './PartSoundBindings.js';

export const PART_LAB_DRAFT_SCHEMA_VERSION = 1;
export const PART_LAB_DRAFT_STORAGE_KEY = 'framebound.part-lab.drafts.v1';
export const PART_LAB_NOTE_LIMIT = 240;

const REVIEW_STATUSES = new Set(['untested', 'good', 'needs-work']);

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanNote(value) {
    return String(value ?? '').trim().slice(0, PART_LAB_NOTE_LIMIT);
}

function safeId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
        ? value
        : null;
}

function normalizeReview(value) {
    const status = REVIEW_STATUSES.has(value?.status) ? value.status : 'untested';
    return { status, notes: cleanNote(value?.notes) };
}

function normalizeVisual(value, partId) {
    if (!isRecord(value)) return null;
    try {
        const parsed = parsePartDesign(JSON.stringify(value));
        return {
            ...parsed,
            partId,
            ...(typeof value.partType === 'string' ? { partType: value.partType } : {}),
            ...(isRecord(value.rawAnchors) ? { rawAnchors: clone(value.rawAnchors) } : {}),
            ...(isRecord(value.rawBarrel) ? { rawBarrel: clone(value.rawBarrel) } : {})
        };
    } catch {
        return null;
    }
}

function normalizeSound(value, part) {
    if (!isRecord(value) || !part) return null;
    try {
        return serializePartSoundDraft(part, value);
    } catch {
        return null;
    }
}

export function normalizePartLabDraftState(value, partsLibrary = null) {
    const parts = {};
    const source = isRecord(value?.parts) ? value.parts : {};
    for (const [rawId, rawEntry] of Object.entries(source)) {
        const partId = safeId(rawId);
        const part = partsLibrary?.[partId];
        if (!partId || (partsLibrary && !part)) continue;
        const entry = isRecord(rawEntry) ? rawEntry : {};
        const normalized = {
            visual: normalizeVisual(entry.visual, partId),
            sound: normalizeSound(entry.sound, part),
            review: normalizeReview(entry.review),
            savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : null
        };
        if (normalized.visual || normalized.sound || normalized.review.status !== 'untested' || normalized.review.notes || normalized.savedAt) {
            parts[partId] = normalized;
        }
    }
    return {
        schemaVersion: PART_LAB_DRAFT_SCHEMA_VERSION,
        updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : null,
        promotedAt: typeof value?.promotedAt === 'string' ? value.promotedAt : null,
        parts
    };
}

export function getPartLabDraftState(entry) {
    if (!entry) return 'untouched';
    if (entry.savedAt) return 'saved';
    if (entry.review?.status && entry.review.status !== 'untested') return 'tested';
    if (entry.visual || entry.sound) return 'edited';
    return 'untouched';
}

export class PartLabDraftStore {
    constructor({
        storage = globalThis.localStorage,
        key = PART_LAB_DRAFT_STORAGE_KEY,
        partsLibrary = null,
        now = () => new Date().toISOString()
    } = {}) {
        this.storage = storage;
        this.key = key;
        this.partsLibrary = partsLibrary;
        this.now = now;
        this.listeners = new Set();
        this.state = this.read();
    }

    read() {
        let raw = null;
        try { raw = this.storage?.getItem?.(this.key); } catch { /* storage is optional */ }
        if (!raw) return normalizePartLabDraftState({}, this.partsLibrary);
        try {
            return normalizePartLabDraftState(JSON.parse(raw), this.partsLibrary);
        } catch {
            return normalizePartLabDraftState({}, this.partsLibrary);
        }
    }

    persist() {
        this.state.updatedAt = this.now();
        try {
            this.storage?.setItem?.(this.key, JSON.stringify(this.state));
        } catch { /* a blocked browser still gets an in-memory draft */ }
        for (const listener of this.listeners) listener(this.state);
        return this.state;
    }

    subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    get(partId) {
        return this.state.parts[partId] || null;
    }

    getAll() {
        return clone(this.state.parts);
    }

    getReviews() {
        return Object.fromEntries(Object.entries(this.state.parts).map(([id, entry]) => [id, clone(entry.review)]));
    }

    upsert(partId) {
        if (!safeId(partId)) throw new Error(`invalid part lab part id: ${partId}`);
        if (!this.state.parts[partId]) {
            this.state.parts[partId] = {
                visual: null,
                sound: null,
                review: { status: 'untested', notes: '' },
                savedAt: null
            };
        }
        return this.state.parts[partId];
    }

    saveVisual(partId, design) {
        const entry = this.upsert(partId);
        entry.visual = normalizeVisual(design, partId);
        if (!entry.visual) throw new Error('invalid part lab visual draft');
        entry.savedAt = null;
        this.persist();
        return clone(entry.visual);
    }

    saveSound(partId, soundDraft) {
        const part = this.partsLibrary?.[partId];
        if (!part) throw new Error(`unknown part lab part: ${partId}`);
        const entry = this.upsert(partId);
        entry.sound = normalizeSound(soundDraft, part);
        if (!entry.sound) throw new Error('invalid part lab sound draft');
        entry.savedAt = null;
        this.persist();
        return clone(entry.sound);
    }

    saveReview(partId, status, notes = '') {
        if (!REVIEW_STATUSES.has(status) || status === 'untested') {
            throw new Error(`invalid part lab review status: ${status}`);
        }
        const entry = this.upsert(partId);
        entry.review = { status, notes: cleanNote(notes) };
        entry.savedAt = null;
        this.persist();
        return clone(entry.review);
    }

    setNotes(partId, notes) {
        const entry = this.upsert(partId);
        entry.review.notes = cleanNote(notes);
        entry.savedAt = null;
        this.persist();
        return clone(entry.review);
    }

    markPromoted(partIds, timestamp = this.now()) {
        for (const partId of partIds) {
            const entry = this.state.parts[partId];
            if (entry) entry.savedAt = timestamp;
        }
        this.state.promotedAt = timestamp;
        this.persist();
    }

    discard(partId) {
        if (!Object.hasOwn(this.state.parts, partId)) return false;
        delete this.state.parts[partId];
        this.persist();
        return true;
    }

    reset() {
        this.state = normalizePartLabDraftState({}, this.partsLibrary);
        try { this.storage?.removeItem?.(this.key); } catch { /* optional */ }
        for (const listener of this.listeners) listener(this.state);
        return this.state;
    }
}
