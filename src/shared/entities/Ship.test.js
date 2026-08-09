import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ship } from './Ship.js';
import { PartsLibrary } from '../parts/Part.js';

test('ship placement rejects inherited and unknown part ids without throwing', () => {
    const ship = new Ship();
    ship.parts.clear();

    for (const partId of ['toString', '__proto__', 'missing_part']) {
        assert.equal(ship.canPlaceAt(0, 0, partId, 0), false);
        assert.equal(ship.addPart(0, 0, partId, 0), false);
    }

    assert.equal(ship.parts.size, 0);
});

test('ship placement rejects non-finite geometry without corrupting its grid', () => {
    const ship = new Ship();
    ship.parts.clear();

    for (const [x, y, rotation] of [
        [NaN, 0, 0],
        [0, Infinity, 0],
        [0, 0, -Infinity]
    ]) {
        assert.equal(ship.canPlaceAt(x, y, 'core', rotation), false);
        assert.equal(ship.addPart(x, y, 'core', rotation), false);
    }

    assert.equal(ship.parts.size, 0);
    assert.equal(ship.addPart(0, 0, 'core', 0), true);
});

test('existing 2x4 parts keep exact attachment and rotated footprint rules', () => {
    for (const [rotation, expectedCells] of [
        [0, ['1,-1', '1,0', '1,1', '1,2', '2,-1', '2,0', '2,1', '2,2']],
        [1, ['1,-1', '1,0', '2,-1', '2,0', '3,-1', '3,0', '4,-1', '4,0']]
    ]) {
        const ship = new Ship();
        ship.parts.clear();
        assert.equal(ship.addPart(0, 0, 'core', 0), true);
        assert.equal(ship.canPlaceAt(1, -1, 'custom_1769974460678', rotation), true);
        assert.equal(ship.addPart(1, -1, 'custom_1769974460678', rotation), true);

        const occupied = [...ship.parts.keys()].filter(key => key !== '0,0').sort();
        assert.deepEqual(occupied, expectedCells.sort());
        assert.equal(ship.getUniqueParts().size, 2);
    }
});

test('booster and accelerant parts contribute their actual module stats', () => {
    const ship = new Ship();

    assert.equal(
        ship.addPart(2, 0, 'custom_1768392079955', 0),
        true
    );
    assert.equal(
        ship.addPart(-2, 0, 'custom_1767999991728', 0),
        true
    );

    assert.equal(ship.stats.boosterCount, 1);
    assert.equal(ship.stats.accelerantCount, 1);
});

test('ship cloning preserves valid layouts regardless of map insertion order', () => {
    const ship = new Ship();
    assert.equal(ship.addPart(2, 0, 'hull', 0), true);

    const core = ship.getPart(0, 0);
    const bridge = ship.getPart(1, 0);
    const outer = ship.getPart(2, 0);
    ship.parts = new Map([
        ['0,0', core],
        ['2,0', outer],
        ['1,0', bridge],
        ...[...ship.parts].filter(([key]) =>
            !['0,0', '1,0', '2,0'].includes(key)
        )
    ]);

    const clone = ship.clone();

    assert.equal(clone.getUniqueParts().size, ship.getUniqueParts().size);
    assert.equal(clone.getPart(2, 0)?.partId, 'hull');
    assert.notEqual(clone.getPart(2, 0), outer);
});

test('cleared-room movement doubles acceleration and sustained speed', () => {
    const normal = new Ship();
    const cleared = normal.clone();
    const input = { up: true };

    normal.update(1 / 60, input, { movementMultiplier: 1 });
    cleared.update(1 / 60, input, { movementMultiplier: 2 });

    assert.ok(Math.abs(cleared.vy - normal.vy * 2) < 1e-9);

    for (let i = 0; i < 300; i++) {
        normal.update(1 / 60, input, { movementMultiplier: 1 });
        cleared.update(1 / 60, input, { movementMultiplier: 2 });
    }

    assert.ok(Math.abs(normal.vy + 150) < 1e-9);
    assert.ok(Math.abs(cleared.vy + 300) < 1e-9);
});

