import { Sprite } from '../../engine/Sprite.js';
import { parsePartDesign } from './PartDesignDocument.js';
import {
    clearDroneVisualOverrides,
    registerDroneVisualOverride
} from '../../shared/combat/DroneBlueprints.js';
import { getSoundEvent } from '../audio/SoundEventRegistry.js';
import {
    DEFAULT_PROJECTILE_LOOK,
    DEFAULT_PROJECTILE_TRAIL,
    normalizeProjectileLook,
    normalizeProjectileTrail
} from '../../shared/combat/ProjectileVisuals.js';

export const PART_LAB_MANIFEST_SCHEMA_VERSION = 1;
export const PART_LAB_MANIFEST_PATH = './generated-parts/part-lab-overrides.json';
export const MAX_PART_LAB_MANIFEST_BYTES = 8 * 1024 * 1024;

const MAX_ENTRIES = 256;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const REVIEW_STATUSES = new Set(['untested', 'good', 'needs-work']);

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function assertId(id, label = 'part id') {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error(`invalid ${label}`);
    return id;
}

function normalizePoint(value, grid, label) {
    if (value === null || value === undefined) return null;
    if (!isRecord(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y) ||
        value.x < 0 || value.y < 0 || value.x > grid.width || value.y > grid.height) {
        throw new Error(`${label} is outside the design grid`);
    }
    return { x: Number(value.x), y: Number(value.y) };
}

function normalizeVisual(entry) {
    if (!isRecord(entry)) throw new Error('visual override must be an object');
    const partId = assertId(entry.partId);
    const design = parsePartDesign(JSON.stringify(entry.design));
    if (entry.design?.partId && entry.design.partId !== partId) {
        throw new Error('visual override id does not match its design');
    }
    const rawAnchors = isRecord(entry.design?.rawAnchors)
        ? {
            base: normalizePoint(entry.design.rawAnchors.base, design.grid, 'raw base anchor'),
            turret: normalizePoint(entry.design.rawAnchors.turret, design.grid, 'raw turret anchor')
        }
        : null;
    const rawBarrel = normalizePoint(entry.design?.rawBarrel, design.grid, 'raw barrel');
    return {
        partId,
        design: {
            ...design,
            partId,
            ...(typeof entry.design.partType === 'string' ? { partType: entry.design.partType } : {}),
            ...(rawAnchors ? { rawAnchors } : {}),
            ...(rawBarrel ? { rawBarrel } : {})
        }
    };
}

function normalizeAssignment(value) {
    if (value === null || value === undefined) return null;
    if (value.source === 'runtime' && typeof value.eventId === 'string') {
        if (!getSoundEvent(value.eventId)) throw new Error('unknown runtime sound event');
        return { source: 'runtime', eventId: value.eventId };
    }
    if (value.source === 'signal-forge' && typeof value.soundId === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value.soundId)) {
        return { source: 'signal-forge', soundId: value.soundId };
    }
    throw new Error('invalid part lab sound assignment');
}

function normalizeSound(entry) {
    if (!isRecord(entry)) throw new Error('sound override must be an object');
    const partId = assertId(entry.partId);
    if (!Array.isArray(entry.slots) || entry.slots.length > 2) throw new Error('part sound override needs at most two slots');
    const ids = new Set();
    const slots = entry.slots.map(slot => {
        if (!isRecord(slot) || typeof slot.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(slot.id)) throw new Error('invalid part sound slot');
        if (ids.has(slot.id)) throw new Error('duplicate part sound slot');
        ids.add(slot.id);
        const eventSlot = typeof slot.eventKey === 'string' ? slot.eventKey.split(':').pop() : '';
        if (!/^[a-z0-9_-]{1,32}$/.test(eventSlot) || slot.eventKey !== `part:${partId}:${eventSlot}`) throw new Error('invalid part sound event key');
        return {
            id: slot.id,
            label: String(slot.label || slot.id).slice(0, 64),
            eventKey: slot.eventKey,
            fallback: typeof slot.fallback === 'string' ? slot.fallback : 'hit',
            optional: Boolean(slot.optional),
            assignment: normalizeAssignment(slot.assignment)
        };
    });
    return { partId, slots };
}

function normalizeReview(entry) {
    if (!isRecord(entry)) throw new Error('review must be an object');
    const partId = assertId(entry.partId);
    const status = REVIEW_STATUSES.has(entry.status) ? entry.status : 'untested';
    const notes = String(entry.notes || '').trim().slice(0, 240);
    return { partId, status, notes };
}

export function normalizePartLabManifest(value) {
    if (!isRecord(value)) throw new Error('part lab manifest must be an object');
    if (value.schemaVersion !== PART_LAB_MANIFEST_SCHEMA_VERSION) throw new Error('unsupported part lab manifest schema');
    if (!Number.isInteger(value.version) || value.version < 1) throw new Error('invalid part lab manifest version');
    if (typeof value.modifiedAt !== 'string' || !Number.isFinite(Date.parse(value.modifiedAt))) throw new Error('invalid part lab manifest timestamp');
    const visuals = Array.isArray(value.visuals) ? value.visuals : [];
    const sounds = Array.isArray(value.sounds) ? value.sounds : [];
    const reviews = Array.isArray(value.reviews) ? value.reviews : [];
    if (visuals.length > MAX_ENTRIES || sounds.length > MAX_ENTRIES || reviews.length > MAX_ENTRIES) throw new Error('part lab manifest has too many entries');
    const unique = (items, label) => {
        const seen = new Set();
        return items.map(item => {
            const normalized = item;
            if (seen.has(normalized.partId)) throw new Error(`duplicate ${label} part`);
            seen.add(normalized.partId);
            return normalized;
        });
    };
    return {
        schemaVersion: PART_LAB_MANIFEST_SCHEMA_VERSION,
        version: value.version,
        modifiedAt: value.modifiedAt,
        visuals: unique(visuals.map(normalizeVisual), 'visual'),
        sounds: unique(sounds.map(normalizeSound), 'sound'),
        reviews: unique(reviews.map(normalizeReview), 'review')
    };
}

