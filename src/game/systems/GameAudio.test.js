import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GAME_SOUNDS,
    hasLoadedSound,
    loadGameSounds
} from './GameAudio.js';

test('game sound manifest keeps unique names', () => {
    const names = GAME_SOUNDS.map(({ name }) => name);

    assert.equal(new Set(names).size, names.length);
});

test('loadGameSounds loads the manifest sequentially', async () => {
    const loaded = [];
    const audio = {
        async load(name, url) {
            loaded.push({ name, url });
        }
    };

    await loadGameSounds(audio);

    assert.deepEqual(loaded, GAME_SOUNDS);
});

test('loaded-sound checks support the real map and lightweight object mocks', () => {
    assert.equal(
        hasLoadedSound({ sounds: new Map([['shield_hit', {}]]) }, 'shield_hit'),
        true
    );
    assert.equal(
        hasLoadedSound({ sounds: { respawn: {} } }, 'respawn'),
        true
    );
    assert.equal(
        hasLoadedSound({ sounds: new Map() }, 'shield_hit'),
        false
    );
});
