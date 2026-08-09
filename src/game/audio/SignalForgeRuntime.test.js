import test from 'node:test';
import assert from 'node:assert/strict';
import { SignalForgeRuntime } from './SignalForgeRuntime.js';

function createHarness(pack = { sounds: [], bindings: [], modifiedAt: null }) {
    const calls = [];
    const audio = {
        sounds: new Map(),
        context: {
            createBuffer(channels, length, sampleRate) {
                const data = new Float32Array(length);
                return { channels, length, sampleRate, getChannelData: () => data };
            }
        },
        async decodeAudioBytes() { return {}; },
        replace(name, buffer) { calls.push(['replace', name, buffer]); return true; },
        bindEvent(key, name) { calls.push(['bind', key, name]); return true; },
        unbindEvent(key) { calls.push(['unbind', key]); return true; },
        hasSound(name) { return this.sounds.has(name); },
        previewSound(name) { calls.push(['preview', name]); return this.sounds.has(name) ? {} : null; }
    };
    const store = {
        async loadPack() { return pack; },
        async putSound(record) { calls.push(['putSound', record.id]); },
        async putBinding(binding) { calls.push(['putBinding', binding.eventKey]); },
        async deleteBinding(key) { calls.push(['deleteBinding', key]); },
        async deleteSound(id) { calls.push(['deleteSound', id]); }
    };
    audio.remove = name => { calls.push(['remove', name]); return true; };
    const nativeBridge = {
        available: false,
        async loadCandidates() { return []; },
        async write() { return false; }
    };
    return { runtime: new SignalForgeRuntime(audio, { store, nativeBridge }), calls };
}

test('runtime restores persisted sound buffers before bindings', async () => {
    const record = { id: 'zap', wavBytes: new Uint8Array(64) };
    const { runtime, calls } = createHarness({
        sounds: [record],
        bindings: [{ eventKey: 'global:dash', soundId: 'zap' }]
    });

    await runtime.initialize();

    assert.equal(runtime.ready, true);
    assert.deepEqual(calls.map(call => call.slice(0, 2)), [
        ['replace', 'forge:zap'],
        ['bind', 'global:dash']
    ]);
});

test('runtime persists and applies bindings immediately', async () => {
    const { runtime, calls } = createHarness();
    runtime.sounds.set('zap', { id: 'zap' });

    await runtime.bind('part:gun_basic:fire', 'zap');
    await runtime.unbind('part:gun_basic:fire');

    assert.deepEqual(calls.map(call => call.slice(0, 2)), [
        ['putBinding', 'part:gun_basic:fire'],
        ['bind', 'part:gun_basic:fire'],
        ['deleteBinding', 'part:gun_basic:fire'],
        ['unbind', 'part:gun_basic:fire']
    ]);
});

test('deleting a forged sound removes its bindings and decoded buffer', async () => {
    const { runtime, calls } = createHarness();
    runtime.sounds.set('zap', { id: 'zap' });
    runtime.bindings.set('global:dash', 'zap');

    assert.equal(await runtime.deleteSound('zap'), true);
    assert.deepEqual(calls.map(call => call.slice(0, 2)), [
        ['deleteBinding', 'global:dash'],
        ['unbind', 'global:dash'],
        ['deleteSound', 'zap'],
        ['remove', 'forge:zap']
    ]);
});

test('event inspection distinguishes custom, packaged, and missing sounds', () => {
    const { runtime, calls } = createHarness();
    runtime.audio.sounds.set('dash', {});
    runtime.audio.sounds.set('forge:zap', {});
    runtime.sounds.set('zap', { id: 'zap', name: 'dash mk2' });
    runtime.bindings.set('global:dash', 'zap');

    assert.equal(runtime.inspectEvent('global:dash', 'dash').status, 'custom');
    assert.equal(runtime.previewEvent('global:dash', 'dash'), true);
    runtime.bindings.delete('global:dash');
    assert.equal(runtime.inspectEvent('global:dash', 'dash').status, 'default');
    assert.equal(runtime.inspectEvent('global:respawn', 'respawn').status, 'missing');
    assert.equal(runtime.previewEvent('global:respawn', 'respawn'), false);
    assert.equal(runtime.previewSaved('zap'), true);
    assert.deepEqual(calls.filter(call => call[0] === 'preview'), [
        ['preview', 'forge:zap'],
        ['preview', 'forge:zap']
    ]);
});
