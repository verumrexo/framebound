import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const {
    getAssemblyCache,
    getValidatedAssemblyParts,
    invalidateAssemblyCache,
    SHIP_ASSEMBLY_PROFILES
} = await import('./ShipAssemblyCache.js');
const { drawShipAssembly, getMountedTurretPosition } = await import('./ShipAssemblyRenderer.js');
const { TILE_SIZE } = await import('../../shared/parts/Part.js');

function sprite(width = 20, height = 20, calls = []) {
    return {
        width,
        height,
        scale: 1,
        anchorX: 0.5,
        anchorY: 0.5,
        data: [1],
        colorMap: { 1: '#fff' },
        draw(...args) {
            calls.push(args);
        }
    };
}

function makeParts(spriteOverride = sprite()) {
    return {
        hull: {
            id: 'hull', type: 'hull', width: 1, height: 1,
            sprite: spriteOverride, stats: {}
        },
        gun: {
            id: 'gun', type: 'weapon', width: 1, height: 2,
            sprite: sprite(), baseSprite: sprite(24, 48), stats: {}
        }
    };
}

test('assembly cache validates layout and keys static art, tint, rotation, layout, and ordering', () => {
    const library = makeParts();
    const entity = {};
    const raw = [
        { partId: 'hull', x: 0, y: 0, rotation: 0 },
        { partId: 'gun', x: 2, y: 0, rotation: 1 },
        { partId: 'missing', x: 0, y: 0, rotation: 0 },
        { partId: 'hull', x: Number.NaN, y: 0, rotation: 0 }
    ];
    const parts = getValidatedAssemblyParts(raw, library);
    assert.equal(parts.length, 2);

    const original = getAssemblyCache(entity, parts, '#ff6666');
    assert.equal(getAssemblyCache(entity, parts, '#ff6666'), original);
    assert.notEqual(getAssemblyCache(entity, parts, '#00ffff'), original);

    const rotated = getValidatedAssemblyParts([
        { ...raw[0], rotation: 1 }, raw[1]
    ], library);
    assert.notEqual(getAssemblyCache(entity, rotated, '#ff6666'), original);

    const moved = getValidatedAssemblyParts([
        raw[0], { ...raw[1], x: 3 }
    ], library);
    assert.notEqual(getAssemblyCache(entity, moved, '#ff6666'), original);

    const reordered = getValidatedAssemblyParts([raw[1], raw[0]], library);
    assert.notEqual(getAssemblyCache(entity, reordered, '#ff6666'), original);

    library.hull.sprite = sprite();
    assert.notEqual(getAssemblyCache(entity, parts, '#ff6666'), original);
});

test('assembly cache ignores world position, aim, and cooldown but invalidates on demand', () => {
    const library = makeParts();
    const entity = { x: 4, y: 9, aimAngle: 0, cooldown: 0 };
    const raw = [{ partId: 'hull', x: 0, y: 0, rotation: 0, cooldown: 0 }];
    const parts = getValidatedAssemblyParts(raw, library);
    const first = getAssemblyCache(entity, parts);

    entity.x = 400;
    entity.y = -100;
    entity.aimAngle = Math.PI;
    entity.cooldown = 99;
    raw[0].cooldown = 99;
    assert.equal(getAssemblyCache(entity, parts), first);

    invalidateAssemblyCache(entity);
    assert.notEqual(getAssemblyCache(entity, parts), first);
});

test('assembly cache bounds cover the complete rotated assembly and cache weapon bases only', () => {
    const hullCalls = [];
    const turretCalls = [];
    const baseCalls = [];
    const library = {
        hull: {
            id: 'hull', type: 'hull', width: 1, height: 1,
            sprite: sprite(20, 40, hullCalls), stats: {}
        },
        gun: {
            id: 'gun', type: 'weapon', width: 1, height: 2,
            sprite: sprite(20, 40, turretCalls),
            baseSprite: sprite(24, 48, baseCalls), stats: {}
        }
    };
    const parts = getValidatedAssemblyParts([
        { partId: 'hull', x: -2, y: 0, rotation: 1 },
        { partId: 'gun', x: 3, y: 1, rotation: 1 }
    ], library);
    const cache = getAssemblyCache({}, parts);

    assert.equal(hullCalls.length, 1);
    assert.equal(baseCalls.length, 1);
    assert.equal(turretCalls.length, 0);
    assert.ok(cache.minX <= -34);
    assert.ok(cache.maxX >= 108);
    assert.ok(cache.minY <= -11);
    assert.ok(cache.maxY >= 41);
});

