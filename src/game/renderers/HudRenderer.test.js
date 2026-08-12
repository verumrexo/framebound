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
        moveTo: (...args) => calls.push(['moveTo', ...args]),
        lineTo: (...args) => calls.push(['lineTo', ...args]),
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
            getUniqueParts: () => new Set()
        },
        input: { getMousePos: () => ({ x: 100, y: 150 }) },
        xp: 25,
        xpToNext: 100,
        level: 2,
        floor: 3,
        x: 640,
        y: 360,
        rotation: 0,
        enemies: [],
        drones: [],
        eyeCandy: false,
        combatTelemetry: { entriesFor: () => [] },
        peerNetwork: null,
        salvageSweep: { status: 'idle' },
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
        notifications: [{ text: 'notice', color: '#00ffff', life: 1 }],
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
            'ap // frame integrity',
            '75/100',
            '75%',
            'level 2',
            'xp 25/100',
            'floor // 3',
            'credits // 9',
            'score // 12',
            'spd // 5',
            'tab // hangar',
            'fps 60',
        '1.1.0 // beta // seed: 17',
        'notice'
        ]
    );
    assert.ok(calls.find(call => call[0] === 'minimap'));
    assert.equal(calls.at(-1)[0], 'cursor');
    assert.ok(calls.some(call => call[0] === 'text' && call[1] === 'notice'));
});

test('hud measures fps but hides only the fps label when disabled', () => {
    const { game, calls, hud } = createHarness({ showFps: false });
    hud.draw();

    assert.equal(game.frameCount, 3);
    assert.equal(calls.some(call => call[0] === 'text' && call[1] === 'fps 60'), false);
    assert.equal(calls.some(call => call[0] === 'text' && call[1] === '1.1.0 // beta // seed: 17'), true);
});

test('eye candy adds cockpit telemetry without replacing the required hud', () => {
    const { game, calls, hud } = createHarness({ eyeCandy: true });
    game.enemies = [{ isDead: false }, { isDead: true }];

    hud.draw();

    const text = calls.filter(call => call[0] === 'text').map(call => call[1]);
    assert.ok(text.includes('ap // frame integrity'));
    assert.ok(text.includes('heading // n 000'));
    assert.ok(text.includes('weapon bus // linked'));
    assert.ok(text.includes('contacts // 01'));
    assert.ok(text.includes('nav // x 640  y 360'));
    game.vx = 12;
    game.vy = 5;
    hud.draw();
    assert.deepEqual(hud.speedHistory, [5, 13]);
});

test('eye candy lists every weapon and opens separate utility and damage panels', () => {
    const parts = [
        { partId: 'dart', cooldown: 0, x: -1, y: 0 },
        { partId: 'laser', cooldown: 1, x: 1, y: 0 },
        { partId: 'shield', shieldCooldown: 1.5, x: 0, y: 1 }
    ];
    const { game, calls } = createHarness({
        eyeCandy: true,
        combatTelemetry: {
            entriesFor: () => [{
                key: 'dart@-1,0',
                partId: 'dart',
                label: 'dart',
                family: 'velocity',
                damage: 25
            }]
        }
    });
    game.playerShip.getUniqueParts = () => new Set(parts);
    const hud = new HudRenderer(game, {
        partsLibrary: {
            dart: { id: 'dart', name: 'dart', type: 'weapon', stats: { cooldown: 1, weaponGroup: 'velocity' } },
            laser: { id: 'laser', name: 'laser', type: 'weapon', stats: { cooldown: 2, weaponGroup: 'laser' } },
            shield: { id: 'shield', name: 'aegis', type: 'shield', stats: { shieldCooldown: 3 } }
        },
        drawCursor: () => {},
        now: () => 100,
        dateNow: () => 0
    });

    hud.draw();

    const text = calls.filter(call => call[0] === 'text').map(call => call[1]);
    assert.ok(text.includes('1 // dart'));
    assert.ok(text.includes('2 // laser'));
    assert.ok(text.includes('utility bus // linked'));
    assert.ok(text.includes('damage telemetry // run'));
    assert.ok(text.includes('dart @-1,0'));
});

