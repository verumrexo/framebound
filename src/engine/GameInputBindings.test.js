import test from 'node:test';
import assert from 'node:assert/strict';
import { GameInputBindings } from './GameInputBindings.js';

function createHarness(overrides = {}) {
    const calls = [];
    const listeners = new Map();
    const target = {
        innerWidth: 1440,
        innerHeight: 900,
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
            calls.push(['add', type]);
        },
        removeEventListener(type, listener) {
            const entries = listeners.get(type) || [];
            listeners.set(type, entries.filter(entry => entry !== listener));
            calls.push(['remove', type]);
        }
    };
    const game = {
        running: true,
        playerShip: {},
        designer: { active: false },
        hangar: {
            active: false,
            toggle: () => calls.push(['hangar'])
        },
        shipBuilder: {
            active: false,
            toggle: () => calls.push(['ship-builder'])
        },
        levelUpManager: { active: false },
        isGameOver: false,
        fullscreenMapOpen: false,
        paused: false,
        currentRoom: { locked: false },
        togglePause: () => calls.push(['pause']),
        nameEntryActive: false,
        devTools: { toggle: () => calls.push(['dev']) },
        camera: { resize: (...args) => calls.push(['resize', ...args]) },
        ...overrides
    };
    const bindings = new GameInputBindings(game, target);
    const dispatch = (type, event = {}) => {
        for (const listener of listeners.get(type) || []) listener(event);
    };
    return { game, target, calls, listeners, bindings, dispatch };
}

test('attach is idempotent and dispose removes the exact registered listeners', () => {
    const { calls, listeners, bindings } = createHarness();
    bindings.attach();
    bindings.attach();
    assert.equal(listeners.get('keydown').length, 2);
    assert.equal(listeners.get('resize').length, 1);

    bindings.dispose();
    assert.equal(listeners.get('keydown').length, 0);
    assert.equal(listeners.get('resize').length, 0);
    assert.deepEqual(calls.map(call => call.slice(0, 2)), [
        ['add', 'keydown'],
        ['add', 'keydown'],
        ['add', 'resize'],
        ['remove', 'keydown'],
        ['remove', 'keydown'],
        ['remove', 'resize']
    ]);
});

test('designer blocks gameplay shortcuts but preserves the separate dev shortcut listener', () => {
    const { game, calls, bindings, dispatch } = createHarness();
    bindings.attach();
    game.designer.active = true;

    dispatch('keydown', {
        code: 'Tab',
        preventDefault: () => calls.push(['prevent'])
    });
    dispatch('keydown', { code: 'KeyL' });

    assert.ok(!calls.find(call => call[0] === 'hangar'));
    assert.ok(!calls.find(call => call[0] === 'prevent'));
    assert.ok(calls.find(call => call[0] === 'dev'));
});

test('gameplay shortcuts do nothing before a local run exists', () => {
    const { game, calls, bindings, dispatch } = createHarness({
        running: false,
        playerShip: {}
    });
    bindings.attach();

    dispatch('keydown', {
        code: 'Tab',
        preventDefault: () => calls.push(['prevent'])
    });
    dispatch('keydown', { key: 'Escape' });
    dispatch('keydown', { code: 'KeyM' });

    assert.equal(calls.some(([name]) =>
        ['hangar', 'prevent', 'pause'].includes(name)
    ), false);
    assert.equal(game.fullscreenMapOpen, false);
});

test('escape closes the map before pause and remains blocked during game over', () => {
    const { game, calls, bindings, dispatch } = createHarness();
    bindings.attach();
    game.fullscreenMapOpen = true;

    dispatch('keydown', { key: 'Escape' });
    assert.equal(game.fullscreenMapOpen, false);
    assert.ok(!calls.find(call => call[0] === 'pause'));

    dispatch('keydown', { key: 'Escape' });
    assert.equal(calls.filter(call => call[0] === 'pause').length, 1);

    game.isGameOver = true;
    dispatch('keydown', { key: 'Escape' });
    assert.equal(calls.filter(call => call[0] === 'pause').length, 1);
});

test('map toggle keeps room, lock, pause, and game-over guards', () => {
    const { game, bindings, dispatch } = createHarness();
    bindings.attach();

    dispatch('keydown', { code: 'KeyM' });
    assert.equal(game.fullscreenMapOpen, true);

    game.currentRoom.locked = true;
    dispatch('keydown', { code: 'KeyM' });
    assert.equal(game.fullscreenMapOpen, true);

    game.currentRoom.locked = false;
    game.paused = true;
    dispatch('keydown', { code: 'KeyM' });
    assert.equal(game.fullscreenMapOpen, true);
});

test('hangar, pause, level-up, and game-over states block competing shortcuts', () => {
    const { game, calls, bindings, dispatch } = createHarness();
    bindings.attach();

    game.hangar.active = true;
    dispatch('keydown', { key: 'Escape' });
    dispatch('keydown', {
        code: 'Tab',
        preventDefault: () => calls.push(['prevent'])
    });
    assert.deepEqual(
        calls.filter(([name]) => name === 'hangar'),
        [['hangar']]
    );
    assert.equal(calls.some(([name]) => name === 'pause'), false);

    game.hangar.active = false;
    game.paused = true;
    dispatch('keydown', {
        code: 'Tab',
        preventDefault: () => calls.push(['pause-prevent'])
    });
    assert.equal(
        calls.some(([name]) => name === 'pause-prevent'),
        false
    );

    game.paused = false;
    game.levelUpManager.active = true;
    dispatch('keydown', {
        code: 'Tab',
        preventDefault: () => calls.push(['level-prevent'])
    });
    assert.equal(
        calls.some(([name]) => name === 'level-prevent'),
        false
    );

    game.levelUpManager.active = false;
    game.isGameOver = true;
    dispatch('keydown', {
        code: 'Tab',
        preventDefault: () => calls.push(['death-prevent'])
    });
    assert.equal(
        calls.some(([name]) => name === 'death-prevent'),
        false
    );
});

test('ship builder keeps gameplay shortcuts modal while m still closes it', () => {
    const { game, calls, bindings, dispatch } = createHarness();
    bindings.attach();
    game.shipBuilder.active = true;
    game.paused = true;

    dispatch('keydown', {
        code: 'Tab',
        preventDefault: () => calls.push(['prevent'])
    });
    dispatch('keydown', { key: 'Escape' });
    dispatch('keydown', { code: 'KeyM' });

    assert.deepEqual(
        calls.filter(([name]) => name === 'ship-builder'),
        [['ship-builder']]
    );
    assert.equal(calls.some(([name]) => name === 'hangar'), false);
    assert.equal(calls.some(([name]) => name === 'pause'), false);
    assert.equal(calls.some(([name]) => name === 'prevent'), false);
    assert.equal(game.fullscreenMapOpen, false);
});

test('name entry blocks dev tools and resize keeps native window dimensions', () => {
    const { game, calls, bindings, dispatch } = createHarness();
    bindings.attach();
    game.nameEntryActive = true;

    dispatch('keydown', { code: 'KeyL' });
    dispatch('resize');

    assert.ok(!calls.find(call => call[0] === 'dev'));
    assert.deepEqual(calls.find(call => call[0] === 'resize'), ['resize', 1440, 900]);
});
