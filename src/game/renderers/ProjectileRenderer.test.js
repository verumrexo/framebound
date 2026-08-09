import test from 'node:test';
import assert from 'node:assert/strict';
import { drawProjectile } from './ProjectileRenderer.js';

function createRenderer() {
    const calls = [];
    const ctx = {
        globalAlpha: 1,
        save: () => calls.push(['save']),
        translate: (x, y) => calls.push(['translate', x, y]),
        rotate: angle => calls.push(['rotate', angle]),
        restore: () => calls.push(['restore'])
    };

    return {
        calls,
        renderer: {
            ctx,
            drawRect: (...args) => calls.push(['drawRect', ...args])
        }
    };
}

function createProjectile(overrides = {}) {
    return {
        delay: 0,
        owner: 'player',
        type: 'bullet',
        x: 100,
        y: 200,
        angle: 0.5,
        radius: 3,
        beamLength: 120,
        maxLife: 2,
        life: 0.9,
        railStayTime: 0.9,
        spinAngle: 0.25,
        ...overrides
    };
}

function drawRects(calls) {
    return calls.filter(([name]) => name === 'drawRect');
}

test('delayed projectiles are not rendered', () => {
    const { renderer, calls } = createRenderer();

    drawProjectile(renderer, createProjectile({ delay: 0.1 }));

    assert.deepEqual(calls, []);
});

test('basic player and enemy shots retain their distinct colors', () => {
    const player = createRenderer();
    const enemy = createRenderer();

    drawProjectile(player.renderer, createProjectile());
    drawProjectile(enemy.renderer, createProjectile({ owner: 'enemy' }));

    assert.deepEqual(drawRects(player.calls), [['drawRect', 97, 197, 6, 6, '#26d426']]);
    assert.deepEqual(drawRects(enemy.calls), [['drawRect', 97, 197, 6, 6, '#ff4444']]);
});

test('laser variants retain their original lengths and thicknesses', () => {
    const laser = createRenderer();
    const smallLaser = createRenderer();

    drawProjectile(laser.renderer, createProjectile({ type: 'laser' }));
    drawProjectile(smallLaser.renderer, createProjectile({ type: 'small_laser' }));

    assert.deepEqual(drawRects(laser.calls), [['drawRect', -15, -2, 30, 4, '#26d426']]);
    assert.deepEqual(drawRects(smallLaser.calls), [['drawRect', -12.5, -1.5, 25, 3, '#26d426']]);
});

test('rocket variants retain their separate bodies, noses, and flames', () => {
    const rocket = createRenderer();
    const rocketLe = createRenderer();
    const rocketHe = createRenderer();
    const guided = createRenderer();
    const ggbm = createRenderer();

    drawProjectile(rocket.renderer, createProjectile({ type: 'rocket' }));
    drawProjectile(rocketLe.renderer, createProjectile({ type: 'rocket_le' }));
    drawProjectile(rocketHe.renderer, createProjectile({ type: 'rocket_he' }));
    drawProjectile(guided.renderer, createProjectile({ type: 'guided_rocket' }));
    drawProjectile(ggbm.renderer, createProjectile({ type: 'ggbm' }));

    assert.deepEqual(drawRects(rocket.calls)[0], ['drawRect', -10, -3, 20, 6, '#ffaa44']);
    assert.deepEqual(drawRects(rocketLe.calls)[0], ['drawRect', -10, -3, 20, 6, '#ff0000']);
    assert.deepEqual(drawRects(rocketLe.calls)[1], ['drawRect', 4, -3, 6, 6, '#444']);
    assert.deepEqual(drawRects(rocketHe.calls)[0], ['drawRect', -10, -3, 20, 6, '#44aaff']);
    assert.deepEqual(drawRects(rocketHe.calls)[1], ['drawRect', 4, -3, 6, 6, '#224466']);
    assert.deepEqual(drawRects(guided.calls)[0], ['drawRect', -10, -3, 20, 6, '#44aaff']);
    assert.deepEqual(drawRects(ggbm.calls).slice(0, 2), [
        ['drawRect', -8, -4, 16, 8, '#aa00ff'],
        ['drawRect', 4, -4, 4, 8, '#ffffff']
    ]);
    assert.equal(drawRects(rocketLe.calls)[2][5], '#ffff00');
    assert.equal(drawRects(rocketHe.calls)[2][5], '#00ccff');
    assert.equal(drawRects(ggbm.calls)[2][5], '#ff00ff');
});

