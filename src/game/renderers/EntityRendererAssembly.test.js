import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { EntityRenderer } = await import('./EntityRenderer.js');
const { PartsLibrary } = await import('../../shared/parts/Part.js');

function recordingRenderer() {
    const calls = [];
    const ctx = new Proxy({}, {
        get(target, property) {
            if (property in target) return target[property];
            return (...args) => calls.push([property, ...args]);
        },
        set(target, property, value) {
            calls.push(['set', property, value]);
            target[property] = value;
            return true;
        }
    });
    return { renderer: { ctx }, calls };
}

function countingSprite(calls) {
    return {
        width: 20,
        height: 20,
        scale: 1,
        anchorX: 0.5,
        anchorY: 0.5,
        data: [1],
        colorMap: { 1: '#fff' },
        draw() {
            calls.push('draw');
        }
    };
}

test('ship and enemy reuse cached static bases while keeping turrets dynamic', () => {
    const baseCalls = [];
    const turretCalls = [];
    PartsLibrary.cache_test_gun = {
        id: 'cache_test_gun',
        type: 'weapon',
        width: 1,
        height: 1,
        baseSprite: countingSprite(baseCalls),
        sprite: countingSprite(turretCalls),
        stats: {}
    };

    try {
        const player = recordingRenderer();
        const ship = {
            x: 0, y: 0, rotation: 0, isDead: false,
            getUniqueParts: () => [{ partId: 'cache_test_gun', x: 0, y: 0, rotation: 0 }]
        };
        EntityRenderer.drawShip(player.renderer, ship, 100, 0);
        EntityRenderer.drawShip(player.renderer, ship, 100, 0);
        assert.equal(baseCalls.length, 1);
        assert.equal(turretCalls.length, 2);

        const enemy = recordingRenderer();
        const hostile = {
            x: 0, y: 0, rotation: 0, rotationOffset: 0,
            isDead: false, isWarpingIn: false, hp: 1, maxHp: 1,
            shipParts: [{ partId: 'cache_test_gun', x: 0, y: 0, rotation: 0 }],
            weaponCooldowns: []
        };
        EntityRenderer.drawEnemy(enemy.renderer, hostile);
        EntityRenderer.drawEnemy(enemy.renderer, hostile);
        assert.equal(baseCalls.length, 2);
        assert.equal(turretCalls.length, 4);
        assert.ok(enemy.calls.some(([method]) => method === 'drawImage'));
    } finally {
        delete PartsLibrary.cache_test_gun;
    }
});

test('enemy assemblies do not invent player fallback bases or core effects', () => {
    const turretCalls = [];
    const coreCalls = [];
    PartsLibrary.cache_test_fallback_gun = {
        id: 'cache_test_fallback_gun',
        type: 'weapon',
        width: 1,
        height: 1,
        sprite: countingSprite(turretCalls),
        stats: {}
    };
    PartsLibrary.cache_test_enemy_core = {
        id: 'core',
        type: 'core',
        width: 1,
        height: 1,
        sprite: countingSprite([]),
        coreEffectSprite: countingSprite(coreCalls),
        stats: {}
    };

    try {
        const enemy = recordingRenderer();
        EntityRenderer.drawEnemy(enemy.renderer, {
            x: 0, y: 0, rotation: 0, rotationOffset: 0,
            isDead: false, isWarpingIn: false, hp: 1, maxHp: 1,
            shipParts: [
                { partId: 'cache_test_fallback_gun', x: 0, y: 0, rotation: 0 },
                { partId: 'cache_test_enemy_core', x: 1, y: 0, rotation: 0 }
            ],
            weaponCooldowns: []
        });

        assert.equal(turretCalls.length, 1);
        assert.equal(coreCalls.length, 0);
    } finally {
        delete PartsLibrary.cache_test_fallback_gun;
        delete PartsLibrary.cache_test_enemy_core;
    }
});

test('core effects pass their authored half-pixel pivot to the runtime sprite draw', () => {
    const coreCalls = [];
    PartsLibrary.cache_test_pivot_core = {
        id: 'cache_test_pivot_core',
        type: 'core',
        width: 1,
        height: 1,
        baseSprite: countingSprite([]),
        sprite: countingSprite([]),
        coreEffectSprite: {
            width: 16,
            height: 16,
            draw(...args) { coreCalls.push(args); }
        },
        coreEffectSpinPivot: { x: 7.5, y: 8.5 },
        stats: {}
    };

    try {
        const renderer = recordingRenderer();
        EntityRenderer.drawShip(renderer.renderer, {
            x: 100, y: 80, rotation: 0.25, isDead: false,
            getUniqueParts: () => [{ partId: 'cache_test_pivot_core', x: 0, y: 0, rotation: 0 }]
        });
        assert.equal(coreCalls.length, 1);
        assert.equal(coreCalls[0][4], 7.5 / 16);
        assert.equal(coreCalls[0][5], 8.5 / 16);
    } finally {
        delete PartsLibrary.cache_test_pivot_core;
    }
});
