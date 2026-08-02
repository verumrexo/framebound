import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from './Settings.js';

test('settings ui cleanup stops and forgets its background animation timer', (t) => {
    const cleared = [];
    const cancelledSetups = [];
    t.mock.method(globalThis, 'clearInterval', timer => cleared.push(timer));
    t.mock.method(
        globalThis,
        'clearTimeout',
        timer => cancelledSetups.push(timer)
    );

    const settings = Object.create(Settings.prototype);
    settings.updateInterval = 42;
    settings.setupTimeout = 17;

    settings.stopUpdating();
    settings.stopUpdating();

    assert.deepEqual(cleared, [42]);
    assert.deepEqual(cancelledSetups, [17]);
    assert.equal(settings.updateInterval, null);
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
            damageNumberMode: '<script>'
        })]
    ]);
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null
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
        assert.equal(settings.sliderStates.cursorThickness.current, 10);
        assert.equal(settings.sliderStates.cursorLength.current, 5);
        assert.equal(settings.sliderStates.cursorGap.current, 3);
    } finally {
        globalThis.localStorage = originalStorage;
    }
});
