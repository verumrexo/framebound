import { FixedWindowRateLimiter } from '../ProtocolValidation.js';
import {
    decodePeerMessage,
    encodePeerMessage,
    isPeerEventType
} from './PeerProtocol.js';

const MAX_INVALID_MESSAGES = 8;

export class HostAuthoritySession {
    constructor(simulation, {
        snapshotRate = 20,
        reconnectGraceMs = 60_000,
        createResumeToken = createRandomToken,
        schedule = scheduleReconnectExpiry,
        cancelSchedule = handle => clearTimeout(handle),
        heartbeatIntervalMs = 5_000,
        peerTimeoutMs = 15_000,
        now = () => Date.now(),
        scheduleInterval = (callback, delay) =>
            setInterval(callback, delay),
        cancelInterval = handle => clearInterval(handle)
    } = {}) {
        this.simulation = simulation;
        this.snapshotInterval = 1 / snapshotRate;
        this.createResumeToken = createResumeToken;
        this.reconnectGraceMs = reconnectGraceMs;
        this.schedule = schedule;
        this.cancelSchedule = cancelSchedule;
        this.heartbeatIntervalMs = heartbeatIntervalMs;
        this.peerTimeoutMs = peerTimeoutMs;
        this.now = now;
        this.scheduleInterval = scheduleInterval;
        this.cancelInterval = cancelInterval;
        this.peers = new Map();
        this.suspendedPeers = new Map();
        this.tick = 0;
        this.snapshotTimer = 0;
        this.eventCounter = 0;
        this.heartbeatCounter = 0;
        this.heartbeatTimer = null;
    }

    attachPeer(peerId, transport) {
        if (this.peers.has(peerId)) {
            this.detachPeer(peerId, 'replaced', { allowResume: false });
        }

        const peer = {
            id: peerId,
            transport,
            ready: false,
            playerId: null,
            resumeToken: null,
            lastSequence: 0,
            invalidMessages: 0,
            lastSeenAt: this.now(),
            limiter: new FixedWindowRateLimiter(),
            unsubscribeMessage: null,
            unsubscribeClose: null
        };
        peer.unsubscribeMessage = transport.onMessage(raw =>
            this.receive(peer, raw)
        );
        peer.unsubscribeClose = transport.onClose(reason =>
            this.detachPeer(peerId, reason || 'transport_closed')
        );
        this.peers.set(peerId, peer);
        this.startHeartbeat();
        return peer;
    }

    detachPeer(peerId, reason = 'left', { allowResume = true } = {}) {
        const peer = this.peers.get(peerId);
        if (!peer) return false;
        this.peers.delete(peerId);
        peer.unsubscribeMessage?.();
        peer.unsubscribeClose?.();
        peer.limiter.clear();
        if (
            peer.ready &&
            allowResume &&
            this.reconnectGraceMs > 0 &&
            peer.resumeToken
        ) {
            this.simulation.suspendPeer?.(peer.playerId, reason);
            const timeout = this.schedule(
                () => this.expireSuspendedPeer(peer.resumeToken),
                this.reconnectGraceMs
            );
            this.suspendedPeers.set(peer.resumeToken, {
                playerId: peer.playerId,
                timeout
            });
        } else if (peer.ready) {
            this.simulation.removePeer?.(peer.playerId, reason);
        }
        if (peer.playerId) {
            this.broadcast('peer_left', { peerId: peer.playerId });
        }
        if (this.peers.size === 0) this.stopHeartbeat();
        return true;
    }

