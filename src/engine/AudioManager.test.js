import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from './AudioManager.js';

function createManager() {
    const gain = value => ({ gain: { value } });
    const manager = Object.create(AudioManager.prototype);
    manager.masterGain = gain(0.5);
    manager.musicGain = gain(0.4);
    manager.sfxGain = gain(0.6);
    manager.sounds = new Map();
    manager.defaultSounds = new Map();
    manager.eventBindings = new Map();
    manager.missingSoundWarnings = new Set();
    manager.recentPlays = new Map();
    return manager;
}

test('audio settings ignore invalid values and clamp valid stored volumes', (t) => {
    const originalStorage = globalThis.localStorage;
    const values = new Map([
        ['settings_volume_master', '2'],
        ['settings_volume_music', 'not-a-number'],
        ['settings_volume_sfx', '-1']
    ]);
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null
    };

    try {
        const manager = createManager();
        manager.loadSettings();

        assert.equal(manager.masterGain.gain.value, 1);
        assert.equal(manager.musicGain.gain.value, 0.4);
        assert.equal(manager.sfxGain.gain.value, 0);
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('blocked audio storage never crashes startup or volume changes', (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem() {
            throw new Error('storage blocked');
        },
        setItem() {
            throw new Error('storage blocked');
        }
    };
    t.mock.method(console, 'warn', () => {});

    try {
        const manager = createManager();
        assert.doesNotThrow(() => manager.loadSettings());
        assert.doesNotThrow(() => manager.saveVolume('volume', 0.5));
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('event bindings hot-swap a semantic event without replacing its fallback', () => {
    const manager = createManager();
    const fallback = {};
    const custom = {};
    manager.sounds.set('dash', fallback);
    manager.sounds.set('forge:dash-1', custom);

    assert.equal(manager.bindEvent('global:dash', 'forge:dash-1'), true);
    assert.equal(manager.getEventBinding('global:dash'), 'forge:dash-1');
    assert.equal(manager.sounds.get('dash'), fallback);
    assert.equal(manager.unbindEvent('global:dash'), true);
    assert.equal(manager.getEventBinding('global:dash'), null);
});

test('replace and restore default preserve the packaged buffer', () => {
    const manager = createManager();
    const packaged = {};
    const replacement = {};
    manager.sounds.set('hit', packaged);
    manager.defaultSounds.set('hit', packaged);

    assert.equal(manager.replace('hit', replacement), true);
    assert.equal(manager.sounds.get('hit'), replacement);
    assert.equal(manager.restoreDefault('hit'), true);
    assert.equal(manager.sounds.get('hit'), packaged);
});

test('sound inspection and named preview use the loaded buffer', (t) => {
    const manager = createManager();
    const buffer = {};
    manager.sounds.set('dash', buffer);
    t.mock.method(manager, 'preview', audioBuffer => audioBuffer);

    assert.equal(manager.hasSound('dash'), true);
    assert.equal(manager.hasSound('missing'), false);
    assert.equal(manager.previewSound('dash'), buffer);
    assert.equal(manager.previewSound('missing'), undefined);
});
