import test from 'node:test';
import assert from 'node:assert/strict';
import {
    newestSignalForgePack,
    parseSignalForgePack,
    serializeSignalForgePack
} from './SignalForgePack.js';
import { loadPromotedSignalForgePack } from './SignalForgePack.js';

const sound = {
    id: 'zap',
    schemaVersion: 1,
    jfxrVersion: '0.13.0',
    recipe: { _version: 1 },
    wavBytes: new Uint8Array(64),
    duration: 0.1,
    peak: 1
};

test('native sound packs preserve recipes, wav bytes, and bindings', () => {
    const original = {
        modifiedAt: '2026-08-03T12:00:00.000Z',
        sounds: [sound],
        bindings: [{ eventKey: 'global:dash', soundId: 'zap' }]
    };
    const parsed = parseSignalForgePack(serializeSignalForgePack(original));

    assert.deepEqual(parsed.sounds[0].wavBytes, sound.wavBytes);
    assert.deepEqual(parsed.bindings, original.bindings);
});

test('native sound packs reject dangling bindings and pick the newest valid copy', () => {
    const older = { modifiedAt: '2026-08-03T12:00:00.000Z' };
    const newer = { modifiedAt: '2026-08-03T13:00:00.000Z' };
    assert.equal(newestSignalForgePack([older, newer]), newer);

    const raw = serializeSignalForgePack({
        modifiedAt: newer.modifiedAt,
        sounds: [sound],
        bindings: [{ eventKey: 'global:dash', soundId: 'missing' }]
    });
    assert.throws(() => parseSignalForgePack(raw), /dangling binding/);
});

test('promoted packs load fixed local wav paths and bind before local overrides', async () => {
    const calls = [];
    const audio = {
        async load(name, asset) { calls.push(['load', name, asset]); },
        bindEvent(key, name) { calls.push(['bind', key, name]); return true; }
    };
    await loadPromotedSignalForgePack(audio, async () => ({
        ok: true,
        async json() {
            return {
                version: 1,
                sounds: [{ id: 'zap', asset: './generated-sounds/zap.wav' }],
                bindings: [{ eventKey: 'global:dash', soundId: 'zap' }]
            };
        }
    }));
    assert.deepEqual(calls, [
        ['load', 'forge:zap', './generated-sounds/zap.wav'],
        ['bind', 'global:dash', 'forge:zap']
    ]);
});

test('spa fallback html is treated as an absent promoted pack', async () => {
    const audio = {};
    const result = await loadPromotedSignalForgePack(audio, async () => ({
        ok: true,
        headers: { get: () => 'text/html; charset=utf-8' },
        async json() { throw new Error('html is not json'); }
    }));

    assert.equal(result, null);
});
