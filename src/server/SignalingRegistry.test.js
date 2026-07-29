import test from 'node:test';
import assert from 'node:assert/strict';
import { SignalingRegistry } from './SignalingRegistry.js';

test('signaling sessions expire and enforce guest caps', () => {
    let now = 1000;
    const registry = new SignalingRegistry({
        ttlMs: 100,
        maxGuests: 1,
        now: () => now,
        generateCode: () => 'ABC123'
    });

    assert.equal(registry.create('host').code, 'ABC123');
    assert.equal(registry.join('guest-a', 'abc123').hostId, 'host');
    assert.equal(registry.join('guest-b', 'ABC123'), null);

    now = 1200;
    assert.equal(registry.get('ABC123'), null);
});

test('signals only relay between a host and members of its session', () => {
    const registry = new SignalingRegistry({
        generateCode: () => 'ABC123'
    });
    registry.create('host');
    registry.join('guest-a', 'ABC123');
    registry.join('guest-b', 'ABC123');

    assert.deepEqual(
        registry.relay('guest-a', 'ABC123', 'host', {
            candidate: 'ice'
        }),
        {
            code: 'ABC123',
            fromId: 'guest-a',
            targetId: 'host',
            signal: { candidate: 'ice' }
        }
    );
    assert.equal(
        registry.relay('guest-a', 'ABC123', 'guest-b', { offer: 'fake' }),
        null
    );
    assert.equal(
        registry.relay('outsider', 'ABC123', 'host', { offer: 'fake' }),
        null
    );
});

test('host departure closes the code while guest departure preserves it', () => {
    const registry = new SignalingRegistry({
        generateCode: () => 'ABC123'
    });
    registry.create('host');
    registry.join('guest', 'ABC123');

    assert.deepEqual(registry.leave('guest'), [{
        code: 'ABC123',
        hostId: 'host',
        guestId: 'guest',
        closed: false
    }]);
    registry.join('guest', 'ABC123');
    assert.deepEqual(registry.leave('host'), [{
        code: 'ABC123',
        hostId: 'host',
        guests: ['guest'],
        closed: true
    }]);
    assert.equal(registry.get('ABC123'), null);
});

test('only the connected host can keep a session code alive', () => {
    let now = 100;
    const registry = new SignalingRegistry({
        ttlMs: 50,
        now: () => now,
        generateCode: () => 'ALIVE1'
    });
    registry.create('host');

    now = 140;
    assert.equal(registry.touch('outsider', 'ALIVE1'), false);
    assert.equal(registry.touch('host', 'ALIVE1'), true);
    now = 180;
    assert.equal(registry.get('ALIVE1')?.hostId, 'host');
});
