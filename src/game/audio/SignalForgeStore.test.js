import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SIGNAL_FORGE_SCHEMA_VERSION,
    validateForgeBinding,
    validateForgeSound
} from './SignalForgeStore.js';

function validSound(overrides = {}) {
    return {
        id: 'laser-zap',
        schemaVersion: SIGNAL_FORGE_SCHEMA_VERSION,
        jfxrVersion: '0.13.0',
        recipe: { _version: 1, sustain: 0.1 },
        wavBytes: new Uint8Array(64),
        duration: 0.1,
        peak: 0.9,
        ...overrides
    };
}

test('forge sound validation accepts a bounded pinned recipe', () => {
    assert.equal(validateForgeSound(validSound()).id, 'laser-zap');
});

test('forge sound validation rejects unsafe ids and excessive duration', () => {
    assert.throws(() => validateForgeSound(validSound({ id: '../zap' })), /invalid sound id/);
    assert.throws(() => validateForgeSound(validSound({ duration: 99 })), /invalid sound duration/);
});

test('forge binding validation accepts semantic global and part keys', () => {
    assert.equal(validateForgeBinding({ eventKey: 'global:dash', soundId: 'zap' }).eventKey, 'global:dash');
    assert.equal(validateForgeBinding({ eventKey: 'part:gun_basic:fire', soundId: 'zap' }).eventKey, 'part:gun_basic:fire');
    assert.throws(() => validateForgeBinding({ eventKey: '../dash', soundId: 'zap' }), /invalid event key/);
});
