import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DevTools, shouldShowPartLabButton } from './DevTools.js';

test('authenticated devtools remain available while part lab stays dev-only', () => {
    assert.equal(shouldShowPartLabButton({ isDevelopment: true }), true);
    assert.equal(shouldShowPartLabButton({ isDevelopment: false }), false);
    assert.equal(shouldShowPartLabButton({}), false);
});

test('devtools authentication storage fails closed without crashing startup', (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem() {
            throw new Error('storage blocked');
        },
        setItem() {
            throw new Error('storage blocked');
        },
        removeItem() {
            throw new Error('storage blocked');
        }
    };
    t.mock.method(console, 'warn', () => {});

    try {
        const tools = Object.create(DevTools.prototype);
        assert.equal(tools.loadAuthentication(), false);
        assert.equal(tools.persistAuthentication(true), false);
        assert.equal(tools.persistAuthentication(false), false);
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('devtools authentication only accepts the exact persisted marker', () => {
    const originalStorage = globalThis.localStorage;
    const values = new Map([['fb_dev_auth', 'true']]);
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };

    try {
        const tools = Object.create(DevTools.prototype);
        assert.equal(tools.loadAuthentication(), true);
        assert.equal(tools.persistAuthentication(false), true);
        assert.equal(tools.loadAuthentication(), false);
    } finally {
        globalThis.localStorage = originalStorage;
    }
});

test('devtools run reset removes active cheats but preserves authentication', () => {
    const tools = Object.create(DevTools.prototype);
    Object.assign(tools, {
        authenticated: true,
        active: true,
        keypadActive: true,
        keypadEntry: '2519',
        spawnAmount: 100,
        pendingSpawnAction: () => {},
        placementMode: true,
        showHitboxes: true,
        freezeEnemies: true,
        debugToggleInputs: {
            showHitboxes: { checked: true },
            freezeEnemies: { checked: true }
        },
        spawnAmountSlider: { value: '50' },
        spawnAmountLabel: { innerText: 'spawn amount: 50' },
        ui: { style: { display: 'block' } },
        keypadUI: { style: { display: 'flex' } }
    });

    tools.resetRunState();

    assert.equal(tools.authenticated, true);
    assert.equal(tools.active, false);
    assert.equal(tools.keypadActive, false);
    assert.equal(tools.pendingSpawnAction, null);
    assert.equal(tools.placementMode, false);
    assert.equal(tools.showHitboxes, false);
    assert.equal(tools.freezeEnemies, false);
    assert.equal(tools.debugToggleInputs.showHitboxes.checked, false);
    assert.equal(tools.debugToggleInputs.freezeEnemies.checked, false);
    assert.equal(tools.spawnAmountSlider.value, '1');
    assert.equal(tools.spawnAmountLabel.innerText, 'spawn amount: 1');
    assert.equal(tools.ui.style.display, 'none');
    assert.equal(tools.keypadUI.style.display, 'none');
});

test('devtools keypad binds controls without csp-blocked inline handlers', () => {
    const calls = [];
    const buttons = ['1', 'X'].map(devKey => ({
        dataset: { devKey },
        addEventListener(type, listener) {
            assert.equal(type, 'click');
            this.click = listener;
        }
    }));
    const abort = {
        addEventListener(type, listener) {
            assert.equal(type, 'click');
            this.click = listener;
        }
    };
    const tools = Object.create(DevTools.prototype);
    Object.assign(tools, {
        keypadEntry: '',
        keypadUI: {
            style: {},
            innerHTML: '',
            querySelectorAll: () => buttons,
            querySelector: () => abort
        },
        handleKeypadInput: key => calls.push(['key', key]),
        hideKeypad: () => calls.push(['abort'])
    });

    tools.renderKeypad();

    assert.doesNotMatch(tools.keypadUI.innerHTML, /\sonclick\s*=/i);
    buttons[0].click();
    buttons[1].click();
    abort.click();
    assert.deepEqual(calls, [
        ['key', '1'],
        ['key', 'X'],
        ['abort']
    ]);
});