test('drone telemetry filters local living drones into three columns and reports status and hp', () => {
    const repairTarget = { name: 'pilot' };
    const enemyTarget = { id: 'raider-7' };
    const drones = [
        {
            owner: 'player', ownerPlayerId: 'guest-1', droneType: 'mender',
            role: 'repair', hp: 65, maxHp: 90, target: repairTarget
        },
        {
            owner: 'player', ownerPlayerId: 'guest-1', droneType: 'rammer',
            role: 'ram', hp: 30, maxHp: 50, target: enemyTarget
        },
        {
            owner: 'player', ownerPlayerId: 'guest-1', droneType: 'striker',
            role: 'attack', hp: 12, maxHp: 20, target: { label: 'boss' }
        },
        {
            owner: 'player', ownerPlayerId: 'guest-1', droneType: 'needle',
            role: 'attack', hp: 20, maxHp: 20, state: 'orbit'
        },
        { owner: 'player', ownerPlayerId: 'host', droneType: 'wrong-owner' },
        { owner: 'player', ownerPlayerId: 'guest-1', droneType: 'dead', isDead: true }
    ];
    const { game, calls, hud } = createHarness({
        eyeCandy: true,
        drones,
        peerNetwork: { replicator: { selfId: 'guest-1' } }
    });

    hud.draw();

    const text = calls.filter(call => call[0] === 'text').map(call => call[1]);
    assert.ok(text.includes('drone telemetry // 4'));
    assert.ok(text.includes('mender'));
    assert.ok(text.includes('65/90'));
    assert.ok(text.includes('repairing'));
    assert.ok(text.includes('ramming'));
    assert.ok(text.includes('engaged'));
    assert.ok(text.includes('orbit'));
    assert.ok(!text.includes('wrong-owner'));
    assert.ok(!text.includes('dead'));

    const dronePanel = calls.find(call =>
        call[0] === 'text' && call[1] === 'drone telemetry // 4'
    );
    const cardRects = calls.filter(call =>
        call[0] === 'strokeRect' &&
        call[3] === 74 &&
        call[4] === 64
    );
    assert.equal(cardRects.length, 4);
    assert.deepEqual(cardRects.map(call => call[1]), [28, 106, 184, 28]);
    assert.ok(dronePanel);
    assert.equal(game.peerNetwork.replicator.selfId, 'guest-1');
});

test('drone telemetry returns its full height before damage telemetry', () => {
    const { game, hud } = createHarness({
        eyeCandy: true,
        drones: Array.from({ length: 7 }, (_, index) => ({
            owner: 'player',
            ownerPlayerId: 'host',
            droneType: `drone-${index}`,
            hp: 10,
            maxHp: 10
        })),
        combatTelemetry: {
            entriesFor: () => [{
                key: 'dart@0,0',
                partId: 'dart',
                label: 'dart',
                family: 'velocity',
                damage: 2
            }]
        }
    });
    const telemetryHeight = hud.drawDroneTelemetry(18, 300);
    assert.equal(telemetryHeight, 30 + 3 * 64 + 8);
    assert.equal(hud.drawDamageTelemetry(18, 300 + telemetryHeight + 10), 63);
    assert.equal(game.drones.length, 7);
});

test('salvage sweep prompt remains visible without eye candy', () => {
    const { calls, hud } = createHarness({
        salvageSweep: {
            status: 'ready',
            room: { sweepChargeRemaining: 0 }
        }
    });

    hud.draw();

    assert.ok(calls.find(call =>
        call[0] === 'text' && call[1] === 'sweep ready // r to engage'
    ));
});

