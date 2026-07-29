import '../tests/setup.js';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

let loadedModules;

async function loadModules() {
    if (!loadedModules) {
        mock.module('@supabase/supabase-js', {
            namedExports: {
                createClient: () => ({
                    from: () => ({
                        select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
                        insert: () => Promise.resolve({ error: null }),
                        delete: () => ({ neq: () => Promise.resolve({ error: null }) })
                    })
                })
            }
        });

        mock.module('socket.io-client', {
            namedExports: {
                io: () => ({
                    on: () => {},
                    emit: () => {},
                    connect: () => {},
                    disconnect: () => {}
                })
            }
        });

        loadedModules = Promise.all([
            import('./Game.js'),
            import('../game/ui/MainMenu.js')
        ]).then(([gameModule, menuModule]) => ({
            Game: gameModule.Game,
            MainMenu: menuModule.MainMenu
        }));
    }

    return loadedModules;
}

test('Game delegates continue startup to the session owner', async () => {
    const { Game } = await loadModules();
    const calls = [];
    const game = {
        session: {
            startOffline: (...args) => {
                calls.push(args);
                return true;
            }
        }
    };

    assert.equal(Game.prototype.startOffline.call(game, undefined, true), true);
    assert.deepEqual(calls, [[undefined, true]]);
});

test('Game forwards the saved-world entry option to the session owner', async () => {
    const { Game } = await loadModules();
    const calls = [];
    const game = {
        session: {
            startGame: (...args) => {
                calls.push(args);
                return 'started';
            }
        }
    };

    assert.equal(
        Game.prototype.startGame.call(game, 17, { enterStartRoom: false }),
        'started'
    );

    assert.deepEqual(calls, [[17, { enterStartRoom: false }]]);
});

test('Game keeps normal room entry enabled by default', async () => {
    const { Game } = await loadModules();
    const calls = [];
    const game = {
        session: {
            startGame: (...args) => {
                calls.push(args);
            }
        }
    };

    Game.prototype.startGame.call(game, 17);

    assert.deepEqual(calls, [[17, { enterStartRoom: true }]]);
});

test('continue menu delegates the complete load pipeline to Game once', async (t) => {
    const { MainMenu } = await loadModules();
    const calls = [];
    const game = {
        audio: {
            context: { state: 'running' },
            playMusic: (...args) => calls.push(['playMusic', ...args])
        },
        hasPendingSave: true,
        loadFromSave: () => assert.fail('menu must not hydrate the save a second time'),
        loop: {
            start: () => calls.push(['loop.start'])
        },
        startOffline: (...args) => {
            calls.push(['startOffline', ...args]);
            return true;
        }
    };
    const menu = new MainMenu(game);
    menu.overlay = {
        style: {},
        remove: () => calls.push(['overlay.remove'])
    };
    t.mock.method(globalThis, 'setTimeout', callback => {
        callback();
        return 1;
    });

    menu.continueGame();

    assert.deepEqual(calls, [
        ['startOffline', undefined, true],
        ['loop.start'],
        ['playMusic', 'bgm', 0.4],
        ['overlay.remove']
    ]);
});

test('continue menu stays put when the save is invalid', async () => {
    const { MainMenu } = await loadModules();
    let rendered = 0;
    const game = {
        audio: {
            context: { state: 'running' },
            playMusic: () => assert.fail('invalid saves must not start music')
        },
        hasPendingSave: true,
        loop: {
            start: () => assert.fail('invalid saves must not start the loop')
        },
        startOffline: () => false
    };
    const menu = new MainMenu(game);
    menu.overlay = { style: {} };
    menu.renderMenu = () => {
        rendered++;
    };

    menu.continueGame();

    assert.equal(rendered, 1);
    assert.equal(game.hasPendingSave, false);
});
