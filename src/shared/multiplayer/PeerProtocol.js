import {
    normalizeAngle,
    PROTOCOL_LIMITS,
    sanitizePlayerInput
} from '../ProtocolValidation.js';

export const PEER_PROTOCOL_VERSION = 1;
export const PEER_PROTOCOL_LIMITS = Object.freeze({
    maxMessageBytes: 1_000_000,
    maxStateDepth: 10,
    maxCollectionLength: 4096,
    maxObjectKeys: 256,
    maxStringLength: 200,
    maxSequence: Number.MAX_SAFE_INTEGER,
    maxTick: Number.MAX_SAFE_INTEGER
});

const CLIENT_MESSAGE_TYPES = new Set([
    'hello',
    'input',
    'action',
    'resync_request',
    'pong'
]);
const HOST_MESSAGE_TYPES = new Set([
    'welcome',
    'snapshot',
    'event',
    'full_resync',
    'error',
    'ping',
    'peer_left'
]);
const ACTION_TYPES = new Set([
    'shoot',
    'interact',
    'level_up',
    'ship_edit',
    'transition',
    'sweep',
    'ability'
]);
const EVENT_TYPES = new Set([
    'spawn',
    'despawn',
    'hit',
    'death',
    'room_state',
    'reward',
    'fire_intent',
    'ship_state'
]);

export function isPeerEventType(value) {
    return EVENT_TYPES.has(value);
}

export function encodePeerMessage(type, payload = {}) {
    const message = {
        version: PEER_PROTOCOL_VERSION,
        type,
        ...payload
    };
    const encoded = JSON.stringify(message);
    if (byteLength(encoded) > PEER_PROTOCOL_LIMITS.maxMessageBytes) {
        throw new RangeError('peer message exceeds size limit');
    }
    return encoded;
}

export function decodePeerMessage(raw, { direction = 'any' } = {}) {
    let value;
    try {
        if (
            typeof raw === 'string' &&
            byteLength(raw) <= PEER_PROTOCOL_LIMITS.maxMessageBytes
        ) {
            value = JSON.parse(raw);
        } else if (isRecord(raw)) {
            const encoded = JSON.stringify(raw);
            if (byteLength(encoded) > PEER_PROTOCOL_LIMITS.maxMessageBytes) {
                return null;
            }
            value = raw;
        } else {
            return null;
        }
    } catch {
        return null;
    }

    if (
        !isRecord(value) ||
        value.version !== PEER_PROTOCOL_VERSION ||
        typeof value.type !== 'string'
    ) {
        return null;
    }
    if (
        direction === 'client' &&
        !CLIENT_MESSAGE_TYPES.has(value.type)
    ) {
        return null;
    }
    if (
        direction === 'host' &&
        !HOST_MESSAGE_TYPES.has(value.type)
    ) {
        return null;
    }

    return sanitizeByType(value);
}

export function createHello(displayName = 'pilot', resumeToken = null) {
    return encodePeerMessage('hello', {
        displayName: sanitizeDisplayName(displayName),
        resumeToken: sanitizeToken(resumeToken)
    });
}

export function createInput(sequence, input) {
    const sanitized = sanitizePlayerInput(input);
    if (!validSequence(sequence) || !sanitized) {
        throw new TypeError('invalid peer input');
    }
    return encodePeerMessage('input', {
        sequence,
        input: sanitized
    });
}

export function createAction(sequence, action, payload = {}) {
    const sanitized = sanitizeAction(action, payload);
    if (!validSequence(sequence) || !sanitized) {
        throw new TypeError('invalid peer action');
    }
    return encodePeerMessage('action', {
        sequence,
        action,
        payload: sanitized
    });
}

function sanitizeByType(value) {
    switch (value.type) {
        case 'hello':
            return {
                version: value.version,
                type: value.type,
                displayName: sanitizeDisplayName(value.displayName),
                resumeToken: sanitizeToken(value.resumeToken)
            };
        case 'input': {
            const input = sanitizePlayerInput(value.input);
            if (!validSequence(value.sequence) || !input) return null;
            return {
                version: value.version,
                type: value.type,
                sequence: value.sequence,
                input
            };
        }
        case 'action': {
            const payload = sanitizeAction(value.action, value.payload);
            if (!validSequence(value.sequence) || !payload) return null;
            return {
                version: value.version,
                type: value.type,
                sequence: value.sequence,
                action: value.action,
                payload
            };
        }
        case 'resync_request':
            return validSequence(value.sequence)
                ? {
                    version: value.version,
                    type: value.type,
                    sequence: value.sequence
                }
                : null;
        case 'pong':
            return validNonce(value.nonce)
                ? {
                    version: value.version,
                    type: value.type,
                    nonce: value.nonce
                }
                : null;
        case 'welcome':
            if (
                !validPeerId(value.peerId) ||
                !validTick(value.tick) ||
                typeof value.resumeToken !== 'string'
            ) {
                return null;
            }
            return {
                version: value.version,
                type: value.type,
                peerId: value.peerId,
                tick: value.tick,
                resumeToken: value.resumeToken.slice(0, 128)
            };
        case 'snapshot':
        case 'full_resync':
            if (
                !validTick(value.tick) ||
                !validSequence(value.ack) ||
                !isSafeState(value.state)
            ) {
                return null;
            }
            return {
                version: value.version,
                type: value.type,
                tick: value.tick,
                ack: value.ack,
                state: value.state
            };
        case 'event':
            if (
                !validTick(value.tick) ||
                typeof value.eventId !== 'string' ||
                value.eventId.length === 0 ||
                value.eventId.length > 100 ||
                typeof value.eventType !== 'string' ||
                !isPeerEventType(value.eventType) ||
                !isSafeState(value.payload)
            ) {
                return null;
            }
            return {
                version: value.version,
                type: value.type,
                tick: value.tick,
                eventId: value.eventId,
                eventType: value.eventType,
                payload: value.payload
            };
        case 'error':
            if (
                typeof value.code !== 'string' ||
                value.code.length === 0 ||
                value.code.length > 80 ||
                typeof value.message !== 'string'
            ) {
                return null;
            }
            return {
                version: value.version,
                type: value.type,
                code: value.code,
                message: value.message.slice(
                    0,
                    PEER_PROTOCOL_LIMITS.maxStringLength
                ),
                recoverable: value.recoverable === true
            };
        case 'ping':
            return validNonce(value.nonce)
                ? {
                    version: value.version,
                    type: value.type,
                    nonce: value.nonce
                }
                : null;
        case 'peer_left':
            return validPeerId(value.peerId)
                ? {
                    version: value.version,
                    type: value.type,
                    peerId: value.peerId
                }
                : null;
        default:
            return null;
    }
}