test('vault containment status stays on the native hud', () => {
    const { calls, hud } = createHarness({
        currentRoom: {
            vaultState: {
                phase: 'containment',
                contractId: 'blood',
                elapsed: 7.25
            }
        }
    });

    hud.draw();

    const text = calls.filter(call => call[0] === 'text').map(call => call[1]);
    assert.ok(text.includes('cursed vault // blood'));
    assert.ok(text.includes('hold 10.8s'));
});

test('active ability hud shows selection, cooldown, and edge controls', () => {
    const { calls, hud } = createHarness({
        abilitySystem: {
            selectedAbility: () => ({ id: 'blink', label: 'warp gate' }),
            snapshotShipState: () => ({
                cooldowns: { blink: 2.5 },
                stealthTimer: 0
            })
        }
    });

    hud.draw();

    const text = calls.filter(call => call[0] === 'text').map(call => call[1]);
    assert.ok(text.includes('warp gate // 2.5s'));
    assert.ok(text.includes('q // cycle   rmb // activate'));
    const panel = calls.find(call => call[0] === 'fillRect' && call[4] === 38);
    assert.deepEqual(panel.slice(1), [118, 168, 250, 38]);
});

test('active ability cursor indicator clamps to the bottom-right edge and shows ready state', () => {
    const { game, calls, hud } = createHarness({
        abilitySystem: {
            selectedAbility: () => ({ id: 'emp', label: 'emp' }),
            snapshotShipState: () => ({ cooldowns: { emp: 0 } })
        },
        input: { getMousePos: () => ({ x: 1270, y: 710 }) }
    });

    hud.drawActiveAbilityStatus();

    const text = calls.filter(call => call[0] === 'text').map(call => call[1]);
    assert.ok(text.includes('emp // ready'));
    assert.ok(text.includes('q // cycle   rmb // activate'));
    const panel = calls.find(call => call[0] === 'fillRect');
    assert.deepEqual(panel.slice(1), [1002, 654, 250, 38]);
});

test('active ability cursor indicator flips before clamping and keeps its configured gap at every corner', () => {
    const corners = [
        { x: 0, y: 0 },
        { x: 1279, y: 0 },
        { x: 0, y: 719 },
        { x: 1279, y: 719 }
    ];

    for (const cursor of corners) {
        const { game, calls, hud } = createHarness({
            abilitySystem: {
                selectedAbility: () => ({ id: 'emp', label: 'emp' }),
                snapshotShipState: () => ({ cooldowns: { emp: 0 } })
            },
            input: { getMousePos: () => cursor }
        });

        hud.drawActiveAbilityStatus();

        const panel = calls.find(call => call[0] === 'fillRect');
        const [, x, y, width, height] = panel;
        assert.ok(x >= 8 && y >= 8);
        assert.ok(x + width <= game.renderer.width - 8);
        assert.ok(y + height <= game.renderer.height - 8);
        assert.equal(
            cursor.x < x || cursor.x > x + width || cursor.y < y || cursor.y > y + height,
            true
        );
        assert.ok(
            Math.abs(cursor.x - x) >= 18 || Math.abs(cursor.x - (x + width)) >= 18 ||
            Math.abs(cursor.y - y) >= 18 || Math.abs(cursor.y - (y + height)) >= 18
        );
    }
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
    assert.ok(gameOver.calls.find(call => call[0] === 'text' && call[1] === 'final score // 12'));
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
    game.playerShip.getUniqueParts = () => new Set([first, second]);
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
    const notificationIndex = calls.findIndex(call => call[0] === 'text' && call[1] === 'notice');
    const levelIndex = calls.findIndex(call => call[0] === 'level-up');
    const presentIndex = calls.findIndex(call => call[0] === 'present');
    const cursorIndex = calls.findIndex(call => call[0] === 'cursor');
    assert.ok(notificationIndex < levelIndex);
    assert.ok(levelIndex < presentIndex);
    assert.ok(presentIndex < cursorIndex);
});
