import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DataChannelTransport,
    WebRtcPeerLink
} from './WebRtcPeerLink.js';

class FakeChannel {
    constructor(label = 'framebound-control') {
        this.label = label;
        this.readyState = 'connecting';
        this.bufferedAmount = 0;
        this.sent = [];
    }

    send(value) {
        this.sent.push(value);
    }

    open() {
        this.readyState = 'open';
        this.onopen?.({});
    }

    receive(value) {
        this.onmessage?.({ data: value });
    }

    close() {
        this.readyState = 'closed';
        this.onclose?.({});
    }
}

class FakePeerConnection {
    constructor(configuration) {
        this.configuration = configuration;
        this.connectionState = 'new';
        this.channel = null;
        this.localDescription = null;
        this.remoteDescription = null;
        this.candidates = [];
    }

    createDataChannel(label) {
        this.channel = new FakeChannel(label);
        return this.channel;
    }

    async createOffer() {
        return { type: 'offer', sdp: 'offer-sdp' };
    }

    async createAnswer() {
        return { type: 'answer', sdp: 'answer-sdp' };
    }

    async setLocalDescription(description) {
        this.localDescription = description;
    }

    async setRemoteDescription(description) {
        this.remoteDescription = description;
    }

    async addIceCandidate(candidate) {
        this.candidates.push(candidate);
    }

    close() {
        this.connectionState = 'closed';
    }
}

test('data-channel transport delivers strings and applies backpressure', () => {
    const channel = new FakeChannel();
    const transport = new DataChannelTransport(channel);
    const messages = [];
    transport.onMessage(value => messages.push(value));

    assert.equal(transport.send('early'), false);
    channel.open();
    assert.equal(transport.send('ready'), true);
    channel.receive('host-state');
    assert.deepEqual(channel.sent, ['ready']);
    assert.deepEqual(messages, ['host-state']);

    channel.bufferedAmount = 1_000_001;
    assert.equal(transport.send('overflow'), false);
});

test('data-channel send races fail closed instead of escaping gameplay', () => {
    const channel = new FakeChannel();
    const transport = new DataChannelTransport(channel);
    const reasons = [];
    transport.onClose(reason => reasons.push(reason));
    channel.open();
    channel.send = () => {
        throw new Error('channel closed during send');
    };

    assert.equal(transport.send('snapshot'), false);
    assert.equal(transport.readyState, 'closed');
    assert.deepEqual(reasons, ['channel_send_failed']);
    assert.equal(transport.send('again'), false);
});

test('initiator creates a reliable channel, offer, and ice signals', async () => {
    const link = new WebRtcPeerLink({
        RTCPeerConnectionClass: FakePeerConnection,
        initiator: true
    });
    const signals = [];
    link.onSignal = signal => signals.push(signal);

    assert.equal(link.peerConnection.channel.label, 'framebound-control');
    assert.deepEqual(await link.createOffer(), {
        description: { type: 'offer', sdp: 'offer-sdp' }
    });
    link.peerConnection.onicecandidate({
        candidate: { toJSON: () => ({ candidate: 'ice-a' }) }
    });
    assert.deepEqual(signals, [{ candidate: { candidate: 'ice-a' } }]);
});

test('unexpected channel closure reaches the reconnect state owner', () => {
    const link = new WebRtcPeerLink({
        RTCPeerConnectionClass: FakePeerConnection,
        initiator: true
    });
    const states = [];
    link.onStateChange = state => states.push(state);

    link.peerConnection.channel.close();

    assert.deepEqual(states, ['disconnected']);
});

test('guest accepts an offer, answers, and adds later ice candidates', async () => {
    const link = new WebRtcPeerLink({
        RTCPeerConnectionClass: FakePeerConnection,
        initiator: false
    });

    assert.deepEqual(await link.acceptSignal({
        description: { type: 'offer', sdp: 'offer-sdp' }
    }), {
        description: { type: 'answer', sdp: 'answer-sdp' }
    });
    await link.acceptSignal({
        candidate: { candidate: 'ice-b' }
    });

    assert.deepEqual(link.peerConnection.remoteDescription, {
        type: 'offer',
        sdp: 'offer-sdp'
    });
    assert.deepEqual(link.peerConnection.candidates, [{
        candidate: 'ice-b'
    }]);
});

test('ice candidates arriving before the remote description are queued', async () => {
    const link = new WebRtcPeerLink({
        RTCPeerConnectionClass: FakePeerConnection,
        initiator: false
    });

    await link.acceptSignal({
        candidate: { candidate: 'early-ice' }
    });
    assert.deepEqual(link.peerConnection.candidates, []);

    await link.acceptSignal({
        description: { type: 'offer', sdp: 'offer-sdp' }
    });
    assert.deepEqual(link.peerConnection.candidates, [{
        candidate: 'early-ice'
    }]);
});
