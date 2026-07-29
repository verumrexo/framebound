import {
    createAction,
    createHello,
    createInput,
    decodePeerMessage,
    encodePeerMessage
} from './PeerProtocol.js';

export class PeerSessionClient {
    constructor(transport, {
        displayName = 'pilot',
        resumeToken = null
    } = {}) {
        this.transport = transport;
        this.displayName = displayName;
        this.resumeToken = resumeToken;
        this.peerId = null;
        this.sequence = 0;
        this.lastAck = 0;
        this.lastTick = 0;
        this.connected = false;
        this.onSnapshot = null;
        this.onFullResync = null;
        this.onEvent = null;
        this.onError = null;
        this.onPeerLeft = null;
        this.onActivity = null;
        this.unsubscribe = transport.onMessage(raw => this.receive(raw));
    }

    start() {
        return this.transport.send(
            createHello(this.displayName, this.resumeToken)
        );
    }

    sendInput(input) {
        this.sequence++;
        return this.transport.send(createInput(this.sequence, input));
    }

    requestAction(action, payload) {
        this.sequence++;
        return this.transport.send(
            createAction(this.sequence, action, payload)
        );
    }

    requestResync() {
        this.sequence++;
        return this.transport.send(encodePeerMessage('resync_request', {
            sequence: this.sequence
        }));
    }

    receive(raw) {
        const message = decodePeerMessage(raw, { direction: 'host' });
        if (!message) return false;
        this.onActivity?.(message);

        if (message.type === 'welcome') {
            this.peerId = message.peerId;
            this.resumeToken = message.resumeToken;
            this.lastTick = message.tick;
            this.connected = true;
            return true;
        }
        if (
            message.type === 'snapshot' ||
            message.type === 'full_resync'
        ) {
            if (message.tick < this.lastTick) return false;
            this.lastTick = message.tick;
            this.lastAck = Math.max(this.lastAck, message.ack);
            if (message.type === 'snapshot') {
                this.onSnapshot?.(message.state, message);
            } else {
                this.onFullResync?.(message.state, message);
            }
            return true;
        }
        if (message.type === 'event') {
            this.lastTick = Math.max(this.lastTick, message.tick);
            this.onEvent?.(message);
            return true;
        }
        if (message.type === 'error') {
            this.onError?.(message);
            return true;
        }
        if (message.type === 'peer_left') {
            this.onPeerLeft?.(message.peerId);
            return true;
        }
        if (message.type === 'ping') {
            this.transport.send(encodePeerMessage('pong', {
                nonce: message.nonce
            }));
            return true;
        }
        return false;
    }

    close() {
        this.unsubscribe?.();
        this.connected = false;
        this.transport.close('client_closed');
    }
}
