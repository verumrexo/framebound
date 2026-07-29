import { PeerSessionClient } from '../shared/multiplayer/PeerSessionClient.js';
import { WebRtcPeerLink } from '../shared/multiplayer/WebRtcPeerLink.js';

export class PeerConnectionCoordinator {
    constructor({
        signaling,
        hostSession = null,
        createLink = options => new WebRtcPeerLink(options),
        createClient = transport => new PeerSessionClient(transport),
        reconnectDelayMs = 500,
        maxReconnectAttempts = 3,
        joinTimeoutMs = 10_000,
        connectionTimeoutMs = 15_000,
        schedule = scheduleTimeout,
        cancelSchedule = handle => clearTimeout(handle)
    }) {
        this.signaling = signaling;
        this.hostSession = hostSession;
        this.createLink = createLink;
        this.createClient = createClient;
        this.reconnectDelayMs = reconnectDelayMs;
        this.maxReconnectAttempts = maxReconnectAttempts;
        this.joinTimeoutMs = joinTimeoutMs;
        this.connectionTimeoutMs = connectionTimeoutMs;
        this.schedule = schedule;
        this.cancelSchedule = cancelSchedule;
        this.role = null;
        this.code = null;
        this.hostId = null;
        this.links = new Map();
        this.client = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.joinTimer = null;
        this.connectionTimers = new Map();
        this.onStatus = null;
        this.onHosted = null;
        this.onConnected = null;
        this.onDisconnected = null;
        this.onClosed = null;
        this.onPeerState = null;
        this.bindSignaling();
    }

    bindSignaling() {
        this.signaling.onHosted = data => {
            if (this.role !== 'host') return;
            this.code = data.code;
            this.onStatus?.('waiting_for_peers');
            this.onHosted?.(data);
        };
        this.signaling.onJoined = data => {
            if (this.role !== 'guest') return;
            this.cancelJoinTimeout();
            this.code = data.code;
            this.hostId = data.hostId;
            this.createGuestLink(data.hostId);
            this.onStatus?.('connecting_to_host');
        };
        this.signaling.onPeerJoined = data => {
            if (this.role !== 'host' || data.code !== this.code) return;
            this.createHostLink(data.peerId).catch(error =>
                this.failPeer(data.peerId, error)
            );
        };
        this.signaling.onSignal = data => {
            if (data.code !== this.code) return;
            this.acceptSignal(data.fromId, data.signal).catch(error =>
                this.failPeer(data.fromId, error)
            );
        };
        this.signaling.onPeerLeft = peerId => {
            this.removePeer(peerId, 'peer_left');
        };
        this.signaling.onHostLeft = () => {
            if (this.role !== 'guest') return;
            this.onStatus?.('host_left');
            this.disconnect('host_left');
        };
        this.signaling.onError = message => {
            this.onStatus?.('error', message);
            if (
                (this.role === 'guest' && this.links.size === 0) ||
                (this.role === 'host' && !this.code)
            ) {
                this.disconnect('signaling_error');
            }
        };
    }

    host() {
        if (!this.hostSession) {
            throw new Error('host authority session is required');
        }
        this.resetConnections();
        this.role = 'host';
        this.onStatus?.('creating_session');
        this.signaling.connect();
        this.signaling.host();
    }

    join(code) {
        this.resetConnections();
        this.role = 'guest';
        this.onStatus?.('joining_session');
        this.signaling.connect();
        this.armJoinTimeout();
        if (!this.signaling.join(code)) {
            this.cancelJoinTimeout();
            this.role = null;
            this.onStatus?.('invalid_code');
            return false;
        }
        return true;
    }

    async createHostLink(peerId) {
        this.removePeer(peerId, 'replaced');
        const link = this.configureLink(peerId, this.createLink({
            initiator: true
        }));
        this.links.set(peerId, link);
        this.armConnectionTimeout(peerId);
        const offer = await link.createOffer();
        if (this.links.get(peerId) !== link) return null;
        this.signaling.sendSignal(peerId, offer);
        this.onStatus?.('peer_connecting', peerId);
        return link;
    }

    createGuestLink(hostId) {
        this.removePeer(hostId, 'replaced');
        const link = this.configureLink(hostId, this.createLink({
            initiator: false
        }));
        this.links.set(hostId, link);
        this.armConnectionTimeout(hostId);
        return link;
    }

    configureLink(peerId, link) {
        link.onSignal = signal => {
            this.signaling.sendSignal(peerId, signal);
        };
        link.onTransport = transport => {
            this.cancelConnectionTimeout(peerId);
            try {
                if (this.role === 'host') {
                    this.hostSession.attachPeer(peerId, transport);
                } else {
                    this.client = this.createClient(transport);
                    if (this.client.start() === false) {
                        throw new Error('peer hello could not be sent');
                    }
                }
            } catch (error) {
                this.failPeer(peerId, error);
                return;
            }
            this.cancelReconnect();
            this.reconnectAttempts = 0;
            this.onStatus?.('connected', peerId);
            this.onConnected?.({
                role: this.role,
                peerId,
                transport,
                client: this.client
            });
        };
        link.onStateChange = state => {
            this.onPeerState?.({ peerId, state });
            if (['failed', 'disconnected', 'closed'].includes(state)) {
                this.removePeer(peerId, state);
            }
        };
        return link;
    }

