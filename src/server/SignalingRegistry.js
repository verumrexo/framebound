import { sanitizeRoomId } from '../shared/ProtocolValidation.js';

export class SignalingRegistry {
    constructor({
        ttlMs = 120_000,
        maxSessions = 1000,
        maxGuests = 3,
        now = () => Date.now(),
        generateCode = defaultCode
    } = {}) {
        this.ttlMs = ttlMs;
        this.maxSessions = maxSessions;
        this.maxGuests = maxGuests;
        this.now = now;
        this.generateCode = generateCode;
        this.sessions = new Map();
    }

    create(hostId) {
        this.cleanup();
        this.leave(hostId);
        if (!validSocketId(hostId) || this.sessions.size >= this.maxSessions) {
            return null;
        }

        for (let attempt = 0; attempt < 20; attempt++) {
            const code = sanitizeRoomId(this.generateCode());
            if (!code || this.sessions.has(code)) continue;
            const session = {
                code,
                hostId,
                guests: new Set(),
                expiresAt: this.now() + this.ttlMs
            };
            this.sessions.set(code, session);
            return session;
        }
        return null;
    }

    join(guestId, rawCode) {
        this.cleanup();
        const code = sanitizeRoomId(rawCode);
        const session = code ? this.sessions.get(code) : null;
        if (
            !session ||
            !validSocketId(guestId) ||
            guestId === session.hostId ||
            (
                !session.guests.has(guestId) &&
                session.guests.size >= this.maxGuests
            )
        ) {
            return null;
        }

        this.leave(guestId);
        session.guests.add(guestId);
        session.expiresAt = this.now() + this.ttlMs;
        return session;
    }

    relay(senderId, rawCode, targetId, signal) {
        this.cleanup();
        const code = sanitizeRoomId(rawCode);
        const session = code ? this.sessions.get(code) : null;
        if (
            !session ||
            !validSocketId(senderId) ||
            !validSocketId(targetId) ||
            !isSafeSignal(signal)
        ) {
            return null;
        }

        const members = new Set([session.hostId, ...session.guests]);
        if (
            !members.has(senderId) ||
            !members.has(targetId) ||
            senderId === targetId
        ) {
            return null;
        }
        if (senderId !== session.hostId && targetId !== session.hostId) {
            return null;
        }

        session.expiresAt = this.now() + this.ttlMs;
        return {
            code,
            fromId: senderId,
            targetId,
            signal
        };
    }

    touch(hostId, rawCode) {
        this.cleanup();
        const code = sanitizeRoomId(rawCode);
        const session = code ? this.sessions.get(code) : null;
        if (!session || session.hostId !== hostId) return false;
        session.expiresAt = this.now() + this.ttlMs;
        return true;
    }

    leave(socketId) {
        const changes = [];
        for (const [code, session] of this.sessions) {
            if (session.hostId === socketId) {
                this.sessions.delete(code);
                changes.push({
                    code,
                    hostId: socketId,
                    guests: [...session.guests],
                    closed: true
                });
            } else if (session.guests.delete(socketId)) {
                changes.push({
                    code,
                    hostId: session.hostId,
                    guestId: socketId,
                    closed: false
                });
            }
        }
        return changes;
    }

    cleanup() {
        const now = this.now();
        for (const [code, session] of this.sessions) {
            if (session.expiresAt <= now) this.sessions.delete(code);
        }
    }

    get(code) {
        this.cleanup();
        return this.sessions.get(sanitizeRoomId(code)) || null;
    }
}

function defaultCode() {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('secure session-code generation is unavailable');
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const values = new Uint32Array(6);
    globalThis.crypto.getRandomValues(values);
    return [...values]
        .map(value => alphabet[value % alphabet.length])
        .join('');
}

function validSocketId(value) {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128;
}

function isSafeSignal(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    try {
        const encoded = JSON.stringify(value);
        return encoded.length > 0 && encoded.length <= 100_000;
    } catch {
        return false;
    }
}