function sanitizeAction(action, payload) {
    if (!ACTION_TYPES.has(action) || !isRecord(payload)) return null;

    if (action === 'shoot') {
        const aimAngle = normalizeAngle(payload.aimAngle);
        if (aimAngle === null || typeof payload.active !== 'boolean') {
            return null;
        }
        return {
            aimAngle,
            active: payload.active
        };
    }

    if (action === 'interact') {
        if (
            typeof payload.targetKind !== 'string' ||
                !['shop', 'treasure', 'vault', 'portal', 'doctrine'].includes(
                payload.targetKind
            ) ||
            !Number.isInteger(payload.targetIndex) ||
            payload.targetIndex < 0 ||
            payload.targetIndex > 1024
        ) {
            return null;
        }
        return {
            targetKind: payload.targetKind,
            targetIndex: payload.targetIndex
        };
    }

    if (action === 'transition') {
        if (
            !['top', 'bottom', 'left', 'right', 'portal'].includes(
                payload.direction
            )
        ) {
            return null;
        }
        return { direction: payload.direction };
    }

    if (action === 'level_up') {
        if (
            !Number.isInteger(payload.index) ||
            payload.index < 0 ||
            payload.index > 2
        ) {
            return null;
        }
        return { index: payload.index };
    }

    if (action === 'sweep') return {};

    if (action === 'ability') {
        const aimAngle = normalizeAngle(payload.aimAngle);
        if (
            typeof payload.abilityId !== 'string' ||
            !['blink', 'decoy', 'stealth', 'emp'].includes(payload.abilityId) ||
            aimAngle === null
        ) {
            return null;
        }
        return {
            abilityId: payload.abilityId,
            aimAngle
        };
    }

    if (!Array.isArray(payload.parts)) return null;
    if (
        payload.parts.length === 0 ||
        payload.parts.length > 1024 ||
        !payload.parts.every(part =>
            isRecord(part) &&
            Number.isInteger(part.x) &&
            Math.abs(part.x) <= PROTOCOL_LIMITS.maxShipCoordinate &&
            Number.isInteger(part.y) &&
            Math.abs(part.y) <= PROTOCOL_LIMITS.maxShipCoordinate &&
            typeof part.partId === 'string' &&
            part.partId.length > 0 &&
            part.partId.length <= 128 &&
            Number.isInteger(part.rotation) &&
            part.rotation >= 0 &&
            part.rotation <= 3
        )
    ) {
        return null;
    }
    return {
        parts: payload.parts.map(part => ({
            x: part.x,
            y: part.y,
            partId: part.partId,
            rotation: part.rotation
        }))
    };
}

function sanitizeDisplayName(value) {
    if (typeof value !== 'string') return 'pilot';
    const cleaned = value
        // eslint-disable-next-line no-control-regex -- these are the characters being stripped
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24);
    return cleaned || 'pilot';
}

function sanitizeToken(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
        ? value
        : null;
}

function validPeerId(value) {
    return typeof value === 'string' &&
        /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

function validNonce(value) {
    return typeof value === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function validSequence(value) {
    return Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= PEER_PROTOCOL_LIMITS.maxSequence;
}

function validTick(value) {
    return Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= PEER_PROTOCOL_LIMITS.maxTick;
}

function isSafeState(value, depth = 0) {
    if (depth > PEER_PROTOCOL_LIMITS.maxStateDepth) return false;
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') {
        return value.length <= PEER_PROTOCOL_LIMITS.maxStringLength;
    }
    if (Array.isArray(value)) {
        return value.length <= PEER_PROTOCOL_LIMITS.maxCollectionLength &&
            value.every(item => isSafeState(item, depth + 1));
    }
    if (!isRecord(value)) return false;
    const entries = Object.entries(value);
    return entries.length <= PEER_PROTOCOL_LIMITS.maxObjectKeys &&
        entries.every(([key, item]) =>
            key !== '__proto__' &&
            key !== 'constructor' &&
            key.length <= 100 &&
            isSafeState(item, depth + 1)
        );
}

function isRecord(value) {
    return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value);
}

function byteLength(value) {
    return new TextEncoder().encode(value).byteLength;
}
