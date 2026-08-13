import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from './Settings.js';

test('settings ui cleanup cancels pending setup before it can bind controls', (t) => {
    const cancelledSetups = [];
    t.mock.method(
        globalThis,
        'clearTimeout',
        timer => cancelledSetups.push(timer)
    );

    const settings = Object.create(Settings.prototype);
    settings.setupTimeout = 17;

    settings.stopUpdating();
    settings.stopUpdating();

    assert.deepEqual(cancelledSetups, [17]);
    assert.equal(settings.setupTimeout, null);
});

test('stored settings reject markup and clamp malformed numeric values', (t) => {
    const originalStorage = globalThis.localStorage;
    const values = new Map([
        ['framebound_cursor_settings', JSON.stringify({
            shape: '"><img src=x>',
            thickness: 999,
            length: -50,
            gap: 'wide',
            color: '" onfocus="alert(1)',
            outline: 'yes'
        })],
        ['framebound_game_settings', JSON.stringify({
            showDamageNumbers: 'yes',
            damageNumberMode: '<script>',
            eyeCandy: 'absolutely',
            rasterScale: 99,
            showFps: 'sometimes'
        })]
    ]);
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: () => {}
    };

    try {
        const game = {};
        const settings = new Settings(game);

        assert.deepEqual(game.cursorSettings, {
            shape: '4-lines',
            thickness: 10,
            length: 5,
            gap: 3,
            color: '#00ffff',
            outline: true
        });
        assert.equal(game.showDamageNumbers, true);
        assert.equal(game.damageNumberMode, 'singular');
        assert.equal(game.eyeCandy, true);
        assert.equal(game.rasterScale, 2);
        assert.equal(game.showFps, true);
        assert.equal(settings.sliderStates.cursorThickness.current, 10);
        assert.equal(settings.sliderStates.cursorLength.current, 5);
        assert.equal(settings.sliderStates.cursorGap.current, 3);
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('eye candy can be disabled and remains a strict boolean', () => {
    const settings = Object.create(Settings.prototype);
    settings.defaults = {
        showDamageNumbers: true,
        damageNumberMode: 'singular',
        eyeCandy: true
    };

    assert.equal(settings.normalizeGameSettings({ eyeCandy: false }).eyeCandy, false);
    assert.equal(settings.normalizeGameSettings({ eyeCandy: 0 }).eyeCandy, true);
});

test('eye candy is persisted with the other game settings', () => {
    const originalStorage = globalThis.localStorage;
    let saved = null;
    globalThis.localStorage = {
        setItem: (key, value) => { saved = [key, JSON.parse(value)]; }
    };

    try {
        const settings = Object.create(Settings.prototype);
        settings.game = {
            showDamageNumbers: true,
            damageNumberMode: 'singular',
            eyeCandy: false
        };
        settings.saveGameSettings();

        assert.deepEqual(saved, [
            'framebound_game_settings',
            {
                showDamageNumbers: true,
                damageNumberMode: 'singular',
                eyeCandy: false,
                rasterScale: 2,
                showFps: true
            }
        ]);
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('game settings always normalize gameplay raster scale to the fixed 2x mode', () => {
    const settings = Object.create(Settings.prototype);
    settings.defaults = {
        showDamageNumbers: true,
        damageNumberMode: 'singular',
        eyeCandy: true,
        rasterScale: 3,
        showFps: true
    };

    assert.deepEqual(settings.normalizeGameSettings({ rasterScale: 1, showFps: false }), {
        showDamageNumbers: true,
        damageNumberMode: 'singular',
        eyeCandy: true,
        rasterScale: 2,
        showFps: false
    });
    assert.deepEqual(settings.normalizeGameSettings({}), {
        showDamageNumbers: true,
        damageNumberMode: 'singular',
        eyeCandy: true,
        rasterScale: 2,
        showFps: true
    });
    assert.equal(settings.normalizeGameSettings({ rasterScale: 2.5 }).rasterScale, 2);
});

test('stored 1x, 3x, and invalid gameplay scales migrate to 2x', () => {
    const originalStorage = globalThis.localStorage;
    try {
        for (const storedScale of [1, 3, 99]) {
            const migrated = [];
            globalThis.localStorage = {
                getItem: key => key === 'framebound_game_settings'
                    ? JSON.stringify({ rasterScale: storedScale })
                    : null,
                setItem: (key, value) => migrated.push([key, JSON.parse(value)])
            };

            const game = {};
            new Settings(game);
            assert.equal(game.rasterScale, 2);
            assert.equal(migrated[0][1].rasterScale, 2);
        }
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('settings markup exposes fixed gameplay scale without selector controls', () => {
    const settings = Object.create(Settings.prototype);
    settings.game = {
        rasterScale: 2,
        cursorSettings: {
            shape: '4-lines', thickness: 2, length: 15, gap: 3,
            color: '#00ffff', outline: true
        },
        audio: {
            masterGain: { gain: { value: 0.8 } },
            musicGain: { gain: { value: 0.4 } },
            sfxGain: { gain: { value: 0.6 } }
        }
    };
    settings.defaults = {
        masterVolume: 0.8, musicVolume: 0.4, sfxVolume: 0.6,
        rasterScale: 2, showFps: true, cursorShape: '4-lines', cursorThickness: 2,
        cursorLength: 15, cursorGap: 3, cursorColor: '#00ffff', cursorOutline: true,
        showDamageNumbers: true, damageNumberMode: 'singular', eyeCandy: true
    };
    settings.sliderStates = {
        master: { current: 80, target: 80 }, music: { current: 40, target: 40 },
        sfx: { current: 60, target: 60 }, cursorThickness: { current: 2, target: 2 },
        cursorLength: { current: 15, target: 15 }, cursorGap: { current: 3, target: 3 }
    };

    const overlay = { innerHTML: '' };
    settings.render(overlay, () => {});
    assert.match(overlay.innerHTML, /2x fixed/);
    assert.match(overlay.innerHTML, /developer visual proofs/);
    assert.doesNotMatch(overlay.innerHTML, /data-raster-scale/);
    assert.doesNotMatch(overlay.innerHTML, /raster-options/);
    settings.stopUpdating();
});
