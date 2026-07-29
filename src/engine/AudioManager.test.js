import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from './AudioManager.js';

function createManager() {
    const gain = value => ({ gain: { value } });
    const manager = Object.create(AudioManager.prototype);
    manager.masterGain = gain(0.5);
    manager.musicGain = gain(0.4);
    manager.sfxGain = gain(0.6);
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
