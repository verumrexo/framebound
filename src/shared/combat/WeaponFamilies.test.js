import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createPermanentStats,
    getFamilyDamageMultiplier,
    getFamilyFireRateMultiplier,
    getInstalledWeaponFamilies,
    isValidPermanentStats,
    normalizePermanentStats
} from './WeaponFamilies.js';

test('legacy permanent stats gain every new arsenal field safely', () => {
    const stats = normalizePermanentStats({
        hpMul: 1.2,
        regenAdd: 2,
        velocityRateAdd: 0.15,
        laserRateAdd: 0.1,
        speedMul: 1.25,
        turnMul: 1.25,
        missileSpeedMul: 1.5
    });

    assert.equal(stats.hpMul, 1.2);
    assert.equal(stats.rocketRateAdd, 0);
    assert.equal(stats.rocketDamageMul, 1);
    assert.equal(stats.velocityPierce, 0);
    assert.equal(isValidPermanentStats(stats), true);
});

test('weapon family helpers expose installed hardware and real multipliers', () => {
    const ship = {
        permanentStats: {
            ...createPermanentStats(),
            velocityRateAdd: 0.25,
            rocketDamageMul: 1.4
        },
        getUniqueParts: () => new Set([
            { partId: 'dart' },
            { partId: 'laser' },
            { partId: 'hull' }
        ])
    };
    const parts = {
        dart: { stats: { weaponGroup: 'velocity' } },
        laser: { stats: { weaponGroup: 'laser' } },
        hull: { stats: {} }
    };

    assert.deepEqual(getInstalledWeaponFamilies(ship, parts), {
        velocity: 1,
        laser: 1,
        rocket: 0
    });
    assert.equal(getFamilyFireRateMultiplier(ship, 'velocity'), 1.25);
    assert.equal(getFamilyDamageMultiplier(ship, 'rocket'), 1.4);
});
