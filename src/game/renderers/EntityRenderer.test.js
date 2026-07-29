import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { EntityRenderer } = await import('./EntityRenderer.js');

function createRenderer() {
    const calls = [];
    const values = {};
    const methods = [
        'save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'arc',
        'stroke', 'fill', 'fillRect', 'strokeRect', 'moveTo', 'lineTo',
        'closePath', 'fillText', 'drawImage'
    ];
    const target = Object.fromEntries(methods.map(method => [
        method,
        (...args) => calls.push([method, ...args])
    ]));
    const ctx = new Proxy(target, {
        get(object, property) {
            if (property in object) return object[property];
            return values[property];
        },
        set(object, property, value) {
            values[property] = value;
            calls.push(['set', property, value]);
            return true;
        }
    });

    return {
        calls,
        ctx,
        renderer: {
            ctx,
            drawCircle(...args) {
                calls.push(['drawCircle', ...args]);
            }
        }
    };
}

test('loot crates keep their beveled panel, corners, seams, and center light', () => {
    const { calls, renderer } = createRenderer();
    EntityRenderer.drawLootCrate(renderer, {
        x: 100,
        y: 200,
        rotation: 0,
        width: 56,
        height: 56,
        wTiles: 2,
        hTiles: 2,
        isOpened: false,
        baseColor: '#506070',
        detailColor: '#304050',
        lightColor: '#00ffff',
        random: () => 0.5
    });

    assert.ok(calls.filter(([method]) => method === 'fillRect').length >= 9);
    assert.ok(calls.some(call => (
        call[0] === 'set' && call[1] === 'fillStyle' && call[2] === '#00ffff'
    )));
});

test('asteroids keep their pixel-line silhouette instead of a filled polygon', () => {
    const { calls, renderer } = createRenderer();
    EntityRenderer.drawAsteroid(renderer, {
        x: 0,
        y: 0,
        rotation: 0,
        type: 'crystal_blue',
        isDead: false,
        isBroken: false,
        radius: 20,
        vertices: [
            { x: -20, y: -20 },
            { x: 20, y: -20 },
            { x: 20, y: 20 },
            { x: -20, y: 20 }
        ],
        random: () => 0.5
    });

    assert.ok(calls.filter(([method]) => method === 'fillRect').length > 20);
    assert.equal(calls.some(([method]) => method === 'fill'), false);
});

test('xp, gold, and hp orbs retain three separate drawing languages', () => {
    const xp = createRenderer();
    EntityRenderer.drawOrb(xp.renderer, {
        x: 1,
        y: 2,
        radius: 3,
        color: '#00ffff',
        pulseAngle: 0,
        isDead: false
    });
    assert.equal(xp.calls.filter(([method]) => method === 'drawCircle').length, 2);

    const gold = createRenderer();
    EntityRenderer.drawOrb(gold.renderer, {
        x: 1,
        y: 2,
        radius: 6,
        color: '#ffd700',
        rotation: Math.PI / 2,
        isDead: false
    });
    assert.ok(gold.calls.some(([method]) => method === 'scale'));
    assert.equal(gold.calls.filter(([method]) => method === 'arc').length, 2);

    const hp = createRenderer();
    EntityRenderer.drawOrb(hp.renderer, {
        x: 1,
        y: 2,
        radius: 6,
        color: '#44ff44',
        rotation: 0.5,
        isDead: false
    });
    assert.ok(hp.calls.some(([method]) => method === 'rotate'));
    assert.equal(hp.calls.filter(([method]) => method === 'fillRect').length, 4);
});

test('portals keep the pulsing double glow and spinning sprite', () => {
    const { calls, renderer } = createRenderer();
    const spriteCalls = [];
    EntityRenderer.drawPortal(renderer, {
        x: 10,
        y: 20,
        radius: 40,
        rotation: 0.25,
        sprite: {
            draw(...args) {
                spriteCalls.push(args);
            }
        }
    });

    assert.deepEqual(
        calls.filter(([method]) => method === 'drawCircle').map(call => call.slice(1)),
        [
            [10, 20, 50, '#aa00ff'],
            [10, 20, 40, '#ffffff']
        ]
    );
    assert.equal(spriteCalls[0][3], 0.25);
});

test('item drops prefer their base sprite and keep the original scale', () => {
    const { calls, renderer } = createRenderer();
    const spriteCalls = [];
    EntityRenderer.drawItemPickup(renderer, {
        x: 10,
        y: 20,
        life: 0,
        bobOffset: 0,
        isDead: false,
        def: {
            baseSprite: {
                draw(...args) {
                    spriteCalls.push(args);
                }
            },
            sprite: {
                draw() {
                    assert.fail('item pickup ignored its base sprite');
                }
            }
        }
    });

    assert.ok(calls.some(call => call[0] === 'scale' && call[1] === 0.6 && call[2] === 0.6));
    assert.equal(spriteCalls.length, 1);
});

test('training dummies keep their name and dps overlay', () => {
    const { calls, renderer } = createRenderer();
    EntityRenderer.drawEnemy(renderer, {
        type: 'dummy',
        isDead: false,
        x: 100,
        y: 200,
        radius: 30,
        rotation: 0,
        currentDps: 321,
        sprite: { draw() {} }
    });

    assert.deepEqual(
        calls.filter(([method]) => method === 'fillText').map(call => call[1]),
        ['training dummy', '321 dps']
    );
});

test('missing chest sprites retain their original fallback borders', () => {
    const treasure = createRenderer();
    EntityRenderer.drawTreasureChest(treasure.renderer, {
        x: 10,
        y: 20,
        life: 0,
        bobOffset: 0,
        rotation: 0,
        opened: false,
        sprite: null
    });
    assert.ok(treasure.calls.some(call => (
        call[0] === 'set' &&
        call[1] === 'strokeStyle' &&
        call[2] === '#8b4513'
    )));
    assert.deepEqual(
        treasure.calls.find(([method]) => method === 'strokeRect'),
        ['strokeRect', -30, -30, 60, 60]
    );

    const vault = createRenderer();
    EntityRenderer.drawVaultChest(vault.renderer, {
        x: 10,
        y: 20,
        life: 0,
        bobOffset: 0,
        rotation: 0,
        opened: false,
        ambushActive: false,
        costType: 'hp',
        sprite: null
    });
    assert.ok(vault.calls.some(call => (
        call[0] === 'set' &&
        call[1] === 'strokeStyle' &&
        call[2] === '#fff'
    )));
    assert.deepEqual(
        vault.calls.find(([method]) => method === 'strokeRect'),
        ['strokeRect', -30, -30, 60, 60]
    );
});

test('charged enemy weapons keep their long tracking telegraph', () => {
    const { calls, renderer } = createRenderer();
    EntityRenderer.drawEnemy(renderer, {
        isDead: false,
        isWarpingIn: false,
        x: 0,
        y: 0,
        rotation: 0,
        rotationOffset: 0,
        radius: 20,
        hp: 10,
        maxHp: 10,
        random: () => assert.fail(
            'rendering must not consume enemy gameplay rng'
        ),
        shipParts: [{ x: 0, y: 0, partId: 'core', rotation: 0 }],
        weaponCooldowns: [{
            isCharging: true,
            chargeTimer: 1,
            lockedAngle: 0,
            part: { x: 0, y: 0, rotation: 0 },
            def: { width: 1, height: 1, stats: { chargeTime: 1 } }
        }]
    });

    assert.ok(calls.some(call => (
        call[0] === 'lineTo' && Math.abs(call[1]) >= 1900
    )));
});