test('railgun, saber, and freeze beams retain distinct colors and widths', () => {
    const railgun = createRenderer();
    const saber = createRenderer();
    const freeze = createRenderer();
    const stableBeam = { maxLife: 2, life: 1, railStayTime: 1 };

    drawProjectile(railgun.renderer, createProjectile({ type: 'railgun', ...stableBeam }));
    drawProjectile(saber.renderer, createProjectile({ type: 'saber', ...stableBeam }));
    drawProjectile(freeze.renderer, createProjectile({ type: 'beam_freeze' }));

    assert.deepEqual(drawRects(railgun.calls), [
        ['drawRect', 0, -6, 120, 12, '#ff4444'],
        ['drawRect', 0, -2, 120, 4, '#ffffff']
    ]);
    assert.deepEqual(drawRects(saber.calls), [
        ['drawRect', 0, -2, 120, 4, '#88ffff'],
        ['drawRect', 0, -0.75, 120, 1.5, '#ffffff']
    ]);

    const [freezeGlow, freezeCore] = drawRects(freeze.calls);
    assert.equal(freezeGlow[5], '#00ccff');
    assert.equal(freezeCore[5], '#ffffff');
    assert.equal(freezeGlow[3], 120);
    assert.ok(freezeGlow[4] >= 10 && freezeGlow[4] <= 11);
    assert.ok(freezeCore[4] >= 3 && freezeCore[4] <= 3.3);
});

test('grenade variants retain distinct sizes, colors, and cores', () => {
    const mini = createRenderer();
    const tiny = createRenderer();
    const cluster = createRenderer();

    drawProjectile(mini.renderer, createProjectile({ type: 'mini_grenade' }));
    drawProjectile(tiny.renderer, createProjectile({ type: 'tiny_grenade' }));
    drawProjectile(cluster.renderer, createProjectile({ type: 'cluster_grenade' }));

    assert.deepEqual(drawRects(mini.calls), [
        ['drawRect', -4, -4, 8, 8, '#44ff44'],
        ['drawRect', -2, -2, 4, 4, '#ffffff']
    ]);
    assert.deepEqual(drawRects(tiny.calls), [
        ['drawRect', -2, -2, 4, 4, '#88ff88'],
        ['drawRect', -1, -1, 2, 2, '#ffffff']
    ]);
    assert.deepEqual(drawRects(cluster.calls), [
        ['drawRect', -8, -6, 16, 12, '#26d426'],
        ['drawRect', -6, -8, 12, 16, '#26d426'],
        ['drawRect', -4, -4, 8, 8, '#ffffff']
    ]);
});

test('new arsenal projectiles render with distinct deterministic silhouettes', () => {
    const types = [
        'beam_sword',
        'arc_welder',
        'proximity_mine',
        'shrapnel_grenade',
        'shrapnel_fragment',
        'ricochet_slug',
        'hack_dart',
        'torpedo',
        'mini_bullet'
    ];

    for (const type of types) {
        const { renderer, calls } = createRenderer();
        drawProjectile(renderer, createProjectile({
            type,
            isBeam: type === 'beam_sword' || type === 'arc_welder',
            beamLength: type === 'beam_sword' ? 120 : 140,
            armed: true
        }));
        const rects = drawRects(calls);
        assert.ok(rects.length > 0, `${type} should draw at least one shape`);
        assert.ok(calls.some(([name]) => name === 'save') || type === 'mini_bullet');
    }

    const mine = createRenderer();
    drawProjectile(mine.renderer, createProjectile({ type: 'proximity_mine', armed: false }));
    assert.equal(drawRects(mine.calls)[0][5], '#8c8c8c');
});
