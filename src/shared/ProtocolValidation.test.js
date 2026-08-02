import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FixedWindowRateLimiter,
    normalizeAngle,
    sanitizeLobbyName,
    sanitizePlayerInput,
    sanitizePlayerShot,
    sanitizeRoomId,
    sanitizeShipManifest
} from './ProtocolValidation.js';

const partsLibrary = {
    core: {},
    gun_basic: {}
};

test('player input rejects malformed and non-finite payloads', () => {
    assert.equal(sanitizePlayerInput(null), null);
    assert.equal(sanitizePlayerInput({ up: 'yes' }), null);
    assert.equal(sanitizePlayerInput({ analogX: Infinity }), null);
    assert.equal(sanitizePlayerInput({ analogY: 2 }), null);
    assert.equal(sanitizePlayerInput({ aimAngle: 1e308 })?.aimAngle, normalizeAngle(1e308));
});

test('player input keeps the existing valid control shape', () => {
    assert.deepEqual(sanitizePlayerInput({
        up: true,
        down: false,
        left: false,
        right: true,
        shift: true,
        analogX: 0.25,
        analogY: -0.5,
        aimAngle: null
    }), {
        up: true,
        down: false,
        left: false,
        right: true,
        shift: true,
        analogX: 0.25,
        analogY: -0.5,
        aimAngle: null
    });
});

test('shots require finite bounded coordinates and normalize angles in constant time', () => {
    assert.equal(sanitizePlayerShot(null), null);
    assert.equal(sanitizePlayerShot({ partId: 'gun_basic', x: NaN, y: 0, angle: 0 }), null);
    assert.equal(sanitizePlayerShot({ partId: 'gun_basic', x: 0, y: Infinity, angle: 0 }), null);

    assert.deepEqual(sanitizePlayerShot({
        partId: 'gun_basic',
        x: 10,
        y: 20,
        angle: Math.PI * 5
    }), {
        partId: 'gun_basic',
        x: 10,
        y: 20,
        angle: -Math.PI
    });
});

test('ship manifests reject unknown, oversized, and coreless layouts', () => {
    assert.equal(sanitizeShipManifest(null, partsLibrary), null);
    assert.equal(sanitizeShipManifest({ parts: [] }, partsLibrary), null);
    assert.equal(sanitizeShipManifest({
        parts: [{ x: 0, y: 0, partId: 'made_up', rotation: 0 }]
    }, partsLibrary), null);
    assert.equal(sanitizeShipManifest({
        parts: [{ x: 1, y: 0, partId: 'gun_basic', rotation: 0 }]
    }, partsLibrary), null);
});

test('ship manifests preserve valid part data', () => {
    assert.deepEqual(sanitizeShipManifest({
        parts: [
            { x: 0, y: 0, partId: 'core', rotation: 0 },
            { x: 1, y: 0, partId: 'gun_basic', rotation: 1 }
        ]
    }, partsLibrary), [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: 1, y: 0, partId: 'gun_basic', rotation: 1 }
    ]);
});

test('fixed-window rate limiting resets after its window', () => {
    const limiter = new FixedWindowRateLimiter();

    assert.equal(limiter.allow('shoot', 2, 1000, 0), true);
    assert.equal(limiter.allow('shoot', 2, 1000, 10), true);
    assert.equal(limiter.allow('shoot', 2, 1000, 20), false);
    assert.equal(limiter.allow('shoot', 2, 1000, 1000), true);
});

test('lobby names and room ids are bounded and normalized', () => {
    assert.equal(sanitizeLobbyName('  good\nsector  '), 'good sector');
    assert.equal(sanitizeLobbyName('x'.repeat(100)).length, 40);
    assert.equal(sanitizeLobbyName(' \n '), null);
    assert.equal(sanitizeRoomId(' ab12cd '), 'AB12CD');
    assert.equal(sanitizeRoomId('not-a-room'), null);
});
