import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createAction,
    createInput,
    decodePeerMessage,
    encodePeerMessage,
    PEER_PROTOCOL_VERSION
} from './PeerProtocol.js';

test('peer protocol accepts bounded versioned input and normalizes aim', () => {
    const input = decodePeerMessage(createInput(1, {
        up: true,
        down: false,
        left: false,
        right: true,
        shift: false,
        analogX: 0.5,
        analogY: -0.5,
        aimAngle: Math.PI * 5
    }), { direction: 'client' });

    assert.equal(input.version, PEER_PROTOCOL_VERSION);
    assert.equal(input.sequence, 1);
    assert.equal(input.input.up, true);
    assert.equal(input.input.aimAngle, -Math.PI);
});

test('shoot requests contain intent but cannot claim position, damage, or rewards', () => {
    const action = decodePeerMessage(createAction(2, 'shoot', {
        aimAngle: 0.5,
        active: true,
        x: 999,
        damage: 999999,
        reward: 'free gold'
    }), { direction: 'client' });

    assert.deepEqual(action.payload, {
        aimAngle: 0.5,
        active: true
    });
    assert.equal(Object.hasOwn(action.payload, 'damage'), false);
    assert.equal(Object.hasOwn(action.payload, 'x'), false);
    assert.equal(Object.hasOwn(action.payload, 'reward'), false);
});

test('level-up requests can only choose one of the offered cards', () => {
    const action = decodePeerMessage(
        createAction(3, 'level_up', {
            index: 2,
            stat: 'free_everything'
        }),
        { direction: 'client' }
    );

    assert.deepEqual(action.payload, { index: 2 });
    assert.throws(() => createAction(4, 'level_up', { index: 3 }));
});

test('wrong versions, directions, malformed state, and huge packets are rejected', () => {
    assert.equal(decodePeerMessage(JSON.stringify({
        version: 999,
        type: 'input',
        sequence: 1,
        input: {}
    })), null);
    assert.equal(decodePeerMessage(encodePeerMessage('welcome', {
        peerId: 'peer',
        tick: 0,
        resumeToken: 'token'
    }), { direction: 'client' }), null);
    assert.equal(decodePeerMessage(
        '{"version":1,"type":"snapshot","tick":0,"ack":0,"state":{"x":1e999}}',
        { direction: 'host' }
    ), null);
    assert.equal(decodePeerMessage('x'.repeat(1_000_001)), null);
});

test('host events use the documented authoritative event vocabulary', () => {
    assert.equal(decodePeerMessage(encodePeerMessage('event', {
        tick: 1,
        eventId: '1_1',
        eventType: 'reward',
        payload: { gold: 10 }
    }), { direction: 'host' }).eventType, 'reward');
    assert.equal(decodePeerMessage(encodePeerMessage('event', {
        tick: 1,
        eventId: '1_2',
        eventType: 'free_gold_lol',
        payload: { gold: 999999 }
    }), { direction: 'host' }), null);
});
