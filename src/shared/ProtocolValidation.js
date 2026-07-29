const TWO_PI = Math.PI * 2;

export const PROTOCOL_LIMITS = Object.freeze({
    maxWorldCoordinate: 1_000_000,
    maxShipCoordinate: 64,
    maxShipParts: 1024,
    maxPartIdLength: 128,
    maxLobbyNameLength: 40
});

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteInRange(value, min, max) {
    return Number.isFinite(value) && value >= min && value <= max;
}

export function normalizeAngle(angle) {
    if (!Number.isFinite(angle)) return null;
    return ((angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
}

export function sanitizePlayerInput(input) {
    if (!isRecord(input)) return null;

    const sanitized = {};
    for (const key of ['up', 'down', 'left', 'right', 'shift']) {
        if (input[key] !== undefined && typeof input[key] !== 'boolean') return null;
        sanitized[key] = input[key] === true;
    }

    for (const key of ['analogX', 'analogY']) {
        if (input[key] === undefined) continue;
        if (!isFiniteInRange(input[key], -1, 1)) return null;
        sanitized[key] = input[key];
    }

    if (input.aimAngle === null) {
        sanitized.aimAngle = null;
    } else if (input.aimAngle !== undefined) {
        const aimAngle = normalizeAngle(input.aimAngle);
        if (aimAngle === null) return null;
        sanitized.aimAngle = aimAngle;
    }

    return sanitized;
}

export function sanitizePlayerShot(data) {
    if (!isRecord(data)) return null;
    if (typeof data.partId !== 'string') return null;
    if (data.partId.length === 0 || data.partId.length > PROTOCOL_LIMITS.maxPartIdLength) return null;

    const maxCoordinate = PROTOCOL_LIMITS.maxWorldCoordinate;
    if (!isFiniteInRange(data.x, -maxCoordinate, maxCoordinate)) return null;
    if (!isFiniteInRange(data.y, -maxCoordinate, maxCoordinate)) return null;

    const angle = normalizeAngle(data.angle);
    if (angle === null) return null;

    return {
        partId: data.partId,
        x: data.x,
        y: data.y,
        angle
    };
}

export function sanitizeShipManifest(data, partsLibrary) {
    if (!isRecord(data) || !Array.isArray(data.parts)) return null;
    if (data.parts.length === 0 || data.parts.length > PROTOCOL_LIMITS.maxShipParts) return null;

    const maxCoordinate = PROTOCOL_LIMITS.maxShipCoordinate;
    const sanitized = [];
    let coreCount = 0;

    for (const part of data.parts) {
        if (!isRecord(part)) return null;
        if (!Number.isInteger(part.x) || Math.abs(part.x) > maxCoordinate) return null;
        if (!Number.isInteger(part.y) || Math.abs(part.y) > maxCoordinate) return null;
        if (typeof part.partId !== 'string') return null;
        if (part.partId.length === 0 || part.partId.length > PROTOCOL_LIMITS.maxPartIdLength) return null;
        if (!Object.hasOwn(partsLibrary, part.partId)) return null;

        const rotation = part.rotation === undefined ? 0 : part.rotation;
        if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) return null;

        if (part.partId === 'core') {
            if (part.x !== 0 || part.y !== 0) return null;
            coreCount++;
        }

        sanitized.push({
            x: part.x,
            y: part.y,
            partId: part.partId,
            rotation
        });
    }

    return coreCount === 1 ? sanitized : null;
}

export function sanitizeLobbyName(name) {
    if (typeof name !== 'string') return null;
    const sanitized = name
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (sanitized.length === 0) return null;
    return sanitized.slice(0, PROTOCOL_LIMITS.maxLobbyNameLength);
}

export function sanitizeRoomId(roomId) {
    if (typeof roomId !== 'string') return null;
    const sanitized = roomId.trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(sanitized) ? sanitized : null;
}

export class FixedWindowRateLimiter {
    constructor() {
        this.windows = new Map();
    }

    allow(key, limit, windowMs, now = Date.now()) {
        const current = this.windows.get(key);
        if (!current || now - current.startedAt >= windowMs) {
            this.windows.set(key, { startedAt: now, count: 1 });
            return true;
        }

        if (current.count >= limit) return false;
        current.count++;
        return true;
    }

    clear() {
        this.windows.clear();
    }
}