export function parsePartLabManifest(raw) {
    if (typeof raw !== 'string' || raw.length > MAX_PART_LAB_MANIFEST_BYTES) throw new Error('invalid part lab manifest');
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('part lab manifest must be valid json'); }
    return normalizePartLabManifest(value);
}

export function serializePartLabManifest(manifest) {
    return JSON.stringify(normalizePartLabManifest(manifest), null, 2);
}

export function buildPartLabManifest(state, now = new Date().toISOString()) {
    const visuals = [];
    const sounds = [];
    const reviews = [];
    for (const [partId, entry] of Object.entries(state?.parts || {})) {
        assertId(partId);
        if (entry.visual) visuals.push({ partId, design: clone(entry.visual) });
        if (entry.sound) sounds.push({ partId, ...clone(entry.sound) });
        if (entry.review && (entry.review.status !== 'untested' || entry.review.notes)) {
            reviews.push({ partId, ...clone(entry.review) });
        }
    }
    return normalizePartLabManifest({
        schemaVersion: PART_LAB_MANIFEST_SCHEMA_VERSION,
        version: Math.max(1, Number(state?.version) || 1),
        modifiedAt: now,
        visuals,
        sounds,
        reviews
    });
}

function makeSprite(existing, pixels, grid, anchor) {
    const scale = Number.isFinite(existing?.scale) && existing.scale > 0 ? existing.scale : 4;
    const colorMap = existing?.colorMap || { 1: '#26d426', 2: '#333' };
    return new Sprite(
        [...pixels],
        grid.width,
        grid.height,
        scale,
        colorMap,
        anchor ? anchor.x / grid.width : existing?.anchorX ?? 0.5,
        anchor ? anchor.y / grid.height : existing?.anchorY ?? 0.5
    );
}

export function applyVisualDesignOverride(definition, design) {
    if (!definition || !design) return false;
    if (definition.width * 8 - (definition.width - 1) !== design.grid.width || definition.height * 8 - (definition.height - 1) !== design.grid.height) {
        throw new Error(`visual override footprint does not match ${definition.id}`);
    }
    const grid = design.grid;
    const rawAnchors = design.rawAnchors || {};
    const baseAnchor = rawAnchors.base || design.anchors?.base || null;
    const turretAnchor = rawAnchors.turret || design.anchors?.turret || null;
    // Non-weapons render `sprite` as their visible art. A few legacy parts
    // carry a stale auxiliary baseSprite from an older inventory renderer, so
    // never let that layer become the source for a new non-weapon design.
    const oldBase = definition.type === 'weapon'
        ? (definition.baseSprite || definition.sprite)
        : definition.sprite;
    const oldTurret = definition.type === 'weapon' ? definition.sprite : null;
    const base = makeSprite(oldBase, design.layers.base, grid, baseAnchor);
    if (definition.type === 'weapon' && design.layers.turret) {
        definition.baseSprite = base;
        definition.sprite = makeSprite(oldTurret, design.layers.turret, grid, turretAnchor);
        if (design.rawBarrel || design.barrel) {
            const barrel = design.rawBarrel || design.barrel;
            const pivot = turretAnchor || { x: grid.width / 2, y: grid.height / 2 };
            const scale = definition.sprite.scale || 4;
            definition.stats = {
                ...definition.stats,
                barrelPosition: {
                    x: (barrel.x - pivot.x) * scale,
                    y: (barrel.y - pivot.y) * scale
                }
            };
        }
    } else {
        definition.sprite = base;
        definition.baseSprite = null;
        definition.drawTurretInInventory = false;
    }
    definition.projectileLook = normalizeProjectileLook(design.projectileLook || DEFAULT_PROJECTILE_LOOK);
    definition.projectileTrail = normalizeProjectileTrail(design.projectileTrail || DEFAULT_PROJECTILE_TRAIL);
    if (Number.isFinite(design.rotationOffset)) definition.rotationOffset = design.rotationOffset;
    if (design.drone) registerDroneVisualOverride(design.drone);
    return true;
}

export function applyPartLabManifest(manifest, partsLibrary) {
    const normalized = normalizePartLabManifest(manifest);
    clearDroneVisualOverrides();
    for (const entry of normalized.visuals) {
        const definition = partsLibrary?.[entry.partId];
        if (definition) applyVisualDesignOverride(definition, entry.design);
    }
    return normalized;
}

export function applyPartLabSoundOverrides(manifest, audio) {
    const normalized = normalizePartLabManifest(manifest);
    for (const entry of normalized.sounds) {
        for (const slot of entry.slots) {
            const assignment = slot.assignment;
            const soundName = assignment?.source === 'runtime'
                ? assignment.eventId
                : assignment?.source === 'signal-forge'
                    ? `forge:${assignment.soundId}`
                    : null;
            if (soundName && audio?.hasSound?.(soundName)) audio.bindEvent(slot.eventKey, soundName);
            else audio?.unbindEvent?.(slot.eventKey);
        }
    }
    return normalized;
}

export async function loadPromotedPartLabManifest(fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== 'function') return null;
    let response;
    try { response = await fetchImpl(PART_LAB_MANIFEST_PATH); } catch { return null; }
    if (!response?.ok || response.headers?.get?.('content-type')?.toLowerCase().includes('text/html')) return null;
    return parsePartLabManifest(await response.text());
}
