import { io } from 'socket.io-client';
import { sanitizeRoomId } from '../shared/ProtocolValidation.js';
import { APP_CONFIG } from './AppConfig.js';

export class SocketIOSignalingClient {
    constructor({
        socketFactory = io,
        serverUrl = APP_CONFIG.signalingUrl,
        keepaliveMs = 30_000,
        scheduleInterval = (callback, delay) =>
            setInterval(callback, delay),
        cancelInterval = handle => clearInterval(handle)
    } = {}) {
        this.socketFactory = socketFactory;
        this.serverUrl = serverUrl;
        this.keepaliveMs = keepaliveMs;
        this.scheduleInterval = scheduleInterval;
        this.cancelInterval = cancelInterval;
        this.socket = null;
        this.connected = false;
        this.code = null;
        this.keepaliveTimer = null;
        this.onHosted = null;
        this.onJoined = null;
        this.onPeerJoined = null;
        this.onSignal = null;
        this.onPeerLeft = null;
        this.onHostLeft = null;
        this.onError = null;
    }

    connect() {
        if (this.socket) {
            if (!this.socket.connected) this.socket.connect();
            return;
        }
        this.socket = this.socketFactory(this.serverUrl, {
            transports: ['polling', 'websocket']
        });
        this.socket.on('connect', () => {
            this.connected = true;
        });
        this.socket.on('disconnect', () => {
            this.connected = false;
        });
        this.socket.on('p2p_hosted', data => {
            const code = sanitizeRoomId(data?.code);
            if (!code || !Number.isFinite(data?.expiresAt)) return;
            this.code = code;
            this.startKeepalive();
            this.onHosted?.({ code, expiresAt: data.expiresAt });
        });
        this.socket.on('p2p_joined', data => {
            const code = sanitizeRoomId(data?.code);
            if (!code || !validPeerId(data?.hostId)) return;
            this.code = code;
            this.onJoined?.({ code, hostId: data.hostId });
        });
        this.socket.on('p2p_peer_joined', data => {
            const code = sanitizeRoomId(data?.code);
            if (!code || !validPeerId(data?.peerId)) return;
            this.onPeerJoined?.({ code, peerId: data.peerId });
        });
        this.socket.on('p2p_signal', data => {
            const code = sanitizeRoomId(data?.code);
            if (
                !code ||
                !validPeerId(data?.fromId) ||
                !safeSignal(data?.signal)
            ) {
                return;
            }
            this.onSignal?.({
                code,
                fromId: data.fromId,
                signal: data.signal
            });
        });
        this.socket.on('p2p_peer_left', data => {
            if (validPeerId(data?.peerId)) this.onPeerLeft?.(data.peerId);
        });
        this.socket.on('p2p_host_left', data => {
            const code = sanitizeRoomId(data?.code);
            if (code) this.onHostLeft?.(code);
        });
        this.socket.on('p2p_error', message => {
            if (typeof message === 'string') this.onError?.(message.slice(0, 200));
        });
    }

    host() {
        if (!this.socket) this.connect();
        this.socket.emit('p2p_host');
    }

    join(code) {
        const sanitized = sanitizeRoomId(code);
        if (!sanitized) return false;
        if (!this.socket) this.connect();
        this.socket.emit('p2p_join', sanitized);
        return true;
    }

    sendSignal(targetId, signal) {
        if (
            !this.socket ||
            !this.code ||
            !validPeerId(targetId) ||
            !safeSignal(signal)
        ) {
            return false;
        }
        this.socket.emit('p2p_signal', {
            code: this.code,
            targetId,
            signal
        });
        return true;
    }

    leave() {
        const hadSession = Boolean(this.code);
        this.stopKeepalive();
        if (hadSession) this.socket?.emit('p2p_leave');
        this.code = null;
    }

    disconnect() {
        this.leave();
        this.socket?.disconnect();
        this.socket = null;
        this.connected = false;
    }

    startKeepalive() {
        this.stopKeepalive();
        if (!this.code || this.keepaliveMs <= 0) return;
        this.keepaliveTimer = this.scheduleInterval(() => {
            if (this.socket?.connected && this.code) {
                this.socket.emit('p2p_keepalive', this.code);
            }
        }, this.keepaliveMs);
        this.keepaliveTimer?.unref?.();
    }

    stopKeepalive() {
        if (this.keepaliveTimer === null) return;
        this.cancelInterval(this.keepaliveTimer);
        this.keepaliveTimer = null;
    }
}

function validPeerId(value) {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128;
}

function safeSignal(value) {
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