    receive(peer, raw) {
        if (!peer.limiter.allow('messages', 300, 1000)) {
            this.sendError(peer, 'rate_limited', 'too many peer messages', true);
            return;
        }

        const message = decodePeerMessage(raw, { direction: 'client' });
        if (!message) {
            peer.invalidMessages++;
            this.sendError(
                peer,
                'invalid_message',
                'peer message was rejected',
                peer.invalidMessages < MAX_INVALID_MESSAGES
            );
            if (peer.invalidMessages >= MAX_INVALID_MESSAGES) {
                peer.transport.close('invalid_message_limit');
            }
            return;
        }
        peer.lastSeenAt = this.now();

        if (message.type === 'hello') {
            this.handleHello(peer, message);
            return;
        }
        if (!peer.ready) {
            this.sendError(peer, 'hello_required', 'hello is required', true);
            return;
        }

        if (message.type === 'pong') return;
        if (!this.acceptSequence(peer, message.sequence)) return;

        if (message.type === 'input') {
            this.simulation.applyInput?.(
                peer.playerId,
                message.input,
                message.sequence
            );
            return;
        }
        if (message.type === 'resync_request') {
            this.sendFullResync(peer);
            return;
        }

        const result = this.simulation.requestAction?.(
            peer.playerId,
            message.action,
            message.payload,
            message.sequence
        );
        if (!result) {
            this.sendError(
                peer,
                'action_rejected',
                'host rejected the requested action',
                true
            );
            return;
        }
        const events = Array.isArray(result) ? result : [result];
        for (const event of events) this.broadcastEvent(event);
        if (events.some(event => event.type === 'ship_state')) {
            this.flushFullResyncs();
        }
    }

    handleHello(peer, message) {
        if (peer.ready) return;
        const suspended = message.resumeToken
            ? this.suspendedPeers.get(message.resumeToken)
            : null;
        if (suspended) {
            this.cancelSchedule(suspended.timeout);
            this.suspendedPeers.delete(message.resumeToken);
            peer.playerId = suspended.playerId;
            peer.resumeToken = message.resumeToken;
            const resumed = this.simulation.resumePeer?.(
                peer.playerId,
                peer.id
            );
            if (resumed === false) {
                this.simulation.removePeer?.(
                    peer.playerId,
                    'resume_rejected'
                );
                this.rejectJoin(peer);
                return;
            }
        } else {
            const accepted = this.simulation.addPeer?.(peer.id, {
                displayName: message.displayName
            });
            if (accepted === false) {
                this.rejectJoin(peer);
                return;
            }
            peer.playerId = accepted?.playerId || peer.id;
            peer.resumeToken = this.createResumeToken(peer.playerId);
        }

        peer.ready = true;
        this.safeTransportSend(peer, encodePeerMessage('welcome', {
            peerId: peer.playerId,
            tick: this.tick,
            resumeToken: peer.resumeToken
        }));
        this.sendFullResync(peer);
    }

    rejectJoin(peer) {
        this.sendError(peer, 'join_rejected', 'host rejected the peer', false);
        peer.transport.close('join_rejected');
    }

    expireSuspendedPeer(resumeToken) {
        const suspended = this.suspendedPeers.get(resumeToken);
        if (!suspended) return false;
        this.suspendedPeers.delete(resumeToken);
        this.simulation.removePeer?.(
            suspended.playerId,
            'reconnect_timeout'
        );
        return true;
    }

    close(reason = 'host_closed') {
        this.stopHeartbeat();
        for (const peerId of [...this.peers.keys()]) {
            this.detachPeer(peerId, reason, { allowResume: false });
        }
        for (const [resumeToken, suspended] of this.suspendedPeers) {
            this.cancelSchedule(suspended.timeout);
            this.simulation.removePeer?.(suspended.playerId, reason);
            this.suspendedPeers.delete(resumeToken);
        }
    }

    startHeartbeat() {
        if (
            this.heartbeatTimer !== null ||
            this.heartbeatIntervalMs <= 0
        ) {
            return false;
        }
        this.heartbeatTimer = this.scheduleInterval(
            () => this.checkPeerLiveness(),
            this.heartbeatIntervalMs
        );
        this.heartbeatTimer?.unref?.();
        return true;
    }

    stopHeartbeat() {
        if (this.heartbeatTimer === null) return;
        this.cancelInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }

    checkPeerLiveness() {
        const now = this.now();
        for (const peer of [...this.peers.values()]) {
            if (
                this.peerTimeoutMs > 0 &&
                now - peer.lastSeenAt > this.peerTimeoutMs
            ) {
                try {
                    peer.transport.close('peer_timeout');
                } catch {
                    // Detach below even if a broken transport cannot close.
                }
                if (this.peers.has(peer.id)) {
                    this.detachPeer(peer.id, 'peer_timeout');
                }
                continue;
            }
            if (!peer.ready) continue;
            this.heartbeatCounter++;
            this.safeTransportSend(peer, encodePeerMessage('ping', {
                nonce: `host_${this.heartbeatCounter}`
            }));
        }
    }

