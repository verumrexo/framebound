export const DEFAULT_ICE_SERVERS = Object.freeze([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
]);

const MAX_BUFFERED_BYTES = 1_000_000;

export class DataChannelTransport {
    constructor(channel) {
        this.channel = channel;
        this.readyState = channel.readyState || 'connecting';
        this.messageListeners = new Set();
        this.closeListeners = new Set();

        channel.onopen = () => {
            this.readyState = 'open';
        };
        channel.onmessage = event => {
            const value = decodeChannelData(event.data);
            if (value === null) return;
            for (const listener of this.messageListeners) listener(value);
        };
        channel.onclose = () => this.handleClose('channel_closed');
        channel.onerror = () => this.handleClose('channel_error');
    }

    send(message) {
        if (
            this.readyState !== 'open' ||
            this.channel.readyState !== 'open' ||
            this.channel.bufferedAmount > MAX_BUFFERED_BYTES
        ) {
            return false;
        }
        try {
            this.channel.send(
                typeof message === 'string'
                    ? message
                    : JSON.stringify(message)
            );
            return true;
        } catch {
            this.handleClose('channel_send_failed');
            return false;
        }
    }

    onMessage(listener) {
        this.messageListeners.add(listener);
        return () => this.messageListeners.delete(listener);
    }

    onClose(listener) {
        this.closeListeners.add(listener);
        return () => this.closeListeners.delete(listener);
    }

    close(reason = 'closed') {
        if (this.readyState === 'closed') return;
        this.channel.close();
        this.handleClose(reason);
    }

    handleClose(reason) {
        if (this.readyState === 'closed') return;
        this.readyState = 'closed';
        for (const listener of this.closeListeners) listener(reason);
    }
}

export class WebRtcPeerLink {
    constructor({
        RTCPeerConnectionClass = globalThis.RTCPeerConnection,
        initiator = false,
        iceServers = DEFAULT_ICE_SERVERS,
        channelLabel = 'framebound-control'
    } = {}) {
        if (typeof RTCPeerConnectionClass !== 'function') {
            throw new Error('webrtc is unavailable');
        }
        this.initiator = initiator;
        this.peerConnection = new RTCPeerConnectionClass({ iceServers });
        this.transport = null;
        this.pendingRemoteCandidates = [];
        this.onSignal = null;
        this.onTransport = null;
        this.onStateChange = null;

        this.peerConnection.onicecandidate = event => {
            if (!event.candidate) return;
            this.onSignal?.({
                candidate: event.candidate.toJSON?.() || event.candidate
            });
        };
        this.peerConnection.onconnectionstatechange = () => {
            this.onStateChange?.(this.peerConnection.connectionState);
        };
        this.peerConnection.ondatachannel = event => {
            this.attachChannel(event.channel);
        };

        if (initiator) {
            this.attachChannel(this.peerConnection.createDataChannel(
                channelLabel,
                { ordered: true }
            ));
        }
    }

    attachChannel(channel) {
        if (this.transport) return this.transport;
        this.transport = new DataChannelTransport(channel);
        this.transport.onClose(reason => {
            this.onStateChange?.(
                reason === 'peer_link_closed' ? 'closed' : 'disconnected'
            );
        });
        if (channel.readyState === 'open') {
            this.transport.readyState = 'open';
            queueMicrotask(() => this.onTransport?.(this.transport));
        } else {
            const existingOpen = channel.onopen;
            channel.onopen = event => {
                existingOpen?.(event);
                this.onTransport?.(this.transport);
            };
        }
        return this.transport;
    }

    async createOffer() {
        if (!this.initiator) throw new Error('only initiators create offers');
        const description = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(description);
        return {
            description: plainDescription(
                this.peerConnection.localDescription || description
            )
        };
    }

    async acceptSignal(signal) {
        if (!signal || typeof signal !== 'object') return null;
        if (signal.candidate) {
            if (!this.peerConnection.remoteDescription) {
                if (this.pendingRemoteCandidates.length >= 256) {
                    throw new Error('too many queued ice candidates');
                }
                this.pendingRemoteCandidates.push(signal.candidate);
                return null;
            }
            await this.peerConnection.addIceCandidate(signal.candidate);
            return null;
        }
        if (!signal.description) return null;

        await this.peerConnection.setRemoteDescription(signal.description);
        for (const candidate of this.pendingRemoteCandidates.splice(0)) {
            await this.peerConnection.addIceCandidate(candidate);
        }
        if (signal.description.type !== 'offer') return null;

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        return {
            description: plainDescription(
                this.peerConnection.localDescription || answer
            )
        };
    }

    close() {
        this.transport?.close('peer_link_closed');
        this.peerConnection.close();
    }
}

function plainDescription(description) {
    return {
        type: description.type,
        sdp: description.sdp
    };
}

function decodeChannelData(value) {
    if (typeof value === 'string') return value;
    if (value instanceof ArrayBuffer) {
        return new TextDecoder().decode(value);
    }
    if (ArrayBuffer.isView(value)) {
        return new TextDecoder().decode(value);
    }
    return null;
}
