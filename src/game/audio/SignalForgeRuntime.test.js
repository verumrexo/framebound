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

test('duplicating a saved sound creates independent recipe and audio records without changing bindings', async () => {
    const { runtime, calls } = createHarness();
    const source = {
        id: 'drone-shot',
        schemaVersion: 1,
        jfxrVersion: '0.13.0',
        name: 'drone shot',
        recipe: { frequency: 440, nested: { sweep: 2 } },
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        sampleRate: 44100,
        channels: 1,
        duration: .1,
        peak: .8,
        createdAt: '2026-01-01T00:00:00.000Z',
        modifiedAt: '2026-01-01T00:00:00.000Z'
    };
    runtime.sounds.set(source.id, source);
    runtime.bindings.set('part:drone_a:fire', source.id);

    const copy = await runtime.duplicateSound(source.id);

    assert.notEqual(copy.id, source.id);
    assert.equal(copy.name, 'drone shot copy');
    assert.deepEqual(copy.recipe, source.recipe);
    assert.notEqual(copy.recipe, source.recipe);
    assert.deepEqual(copy.wavBytes, source.wavBytes);
    assert.notEqual(copy.wavBytes, source.wavBytes);
    copy.recipe.nested.sweep = 99;
    copy.wavBytes[0] = 9;
    assert.equal(source.recipe.nested.sweep, 2);
    assert.equal(source.wavBytes[0], 1);
    assert.equal(runtime.getBinding('part:drone_a:fire'), source.id);
    assert.equal(runtime.sounds.get(copy.id), copy);
    assert.deepEqual(calls.filter(call => call[0] === 'putSound'), [['putSound', copy.id]]);
    assert.deepEqual(calls.filter(call => call[0] === 'replace').map(call => call[1]), [`forge:${copy.id}`]);
});

test('saving a new rendered sound without an id never reuses a shared library id', async () => {
    const { runtime } = createHarness();
    const source = {
        id: 'shared',
        schemaVersion: 1,
        jfxrVersion: '0.13.0',
        name: 'shared',
        recipe: { frequency: 220 },
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        sampleRate: 44100,
        channels: 1,
        duration: .1,
        peak: .5,
        createdAt: '2026-01-01T00:00:00.000Z',
        modifiedAt: '2026-01-01T00:00:00.000Z'
    };
    runtime.sounds.set(source.id, source);

    const created = await runtime.saveRendered({
        name: 'shared variant',
        recipe: { frequency: 330 },
        rendered: { jfxrVersion: '0.13.0', samples: new Float32Array([0, .2, 0]), wavBytes: new Uint8Array([5, 6, 7, 8]), sampleRate: 44100, duration: .1, peak: .4 }
    });

    assert.notEqual(created.id, source.id);
    assert.equal(runtime.sounds.get(source.id), source);
    assert.equal(runtime.sounds.get(created.id).name, 'shared variant');
});
