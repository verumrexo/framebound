import { encodePeerMessage } from './PeerProtocol.js';

export class LoopbackTransport {
    static createPair() {
        const left = new LoopbackTransport();
        const right = new LoopbackTransport();
        left.peer = right;
        right.peer = left;
        left.readyState = 'open';
        right.readyState = 'open';
        return [left, right];
    }

    constructor() {
        this.peer = null;
        this.readyState = 'connecting';
        this.messageListeners = new Set();
        this.closeListeners = new Set();
    }

    send(message) {
        if (
            this.readyState !== 'open' ||
            !this.peer ||
            this.peer.readyState !== 'open'
        ) {
            return false;
        }

        const encoded = typeof message === 'string'
            ? message
            : encodePeerMessage(message.type, message);

        const destination = this.peer;
        queueMicrotask(() => {
            if (destination.readyState !== 'open') return;
            for (const listener of destination.messageListeners) {
                listener(encoded);
            }
        });
        return true;
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
        this.readyState = 'closed';
        for (const listener of this.closeListeners) listener(reason);

        const peer = this.peer;
        this.peer = null;
        if (peer?.peer === this) {
            peer.peer = null;
            peer.close(reason);
        }
    }
}
