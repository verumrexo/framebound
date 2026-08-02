import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { HudRenderer } = await import('./HudRenderer.js');

function createHarness(overrides = {}) {
    const calls = [];
    const ctx = {
        fillStyle: null,
        strokeStyle: null,
        lineWidth: 0,
        font: null,
        textAlign: null,
        fillText: (text, ...args) => calls.push(['text', text, ...args]),
        strokeRect: (...args) => calls.push(['strokeRect', ...args]),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        beginPath: () => calls.push(['beginPath']),
        arc: (...args) => calls.push(['arc', ...args]),
        stroke: () => calls.push(['stroke']),
        fill: () => calls.push(['fill']),
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        translate: (...args) => calls.push(['translate', ...args])
    };
    const renderer = {
        width: 1280,
        height: 720,
        ctx,
        drawRect: (...args) => calls.push(['drawRect', ...args]),
        present: () => calls.push(['present'])
    };
    const game = {
        renderer,
        hangar: {
            active: false,
            draw: () => calls.push(['hangar'])
        },
        shipBuilder: {
            active: false,
            draw: () => calls.push(['ship-builder'])
        },
        isGameOver: false,
        nameEntryActive: false,
        nameEntry: '',
        playerShip: {
            hp: 75,
            maxHp: 100,
            stats: { boosterCount: 0 },
            getUniqueParts: () => []
        },
        input: { getMousePos: () => ({ x: 100, y: 150 }) },
        xp: 25,
        xpToNext: 100,
        level: 2,
        floor: 3,
        gold: 9,
        vx: 3,
        vy: 4,
        dashCooldown: 0,
        dashMaxCooldown: 10,
        minimap: {
            x: 0,
            draw: () => calls.push(['minimap'])
        },
        score: 12,
        frameCount: 2,
        lastFpsTime: 0,
        fps: 60,
        version: '1.1.0',
        versionName: 'beta',
        levelGen: { seed: 17 },
        fullscreenMapOpen: false,
        fullscreenMap: { draw: () => calls.push(['map']) },
        camera: { x: 0, y: 0, zoom: 1 },
        itemPickups: [],
        effects: { drawNotifications: () => calls.push(['notifications']) },
        levelUpManager: {
            active: false,
            draw: () => calls.push(['level-up'])
        },
        ...overrides
    };
    const hud = new HudRenderer(game, {
        partsLibrary: {},
        hangarClass: {
            updateTooltip: (tooltip, def) => calls.push(['tooltip', tooltip, def])
        },
        drawCursor: () => calls.push(['cursor']),
        now: () => 100,
        dateNow: () => 0
    });
    return { game, calls, hud };
}

test('normal hud preserves bars, minimap anchoring, frame accounting, and final overlay order', () => {
    const { game, calls, hud } = createHarness();
    hud.draw();

    assert.equal(game.minimap.x, 1060);
    assert.equal(game.frameCount, 3);
    assert.deepEqual(
        calls.filter(call => call[0] === 'text').map(call => call[1]),
        [
            'integrity',
            '75/100',
            '75%',
            'tab for hangar',
            'lvl 2 | floor 3',
            '$ 9',
            'speed: 5',
            'score: 12',
            'fps: 60',
            '1.1.0 [beta] | seed: 17'
        ]
    );
    assert.ok(calls.find(call => call[0] === 'minimap'));
    assert.deepEqual(calls.slice(-2).map(call => call[0]), ['notifications', 'cursor']);
});

test('hangar, ship builder, and game-over modes keep their original precedence', () => {
    const hangar = createHarness();
    hangar.game.hangar.active = true;
    hangar.game.shipBuilder.active = true;
    hangar.hud.draw();
    assert.ok(hangar.calls.find(call => call[0] === 'hangar'));
    assert.ok(!hangar.calls.find(call => call[0] === 'ship-builder'));

    const builder = createHarness();
    builder.game.shipBuilder.active = true;
    builder.hud.draw();
    assert.ok(builder.calls.find(call => call[0] === 'ship-builder'));

    const gameOver = createHarness();
    gameOver.game.isGameOver = true;
    gameOver.hud.draw();
    assert.ok(gameOver.calls.find(call => call[0] === 'text' && call[1] === 'frame destroyed'));
    assert.ok(gameOver.calls.find(call => call[0] === 'text' && call[1] === 'FINAL SCORE: 12'));
});

test('item tooltip keeps bobbed world hit testing, positioning, and hangar content', () => {
    const { game, calls, hud } = createHarness();
    const tooltip = { style: {} };
    const def = { id: 'gun_basic' };
    game.gameTooltip = tooltip;
    game.itemPickups = [{
        x: 100,
        y: 150,
        life: 0,
        bobOffset: 0,
        isDead: false,
        def
    }];

    hud.updateItemTooltip();

    assert.equal(tooltip.style.display, 'block');
    assert.equal(tooltip.style.left, '115px');
    assert.equal(tooltip.style.top, '165px');
    assert.deepEqual(calls.at(-1), ['tooltip', tooltip, def]);
});

test('minigun indicator keeps peak priority and chooses the lower remaining peak', () => {
    const first = { partId: 'mini', peakMeter: 2, cooldown: 0, rampLevel: 3 };
    const second = { partId: 'mini', peakMeter: 1, cooldown: 0, rampLevel: 3 };
    const { game, calls } = createHarness();
    game.playerShip.getUniqueParts = () => [first, second];
    const hud = new HudRenderer(game, {
        partsLibrary: {
            mini: { stats: { rampUp: true, peakDuration: 5 } }
        },
        drawCursor: () => calls.push(['cursor']),
        now: () => 100,
        dateNow: () => 0
    });

    hud.draw();

    assert.ok(calls.find(call => call[0] === 'text' && call[1] === 'peak'));
    assert.ok(calls.find(call => call[0] === 'text' && call[1] === '1.0s'));
});

test('name entry stays above notifications and level-up, presents again, then draws cursor last', () => {
    const { game, calls, hud } = createHarness();
    game.nameEntryActive = true;
    game.nameEntry = 'abc';
    game.levelUpManager.active = true;

    hud.draw();

    assert.ok(calls.find(call => call[0] === 'text' && call[1] === 'abc__'));
    const notificationIndex = calls.findIndex(call => call[0] === 'notifications');
    const levelIndex = calls.findIndex(call => call[0] === 'level-up');
    const presentIndex = calls.findIndex(call => call[0] === 'present');
    const cursorIndex = calls.findIndex(call => call[0] === 'cursor');
    assert.ok(notificationIndex < levelIndex);
    assert.ok(levelIndex < presentIndex);
    assert.ok(presentIndex < cursorIndex);
});
