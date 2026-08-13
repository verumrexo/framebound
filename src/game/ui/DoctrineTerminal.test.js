import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DoctrineTerminal } from './DoctrineTerminal.js';

function terminalFor(game) {
    const terminal = Object.create(DoctrineTerminal.prototype);
    terminal.game = game;
    terminal.active = false;
    terminal.previouslyPaused = false;
    terminal.root = { style: {} };
    terminal.render = () => {};
    return terminal;
}

test('guest doctrine browsing releases held movement and fire intent', () => {
    const calls = [];
    const game = {
        paused: false,
        peerNetwork: {
            isGuest: true,
            sendInput: input => calls.push(['input', input]),
            sendFireIntent: (...args) => calls.push(['fire', ...args])
        }
    };
    const terminal = terminalFor(game);

    assert.equal(terminal.open(), true);
    assert.equal(game.paused, true);
    assert.deepEqual(calls, [['input', {}], ['fire', false, 0]]);
});

test('host doctrine browsing flushes pause changes on open and close', () => {
    let flushes = 0;
    const game = {
        paused: false,
        peerNetwork: {
            isHost: true,
            flushAuthoritativeState: () => flushes++
        }
    };
    const terminal = terminalFor(game);

    terminal.open();
    terminal.close();

    assert.equal(flushes, 2);
    assert.equal(game.paused, false);
    assert.equal(terminal.root.style.display, 'none');
});

test('run reset hides the doctrine terminal without restoring stale pause state', () => {
    const game = { paused: false };
    const terminal = terminalFor(game);
    terminal.active = true;
    terminal.previouslyPaused = true;

    terminal.resetRunState();

    assert.equal(terminal.active, false);
    assert.equal(terminal.previouslyPaused, false);
    assert.equal(game.paused, false);
});