test('cached assembly is drawn once and rotated as one texture', () => {
    const calls = [];
    const ctx = {
        save: () => calls.push('save'),
        restore: () => calls.push('restore'),
        translate: (...args) => calls.push(['translate', ...args]),
        rotate: angle => calls.push(['rotate', angle]),
        drawImage: (...args) => calls.push(['drawImage', ...args])
    };
    const entity = { x: 20, y: 30, rotation: 0.75 };
    const parts = getValidatedAssemblyParts(
        [{ partId: 'hull', x: 0, y: 0, rotation: 0 }],
        makeParts()
    );

    drawShipAssembly(ctx, entity, parts);
    drawShipAssembly(ctx, entity, parts);

    assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'rotate').length, 2);
    assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'drawImage').length, 2);
});

test('enemy mounts retain their base-relative numeric offset without anchor correction', () => {
    const part = {
        def: {
            turretDrawOffset: 10,
            baseSprite: { anchorX: 0, anchorY: 0, width: 20, height: 20, scale: 1 }
        }
    };
    const position = getMountedTurretPosition(part, Math.PI / 2, 0, 0, {
        numericOffsetAngle: Math.PI / 2,
        includeBaseAnchor: false
    });
    assert.ok(Math.abs(position.offsetX) < 0.001);
    assert.equal(position.offsetY, 10);
});

test('enemy profile only caches explicit weapon bases', () => {
    const baseCalls = [];
    const library = {
        fallbackGun: {
            id: 'fallbackGun', type: 'weapon', width: 1, height: 1,
            sprite: sprite(), stats: {}
        },
        explicitGun: {
            id: 'explicitGun', type: 'weapon', width: 1, height: 1,
            sprite: sprite(), baseSprite: sprite(20, 20, baseCalls), stats: {}
        }
    };
    const fallback = getValidatedAssemblyParts([
        { partId: 'fallbackGun', x: 0, y: 0, rotation: 0 }
    ], library);
    assert.equal(
        getAssemblyCache({}, fallback, '#ff6666', SHIP_ASSEMBLY_PROFILES.enemy),
        null
    );

    const explicit = getValidatedAssemblyParts([
        { partId: 'explicitGun', x: 1, y: 0, rotation: 0 }
    ], library);
    const cache = getAssemblyCache({}, explicit, '#ff6666', SHIP_ASSEMBLY_PROFILES.enemy);
    assert.ok(cache);
    assert.equal(baseCalls.length, 1);
});

test('16px authored 1x1 parts render at 32 world px with exactly one source-pixel seam', () => {
    const calls = [];
    const authored = sprite(16, 16, calls);
    authored.scale = 2;
    const library = {
        first: { id: 'first', type: 'hull', width: 1, height: 1, sprite: authored, stats: {} },
        second: { id: 'second', type: 'hull', width: 1, height: 1, sprite: authored, stats: {} }
    };
    const parts = getValidatedAssemblyParts([
        { partId: 'first', x: 0, y: 0, rotation: 0 },
        { partId: 'second', x: 1, y: 0, rotation: 0 }
    ], library);
    getAssemblyCache({}, parts);

    assert.equal(authored.width * authored.scale, 32);
    assert.equal(TILE_SIZE, 30);
    assert.equal(parts[1].localX - parts[0].localX, 30);
    assert.equal((authored.width * authored.scale - TILE_SIZE) / authored.scale, 1);
    assert.deepEqual(calls.map(call => call[1]), [17, 47]);
});
