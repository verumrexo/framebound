import test from 'node:test';
import assert from 'node:assert/strict';
import { PauseMenuController } from './PauseMenuController.js';

test('pause controller toggles pause state and the matching overlay action', () => {
    const game = { isGameOver: false, paused: false };
    const controller = new PauseMenuController(game);
    const actions = [];
    controller.show = () => actions.push('show');
    controller.hide = () => actions.push('hide');

    controller.toggle();
    controller.toggle();

    assert.equal(game.paused, false);
    assert.deepEqual(actions, ['show', 'hide']);
});

test('pause controller ignores toggles after game over', () => {
    const game = { isGameOver: true, paused: false };
    const controller = new PauseMenuController(game);
    controller.show = () => assert.fail('show should not be called');
    controller.hide = () => assert.fail('hide should not be called');

    controller.toggle();

    assert.equal(game.paused, false);
});

test('paused frames preserve the mouse edge and block simulation', () => {
    const game = {
        paused: true,
        mouseDownLastFrame: false
    };
    const controller = new PauseMenuController(game);

    const blocksSimulation = controller.update(true);

    assert.equal(blocksSimulation, true);
    assert.equal(game.mouseDownLastFrame, true);
});

test('unpaused frames continue without changing the mouse edge', () => {
    const game = {
        paused: false,
        mouseDownLastFrame: false
    };
    const controller = new PauseMenuController(game);

    const blocksSimulation = controller.update(true);

    assert.equal(blocksSimulation, false);
    assert.equal(game.mouseDownLastFrame, false);
});

test('returning to the menu really saves before stopping the run', () => {
    const calls = [];
    const game = {
        running: true,
        paused: true,
        autoSave: () => calls.push('save'),
        peerNetwork: {
            disconnect: () => calls.push('disconnect-peer')
        },
        loop: { stop: () => calls.push('stop') },
        audio: { stopMusic: () => calls.push('music') },
        mainMenu: { show: () => calls.push('menu') }
    };
    const controller = new PauseMenuController(game);
    controller.hide = () => calls.push('hide');

    controller.returnToMainMenu();

    assert.equal(game.paused, false);
    assert.equal(game.running, false);
    assert.deepEqual(calls, [
        'save',
        'disconnect-peer',
        'hide',
        'stop',
        'music',
        'menu'
    ]);
});

test('hiding pause settings stops their background ui timer', () => {
    const calls = [];
    const game = {
        gameSettings: {
            stopUpdating: () => calls.push('stop-settings')
        },
        pauseOverlay: {
            remove: () => calls.push('remove-overlay')
        },
        showPauseSettings: true
    };
    const controller = new PauseMenuController(game);

    controller.hide();

    assert.deepEqual(calls, ['stop-settings', 'remove-overlay']);
    assert.equal(game.pauseOverlay, null);
    assert.equal(game.showPauseSettings, false);
});

test('only the host can toggle shared pause and flushes it immediately', () => {
    const calls = [];
    const hostGame = {
        isGameOver: false,
        paused: false,
        peerNetwork: {
            isGuest: false,
            flushAuthoritativeState: () => calls.push('flush')
        }
    };
    const host = new PauseMenuController(hostGame);
    host.show = () => calls.push('show');
    host.hide = () => calls.push('hide');

    host.toggle();
    assert.equal(hostGame.paused, true);
    assert.deepEqual(calls, ['show', 'flush']);

    const guestGame = {
        isGameOver: false,
        paused: false,
        peerNetwork: { isGuest: true }
    };
    const guest = new PauseMenuController(guestGame);
    guest.toggle();
    assert.equal(guestGame.paused, false);
});

test('guest pause state follows authoritative host snapshots', () => {
    const calls = [];
    const game = {
        paused: false,
        peerNetwork: { isGuest: true }
    };
    const controller = new PauseMenuController(game);
    controller.show = () => calls.push('show');
    controller.hide = () => calls.push('hide');

    assert.equal(controller.applyRemotePaused(true), true);
    assert.equal(game.paused, true);
    assert.equal(controller.applyRemotePaused(false), true);
    assert.equal(game.paused, false);
    assert.deepEqual(calls, ['show', 'hide']);
});

test('guest return never overwrites the host-owned run save', () => {
    const calls = [];
    const game = {
        running: true,
        paused: true,
        autoSave: () => calls.push('save'),
        peerNetwork: {
            isGuest: true,
            disconnect: () => calls.push('disconnect')
        },
        loop: { stop: () => calls.push('stop') },
        audio: { stopMusic: () => calls.push('music') },
        mainMenu: { show: () => calls.push('menu') }
    };
    const controller = new PauseMenuController(game);
    controller.hide = () => calls.push('hide');

    controller.returnToMainMenu();

    assert.equal(calls.includes('save'), false);
    assert.equal(game.running, false);
    assert.deepEqual(calls, [
        'disconnect',
        'hide',
        'stop',
        'music',
        'menu'
    ]);
});
