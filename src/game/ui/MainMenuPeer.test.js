import '../../tests/setup.js';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

mock.module('@supabase/supabase-js', {
    namedExports: {
        createClient: () => ({})
    }
});

const { MainMenu } = await import('./MainMenu.js');

function createHarness() {
    const calls = [];
    const peerNetwork = {
        role: null,
        host() {
            this.role = 'host';
            calls.push(['host']);
            return true;
        },
        join(code) {
            this.role = 'guest';
            calls.push(['join', code]);
            return true;
        },
        disconnect() {
            calls.push(['disconnect']);
            this.role = null;
        }
    };
    const game = {
        running: false,
        paused: false,
        peerNetwork,
        startOffline: () => {
            calls.push(['startOffline']);
            game.running = true;
            return true;
        },
        audio: {
            context: {
                state: 'suspended',
                resume: () => calls.push(['resume-audio'])
            },
            playMusic: (...args) => calls.push(['music', ...args])
        },
        loop: {
            start: () => calls.push(['loop-start'])
        }
    };
    const menu = new MainMenu(game);
    menu.overlay = {
        style: {},
        remove: () => calls.push(['remove-overlay'])
    };
    menu.renderMenu = () => calls.push(['render-menu']);
    return { calls, game, menu, peerNetwork };
}

test('host creates a paused run and starts only after a peer is ready', (t) => {
    const { calls, game, menu, peerNetwork } = createHarness();
    t.mock.method(globalThis, 'setTimeout', callback => {
        callback();
        return 1;
    });

    assert.equal(menu.beginPeerHost(), true);
    assert.equal(game.paused, true);
    assert.equal(menu.peerStartPending, true);
    assert.deepEqual(calls, [
        ['startOffline'],
        ['host']
    ]);

    peerNetwork.onReady({ role: 'host', peerId: 'guest_1' });

    assert.equal(game.paused, false);
    assert.equal(menu.peerStartPending, false);
    assert.equal(menu.overlay, null);
    assert.deepEqual(calls, [
        ['startOffline'],
        ['host'],
        ['resume-audio'],
        ['loop-start'],
        ['music', 'bgm', 0.4],
        ['remove-overlay']
    ]);
});

test('failed hosting releases the provisional paused run', () => {
    const { calls, game, menu, peerNetwork } = createHarness();
    const statuses = [];
    peerNetwork.host = () => false;
    menu.updatePeerStatus = (...args) => statuses.push(args);

    assert.equal(menu.beginPeerHost(), false);
    assert.equal(menu.peerStartPending, false);
    assert.equal(game.running, false);
    assert.equal(game.paused, false);
    assert.deepEqual(calls, [['startOffline']]);
    assert.deepEqual(statuses.at(-1), [
        'error',
        'could not create online session'
    ]);
});

test('online menu renders only the p2p host and join-code flow', (t) => {
    const { menu } = createHarness();
    global.document.getElementById = () => null;
    t.after(() => {
        delete global.document.getElementById;
    });
    t.mock.method(globalThis, 'setTimeout', callback => {
        callback();
        return 1;
    });

    menu.renderOnlinePlay();

    assert.match(menu.overlay.innerHTML, /host game/);
    assert.match(menu.overlay.innerHTML, /join game/);
    assert.match(menu.overlay.innerHTML, /input-peer-code/);
    assert.doesNotMatch(menu.overlay.innerHTML, /online lobbies/);
    assert.doesNotMatch(menu.overlay.innerHTML, /direct connect/);
    assert.doesNotMatch(menu.overlay.innerHTML, /<style/);
    assert.match(
        readFileSync(new URL('../../style.css', import.meta.url), 'utf8'),
        /\.menu-btn,\s*\.pause-btn/
    );
    assert.equal(MainMenu.prototype.renderLobbyBrowser, undefined);
});

test('guest validates the short code and waits for authoritative resync', (t) => {
    const { calls, game, menu, peerNetwork } = createHarness();
    t.mock.method(globalThis, 'setTimeout', callback => {
        callback();
        return 1;
    });

    assert.equal(menu.beginPeerJoin('ab-c12!3'), true);
    assert.equal(menu.peerStartPending, true);
    assert.deepEqual(calls, [
        ['join', 'ABC123']
    ]);

    peerNetwork.onReady({ role: 'guest', state: {} });

    assert.equal(game.paused, false);
    assert.equal(menu.peerStartPending, false);
    assert.deepEqual(calls, [
        ['join', 'ABC123'],
        ['resume-audio'],
        ['loop-start'],
        ['music', 'bgm', 0.4],
        ['remove-overlay']
    ]);
});

test('invalid join codes and online-menu back do not leave a live session', () => {
    const { calls, game, menu } = createHarness();

    assert.equal(menu.beginPeerJoin('bad'), false);
    assert.equal(menu.peerStartPending, false);

    game.running = true;
    game.paused = true;
    menu.cancelPeerSession();

    assert.equal(game.running, false);
    assert.equal(game.paused, false);
    assert.deepEqual(calls, [
        ['disconnect'],
        ['render-menu']
    ]);
});

test('patch notes render every historical entry in lowercase', (t) => {
    const { menu } = createHarness();
    global.document.getElementById = () => null;
    t.after(() => {
        delete global.document.getElementById;
    });
    t.mock.method(globalThis, 'setTimeout', callback => {
        callback();
        return 1;
    });

    menu.renderChangelog();

    assert.doesNotMatch(menu.overlay.innerHTML, /[A-Z]/);
    assert.match(menu.overlay.innerHTML, /dead players spectate living teammates/);
    assert.match(menu.overlay.innerHTML, /resurrect immediately when the boss dies/);
    assert.match(menu.overlay.innerHTML, /class="changelog-scroll"/);
    assert.match(menu.overlay.innerHTML, /tabindex="0"/);
    assert.match(menu.overlay.innerHTML, /aria-label="patch notes history"/);
});

test('fading an old menu cannot block a new main menu', (t) => {
    const { calls, menu } = createHarness();
    let finishFade;
    t.mock.method(globalThis, 'setTimeout', callback => {
        finishFade = callback;
        return 1;
    });

    const oldOverlay = menu.overlay;
    assert.equal(menu.dismissOverlay(), true);
    assert.equal(menu.overlay, null);

    menu.show();
    const newOverlay = menu.overlay;
    assert.notEqual(newOverlay, oldOverlay);

    finishFade();
    assert.equal(menu.overlay, newOverlay);
    assert.deepEqual(calls, [
        ['render-menu'],
        ['remove-overlay']
    ]);
});

test('seed keypad binds controls without csp-blocked inline handlers', (t) => {
    const { calls, menu } = createHarness();
    const buttons = ['7', 'c'].map(seedKey => ({
        dataset: { seedKey },
        addEventListener(type, listener) {
            assert.equal(type, 'click');
            this.click = listener;
        }
    }));
    const back = {
        addEventListener(type, listener) {
            assert.equal(type, 'click');
            this.click = listener;
        }
    };
    menu.overlay.querySelectorAll = () => buttons;
    menu.overlay.querySelector = () => back;
    t.mock.method(globalThis, 'setTimeout', callback => {
        callback();
        return 1;
    });

    menu.renderSeedInput();

    assert.doesNotMatch(menu.overlay.innerHTML, /\sonclick\s*=/i);
    buttons[0].click();
    assert.equal(menu.currentSeedInput, '7');
    buttons[1].click();
    assert.equal(menu.currentSeedInput, '');
    back.click();
    assert.deepEqual(calls, [['render-menu']]);
});