test('external client dash keeps the cap without applying ship dash twice', () => {
    const ship = new Ship();
    ship.vy = -400;

    ship.update(0.1, { shift: true }, {
        externalDashActive: true
    });

    assert.equal(ship.dashActiveTimer, 0);
    assert.equal(ship.dashCooldown, 0);
    assert.equal(ship.vy, -368);
});

test('null aim holds a slow ship heading and keeps velocity-facing fallback', () => {
    const stationary = new Ship();
    stationary.rotation = 1.25;

    stationary.update(1 / 60, { aimAngle: null });

    assert.equal(stationary.rotation, 1.25);

    const moving = new Ship();
    moving.rotation = 0;
    moving.vx = 100;

    moving.update(1 / 60, { aimAngle: null });

    assert.ok(moving.rotation > 0);
    assert.ok(moving.rotation < Math.PI / 2);
});

test('passive modules aggregate with safe defaults and remove cleanly', () => {
    const specs = {
        test_captain_a: { cameraZoom: 0.48 },
        test_captain_b: { cameraZoom: 0.55 },
        test_magnet: { pickupRadiusMul: 2 },
        test_magnet_b: { pickupRadiusMul: 1.5 },
        test_coolant: { globalFireRateMul: 1.08 },
        test_range: { projectileSpeedMul: 1.2 },
        test_fmj: { velocityDamageMul: 1.1, velocityPierceAdd: 1 },
        test_aim: { aimAssistAngle: 0.2, aimAssistRange: 400 },
        test_aim_b: { aimAssistAngle: 0.3, aimAssistRange: 750 },
        test_prism: {
            laserSplitCount: 2,
            laserSplitAngle: 0.14,
            laserSplitDamageMul: 0.45
        }
    };
    for (const [id, stats] of Object.entries(specs)) {
        PartsLibrary[id] = {
            id,
            type: 'utility',
            width: 1,
            height: 1,
            stats: { hp: 10, mass: 1, ...stats }
        };
    }

    const ship = new Ship();
    ship.parts.clear();
    assert.equal(ship.addPart(0, 0, 'core'), true);
    let x = 1;
    for (const id of Object.keys(specs)) {
        assert.equal(ship.addPart(x++, 0, id), true);
    }

    assert.equal(ship.stats.cameraZoom, 0.48);
    assert.equal(ship.stats.pickupRadiusMul, 3);
    assert.equal(ship.stats.globalFireRateMul, 1.08);
    assert.equal(ship.stats.projectileSpeedMul, 1.2);
    assert.equal(ship.stats.velocityDamageMul, 1.1);
    assert.equal(ship.stats.velocityPierceAdd, 1);
    assert.equal(ship.stats.aimAssistAngle, 0.3);
    assert.equal(ship.stats.aimAssistRange, 750);
    assert.equal(ship.stats.laserSplitCount, 2);
    assert.equal(ship.stats.laserSplitAngle, 0.14);
    assert.equal(ship.stats.laserSplitDamageMul, 0.45);

    ship.removePart(1, 0);
    ship.removePart(2, 0);
    assert.equal(ship.stats.cameraZoom, 0.6);
    ship.removePart(3, 0);
    assert.equal(ship.stats.pickupRadiusMul, 1.5);

    const empty = new Ship();
    empty.parts.clear();
    empty.recalculateStats();
    assert.deepEqual(
        Object.fromEntries(Object.entries(empty.stats).filter(([key]) => (
            key.includes('Mul') || key.includes('Zoom') ||
            key.includes('Assist') || key.includes('Split') ||
            key.includes('Pierce')
        ))),
        {
            cameraZoom: 0.6,
            pickupRadiusMul: 1,
            globalFireRateMul: 1,
            projectileSpeedMul: 1,
            velocityDamageMul: 1,
            velocityPierceAdd: 0,
            aimAssistAngle: 0,
            aimAssistRange: 0,
            laserSplitCount: 0,
            laserSplitAngle: 0,
            laserSplitDamageMul: 1
        }
    );
});

test('positive damage breaks stealth while zero damage does not', () => {
    const ship = new Ship();
    ship.stealthTimer = 4;
    ship.takeDamage(0);
    assert.equal(ship.stealthTimer, 4);
    ship.takeDamage(1);
    assert.equal(ship.stealthTimer, 0);
});
