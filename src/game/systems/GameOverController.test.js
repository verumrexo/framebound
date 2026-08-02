import '../../tests/setup.js';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('@supabase/supabase-js', {
    namedExports: {
        createClient: () => ({})
    }
});

const { GameOverController } = await import('./GameOverController.js');

function createHarness({
    gameOver = false,
    isDead = false,
    keysDown = [],
    keysPressed = [],
    nameEntry = '',
    nameEntryActive = false,
    peerRole = null,
    canSpectate = false,
    isSpectating = false
} = {}) {
    const calls = [];
    const game = {
        playerShip: { isDead },
        isGameOver: gameOver,
        isSpectating,
        paused: false,
        score: 123,
        nameEntry,
        nameEntryActive,
        peerNetwork: {
            role: peerRole,
            isHost: peerRole === 'host',
            isGuest: peerRole === 'guest',
            canSpectateLocalDeath: () => canSpectate,
            flushAuthoritativeState: () => {
                calls.push([
                    'flush',
                    game.playerShip.isDead,
                    game.isGameOver,
                    game.paused
                ]);
                return peerRole === 'host';
            }
        },
        showNotification: (...args) =>
            calls.push(['notification', ...args]),
        mouseDownLastFrame: false,
        audio: {
            play: (...args) => calls.push(['audio', ...args])
        },
        input: {
            keysPressed,
            isKeyDown: key => keysDown.includes(key),
            clearPressed: () => calls.push(['clearPressed'])
        }
    };
    const highScores = {
        isHighScore: async () => false,
        addScore: async (...args) => calls.push(['addScore', ...args])
    };
    const saves = {
        clearSave: () => calls.push(['clearSave'])
    };
    const controller = new GameOverController(game, {
        highScores,
        saves,
        reload: () => calls.push(['reload'])
    });

    return { calls, controller, game, highScores };
}

test('death pauses the run and checks leaderboard eligibility', async () => {
    const { calls, controller, game, highScores } = createHarness({ isDead: true });
    highScores.isHighScore = async score => {
        calls.push(['isHighScore', score]);
        return true;
    };

    assert.equal(controller.update(true), true);
    await Promise.resolve();

    assert.equal(game.isGameOver, true);
    assert.equal(game.paused, true);
    assert.equal(game.nameEntryActive, true);
    assert.equal(game.nameEntry, '');
    assert.equal(game.mouseDownLastFrame, true);
    assert.deepEqual(calls, [
        ['clearSave'],
        ['audio', 'frame_death', { volume: 0.7 }],
        ['isHighScore', 123],
        ['clearPressed']
    ]);
});

test('peer-hosted runs cannot submit untrusted public scores', async () => {
    const { calls, controller, game, highScores } = createHarness({
        isDead: true,
        peerRole: 'host'
    });
    highScores.isHighScore = async score => {
        calls.push(['isHighScore', score]);
        return true;
    };

    assert.equal(controller.update(false), true);
    await Promise.resolve();

    assert.equal(game.nameEntryActive, false);
    assert.equal(calls.some(call => call[0] === 'isHighScore'), false);
    assert.deepEqual(calls.slice(0, 3), [
        ['flush', true, true, true],
        ['clearSave'],
        ['audio', 'frame_death', { volume: 0.7 }]
    ]);
});

test('dead peer spectates a living teammate instead of ending the run', async () => {
    const { calls, controller, game, highScores } = createHarness({
        isDead: true,
        peerRole: 'guest',
        canSpectate: true
    });
    highScores.isHighScore = async score => {
        calls.push(['isHighScore', score]);
        return true;
    };

    assert.equal(controller.update(false), false);
    await Promise.resolve();

    assert.equal(game.isSpectating, true);
    assert.equal(game.isGameOver, false);
    assert.equal(game.paused, false);
    assert.deepEqual(calls, [
        ['audio', 'frame_death', { volume: 0.7 }],
        [
            'notification',
            'spectating // boss kill restores ship',
            '#aaaaaa'
        ]
    ]);

    assert.equal(controller.update(false), false);
    assert.equal(calls.filter(call => call[0] === 'audio').length, 1);
});

test('spectator becomes game over when no living teammate remains', () => {
    const { calls, controller, game } = createHarness({
        isDead: true,
        peerRole: 'host',
        canSpectate: false,
        isSpectating: true
    });

    assert.equal(controller.update(false), true);
    assert.equal(game.isSpectating, false);
    assert.equal(game.isGameOver, true);
    assert.equal(game.paused, true);
    assert.equal(calls.some(call => call[0] === 'clearSave'), true);
});

test('guest team wipe never deletes that player local save', () => {
    const { calls, controller } = createHarness({
        isDead: true,
        peerRole: 'guest',
        canSpectate: false
    });

    assert.equal(controller.update(false), true);
    assert.equal(calls.some(call => call[0] === 'clearSave'), false);
});

test('boss resurrection leaves spectator mode immediately', () => {
    const { calls, controller, game } = createHarness({
        isDead: false,
        peerRole: 'guest',
        isSpectating: true
    });
    game.isGameOver = true;
    game.paused = true;

    assert.equal(controller.update(false), false);
    assert.equal(game.isSpectating, false);
    assert.equal(game.isGameOver, false);
    assert.equal(game.paused, false);
    assert.deepEqual(calls, [
        ['notification', 'systems restored', '#00ffff']
    ]);
});

test('restart clears the dead save before reloading', () => {
    const { calls, controller } = createHarness({
        gameOver: true,
        keysDown: ['KeyR']
    });

    assert.equal(controller.update(false), true);
    assert.deepEqual(calls, [
        ['clearSave'],
        ['reload'],
        ['clearPressed']
    ]);
});

test('name entry keeps the existing five-character input language', () => {
    const { controller, game } = createHarness({
        gameOver: true,
        keysPressed: ['KeyA', 'Digit2', 'Minus', 'Period', 'Space', 'KeyZ'],
        nameEntryActive: true
    });

    assert.equal(controller.update(false), true);
    assert.equal(game.nameEntry, 'a2-. ');
});

test('submitting a name leaves entry mode and sends the score', async () => {
    const { calls, controller, game } = createHarness({
        gameOver: true,
        keysPressed: ['Enter'],
        nameEntry: 'ace',
        nameEntryActive: true
    });

    assert.equal(controller.update(false), true);
    await Promise.resolve();

    assert.equal(game.nameEntryActive, false);
    assert.deepEqual(calls, [
        ['addScore', 'ace', 123],
        ['clearPressed']
    ]);
});