    async acceptSignal(fromId, signal) {
        let link = this.links.get(fromId);
        if (!link && this.role === 'guest' && fromId === this.hostId) {
            link = this.createGuestLink(fromId);
        }
        if (!link) return false;

        const response = await link.acceptSignal(signal);
        if (response) this.signaling.sendSignal(fromId, response);
        return true;
    }

    update(dt) {
        if (this.role === 'host') this.hostSession?.update(dt);
    }

    removePeer(peerId, reason = 'removed') {
        const link = this.links.get(peerId);
        if (!link) return false;
        this.cancelConnectionTimeout(peerId);
        const shouldReconnect = this.role === 'guest' &&
            peerId === this.hostId &&
            [
                'failed',
                'disconnected',
                'negotiation_failed'
            ].includes(reason);
        this.links.delete(peerId);
        if (this.role === 'host') {
            this.hostSession?.detachPeer(peerId, reason);
        }
        if (this.role === 'guest' && peerId === this.hostId) {
            this.client?.close();
            this.client = null;
            this.hostId = null;
        }
        link.close();
        this.onDisconnected?.({ peerId, reason });
        if (shouldReconnect) this.scheduleReconnect();
        return true;
    }

    scheduleReconnect() {
        if (
            this.role !== 'guest' ||
            !this.code ||
            this.reconnectTimer !== null
        ) {
            return false;
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.onStatus?.('connection_lost');
            this.disconnect('connection_lost');
            return false;
        }
        this.reconnectAttempts++;
        const delay = this.reconnectDelayMs * this.reconnectAttempts;
        this.onStatus?.('reconnecting', this.reconnectAttempts);
        this.reconnectTimer = this.schedule(() => {
            this.reconnectTimer = null;
            this.retryGuestJoin();
        }, delay);
        return true;
    }

    retryGuestJoin() {
        if (this.role !== 'guest' || !this.code) return false;

        this.armJoinTimeout();
        try {
            if (!this.signaling.join(this.code)) {
                throw new Error('signaling rejected reconnect');
            }
            return true;
        } catch (error) {
            this.cancelJoinTimeout();
            this.onStatus?.(
                'error',
                error?.message || 'signaling reconnect failed'
            );
            this.disconnect('reconnect_failed');
            return false;
        }
    }

    cancelReconnect() {
        if (this.reconnectTimer === null) return;
        this.cancelSchedule(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    armJoinTimeout() {
        this.cancelJoinTimeout();
        if (this.joinTimeoutMs <= 0) return;
        this.joinTimer = this.schedule(() => {
            this.joinTimer = null;
            if (this.role !== 'guest' || this.hostId) return;
            this.onStatus?.('join_timeout');
            this.disconnect('join_timeout');
        }, this.joinTimeoutMs);
    }

    cancelJoinTimeout() {
        if (this.joinTimer === null) return;
        this.cancelSchedule(this.joinTimer);
        this.joinTimer = null;
    }

    armConnectionTimeout(peerId) {
        this.cancelConnectionTimeout(peerId);
        if (this.connectionTimeoutMs <= 0) return;
        const timer = this.schedule(() => {
            this.connectionTimers.delete(peerId);
            if (!this.links.has(peerId)) return;
            this.failPeer(
                peerId,
                new Error('direct peer connection timed out')
            );
        }, this.connectionTimeoutMs);
        this.connectionTimers.set(peerId, timer);
    }

    cancelConnectionTimeout(peerId) {
        const timer = this.connectionTimers.get(peerId);
        if (timer === undefined) return;
        this.cancelSchedule(timer);
        this.connectionTimers.delete(peerId);
    }

    failPeer(peerId, error) {
        this.onStatus?.('error', error?.message || 'peer negotiation failed');
        this.removePeer(peerId, 'negotiation_failed');
    }

    disconnect(reason = 'closed') {
        const previousRole = this.role;
        const wasActive = Boolean(
            previousRole ||
            this.links.size > 0 ||
            this.code ||
            this.hostId ||
            this.joinTimer !== null ||
            this.reconnectTimer !== null ||
            this.connectionTimers.size > 0
        );
        this.cancelJoinTimeout();
        this.cancelReconnect();
        for (const peerId of [...this.connectionTimers.keys()]) {
            this.cancelConnectionTimeout(peerId);
        }
        if (previousRole === 'host') {
            this.hostSession?.close?.(reason);
        }
        for (const peerId of [...this.links.keys()]) {
            this.removePeer(peerId, reason);
        }
        this.signaling.leave();
        this.role = null;
        this.code = null;
        this.hostId = null;
        this.reconnectAttempts = 0;
        if (wasActive) {
            this.onClosed?.({
                role: previousRole,
                reason
            });
        }
    }

    resetConnections() {
        if (this.role || this.links.size > 0) this.disconnect('restarting');
    }
}

function scheduleTimeout(callback, delay) {
    const handle = setTimeout(callback, delay);
    handle?.unref?.();
    return handle;
}