    acceptSequence(peer, sequence) {
        if (sequence <= peer.lastSequence) {
            this.sendError(
                peer,
                'stale_sequence',
                'stale or repeated peer sequence',
                true
            );
            return false;
        }
        peer.lastSequence = sequence;
        return true;
    }

    update(dt) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        this.simulation.step?.(dt);
        this.tick++;
        this.snapshotTimer += dt;

        if (this.snapshotTimer < this.snapshotInterval) return;
        this.snapshotTimer %= this.snapshotInterval;
        this.flushSnapshots();
    }

    flushSnapshots() {
        let sent = false;
        for (const peer of this.peers.values()) {
            if (!peer.ready) continue;
            sent = this.sendSnapshot(peer) || sent;
        }
        return sent;
    }

    flushFullResyncs() {
        let sent = false;
        for (const peer of this.peers.values()) {
            if (!peer.ready) continue;
            sent = this.sendFullResync(peer) || sent;
        }
        return sent;
    }

    sendSnapshot(peer) {
        const state = this.simulation.snapshotFor?.(peer.playerId);
        if (state === undefined) return false;
        let encoded;
        try {
            encoded = encodePeerMessage('snapshot', {
                tick: this.tick,
                ack: peer.lastSequence,
                state
            });
        } catch {
            return this.rejectUnsendableState(peer);
        }
        return this.safeTransportSend(peer, encoded);
    }

    sendFullResync(peer) {
        const state = this.simulation.fullStateFor?.(peer.playerId) ??
            this.simulation.snapshotFor?.(peer.playerId);
        if (state === undefined) return false;
        let encoded;
        try {
            encoded = encodePeerMessage('full_resync', {
                tick: this.tick,
                ack: peer.lastSequence,
                state
            });
        } catch {
            return this.rejectUnsendableState(peer);
        }
        return this.safeTransportSend(peer, encoded);
    }

    broadcastEvent(event) {
        if (
            !event ||
            !isPeerEventType(event.type)
        ) {
            return false;
        }
        this.eventCounter++;
        return this.broadcast('event', {
            tick: this.tick,
            eventId: `${this.tick}_${this.eventCounter}`,
            eventType: event.type,
            payload: event.payload ?? {}
        });
    }

    broadcast(type, payload) {
        let encoded;
        try {
            encoded = encodePeerMessage(type, payload);
        } catch {
            return false;
        }
        let sent = false;
        for (const peer of this.peers.values()) {
            if (!peer.ready) continue;
            sent = this.safeTransportSend(peer, encoded) || sent;
        }
        return sent;
    }

    sendError(peer, code, message, recoverable) {
        return this.safeTransportSend(peer, encodePeerMessage('error', {
            code,
            message,
            recoverable
        }));
    }

    safeTransportSend(peer, encoded) {
        try {
            return peer.transport.send(encoded);
        } catch {
            try {
                peer.transport.close('transport_send_failed');
            } catch {
                // A broken peer transport must never escape into the host frame.
            }
            return false;
        }
    }

    rejectUnsendableState(peer) {
        this.sendError(
            peer,
            'state_too_large',
            'authoritative state exceeds the transport limit',
            false
        );
        try {
            peer.transport.close('state_too_large');
        } catch {
            // A broken transport cannot be allowed to escape into simulation.
        }
        return false;
    }
}

function createRandomToken() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID().replace(/-/g, '');
    }
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('secure resume-token generation is unavailable');
    }
    const values = new Uint8Array(16);
    globalThis.crypto.getRandomValues(values);
    return [...values]
        .map(value => value.toString(16).padStart(2, '0'))
        .join('');
}

function scheduleReconnectExpiry(callback, delay) {
    const handle = setTimeout(callback, delay);
    handle?.unref?.();
    return handle;
}
