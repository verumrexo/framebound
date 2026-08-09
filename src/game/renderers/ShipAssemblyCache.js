import { Assets } from '../../Assets.js';
import { TILE_SIZE } from '../../shared/parts/Part.js';

const assemblyCaches = new WeakMap();
const objectIds = new WeakMap();
let nextObjectId = 1;

export const SHIP_ASSEMBLY_PROFILES = {
    player: {
        id: 'player',
        staticAnchor: 'center',
        weaponFallbacks: true
    },
    enemy: {
        id: 'enemy',
        staticAnchor: 'sprite',
        weaponFallbacks: false
    }
};

function objectId(value) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
        return String(value ?? 'none');
    }
    if (!objectIds.has(value)) objectIds.set(value, nextObjectId++);
    return objectIds.get(value);
}

function normalizeRotation(rotation = 0) {
    const whole = Math.trunc(rotation);
    return ((whole % 4) + 4) % 4;
}

function spriteIdentity(sprite) {
    if (!sprite) return 'none';
    return [
        objectId(sprite),
        objectId(sprite.data),
        sprite.width,
        sprite.height,
        sprite.scale,
        sprite.anchorX,
        sprite.anchorY,
        JSON.stringify(sprite.colorMap || {})
    ].join(':');
}

function getWeaponBaseSprite(part, profile) {
    if (part.def.baseSprite) return part.def.baseSprite;
    if (!profile.weaponFallbacks) return null;
    if ((part.width === 1 && part.height === 2) ||
        (part.width === 2 && part.height === 1)) {
        return Assets.LongHull || null;
    }
    return Assets.PlayerBase || null;
}

function staticSpriteEntries(part, profile) {
    if (part.def.type === 'weapon') {
        const sprite = getWeaponBaseSprite(part, profile);
        if (!sprite) return [];
        // The fallback 1x1 plate was historically ship-aligned, while real
        // weapon bases and long fallback hulls use the mounted part rotation.
        const rotationOffset = !part.def.baseSprite && sprite === Assets.PlayerBase
            ? -part.rotation * Math.PI / 2
            : 0;
        return [{ sprite, anchorX: 0.5, anchorY: 0.5, rotationOffset }];
    }
    if (!part.def.sprite) return [];
    return profile.staticAnchor === 'center'
        ? [{ sprite: part.def.sprite, anchorX: 0.5, anchorY: 0.5 }]
        : [{ sprite: part.def.sprite }];
}

function spriteBounds(sprite, x, y, rotation, anchorX = sprite.anchorX, anchorY = sprite.anchorY) {
    const width = (sprite.width || 0) * (sprite.scale || 1);
    const height = (sprite.height || 0) * (sprite.scale || 1);
    const left = -width * (anchorX ?? 0.5);
    const top = -height * (anchorY ?? 0.5);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const corners = [
        [left, top], [left + width, top],
        [left, top + height], [left + width, top + height]
    ].map(([px, py]) => ({
        x: x + px * cos - py * sin,
        y: y + px * sin + py * cos
    }));
    return {
        minX: Math.min(...corners.map(corner => corner.x)),
        minY: Math.min(...corners.map(corner => corner.y)),
        maxX: Math.max(...corners.map(corner => corner.x)),
        maxY: Math.max(...corners.map(corner => corner.y))
    };
}

function makeCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

export function getValidatedAssemblyParts(partRefs, partsLibrary) {
    if (!partRefs || typeof partRefs[Symbol.iterator] !== 'function') return [];

    const parts = [];
    for (const partRef of partRefs) {
        const def = partsLibrary[partRef?.partId];
        if (!def || !Number.isFinite(partRef.x) || !Number.isFinite(partRef.y) ||
            !Number.isFinite(partRef.rotation ?? 0)) continue;

        const rotation = normalizeRotation(partRef.rotation);
        const isRotated = rotation % 2 !== 0;
        const width = isRotated ? def.height : def.width;
        const height = isRotated ? def.width : def.height;
        parts.push({
            partRef,
            def,
            rotation,
            width,
            height,
            localX: (partRef.x + (width - 1) / 2) * TILE_SIZE,
            localY: (partRef.y + (height - 1) / 2) * TILE_SIZE
        });
    }
    return parts;
}

function cacheKey(parts, visualTint, profile) {
    const layout = parts.map(part => {
        const sprites = staticSpriteEntries(part, profile)
            .map(entry => `${spriteIdentity(entry.sprite)}@${entry.anchorX ?? 'sprite'},${entry.anchorY ?? 'sprite'},${entry.rotationOffset || 0}`)
            .join('/');
        return `${part.def.id}:${part.partRef.x},${part.partRef.y},${part.rotation}:${part.width}x${part.height}:${sprites}`;
    }).join('|');
    return `${visualTint || 'none'}|${profile.id}|${layout}`;
}

function buildCache(parts, visualTint, profile) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const part of parts) {
        const angle = part.rotation * Math.PI / 2;
        for (const entry of staticSpriteEntries(part, profile)) {
            const bounds = spriteBounds(
                entry.sprite,
                part.localX,
                part.localY,
                angle + (entry.rotationOffset || 0),
                entry.anchorX,
                entry.anchorY
            );
            minX = Math.min(minX, bounds.minX);
            minY = Math.min(minY, bounds.minY);
            maxX = Math.max(maxX, bounds.maxX);
            maxY = Math.max(maxY, bounds.maxY);
        }
    }

    if (!Number.isFinite(minX)) return null;

    // Pixel art must not grow a transparent one-pixel seam when a rotated
    // assembly lands on a fractional bound.
    minX = Math.floor(minX) - 1;
    minY = Math.floor(minY) - 1;
    maxX = Math.ceil(maxX) + 1;
    maxY = Math.ceil(maxY) + 1;
    const canvas = makeCanvas(Math.max(1, maxX - minX), Math.max(1, maxY - minY));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (const part of parts) {
        const angle = part.rotation * Math.PI / 2;
        for (const entry of staticSpriteEntries(part, profile)) {
            entry.sprite.draw(
                ctx,
                part.localX - minX,
                part.localY - minY,
                angle + (entry.rotationOffset || 0),
                entry.anchorX ?? null,
                entry.anchorY ?? null,
                null,
                visualTint || null
            );
        }
    }

    return { canvas, minX, minY, maxX, maxY };
}

export function getAssemblyCache(
    entity,
    parts,
    visualTint = null,
    profile = SHIP_ASSEMBLY_PROFILES.player
) {
    const key = cacheKey(parts, visualTint, profile);
    const cached = assemblyCaches.get(entity);
    if (cached?.key === key) return cached;

    const assembly = buildCache(parts, visualTint, profile);
    if (!assembly) {
        assemblyCaches.delete(entity);
        return null;
    }
    const next = { key, ...assembly };
    assemblyCaches.set(entity, next);
    return next;
}

export function invalidateAssemblyCache(entity) {
    assemblyCaches.delete(entity);
}
