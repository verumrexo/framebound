import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRONE_BLUEPRINTS, resolveDroneBlueprint } from './DroneBlueprints.js';

const NEW_BLUEPRINT_IDS = [
    'needle', 'interceptor', 'torch', 'lancer', 'bomber',
    'flak', 'bastion', 'mender', 'rammer', 'storm'
];

test('catalog resolves ten new drone blueprints without changing striker fallback', () => {
    assert.equal(Object.keys(DRONE_BLUEPRINTS).length, 11);
    assert.deepEqual(
        Object.keys(DRONE_BLUEPRINTS).filter(id => id !== 'striker'),
        NEW_BLUEPRINT_IDS
    );
    assert.equal(resolveDroneBlueprint('missing').id, 'striker');
    assert.equal(resolveDroneBlueprint('interceptor').targetPriority, 'drones');
    assert.equal(resolveDroneBlueprint('mender').role, 'repair');
    assert.equal(resolveDroneBlueprint('rammer').role, 'ram');
});

test('projectile profiles and support profiles stay data-driven', () => {
    const interceptor = resolveDroneBlueprint('interceptor');
    const flak = resolveDroneBlueprint('flak');
    const mender = resolveDroneBlueprint('mender');
    const rammer = resolveDroneBlueprint('rammer');

    assert.deepEqual(
        {
            projectileType: interceptor.projectileType,
            projectileSpeed: interceptor.projectileSpeed,
            shotCount: interceptor.shotCount,
            spread: interceptor.spread,
            optimalDistance: interceptor.optimalDistance
        },
        {
            projectileType: 'mini_bullet',
            projectileSpeed: 1100,
            shotCount: 2,
            spread: 0.08,
            optimalDistance: 130
        }
    );
    assert.equal(flak.shotCount, 7);
    assert.equal(flak.projectileLifetime, undefined);
    assert.equal(mender.repairAmount, 4);
    assert.equal(rammer.contactRange, 22);
    assert.equal(Object.isFrozen(DRONE_BLUEPRINTS), true);
});

test('all new drone blueprints carry distinct deployed silhouettes', () => {
    const silhouettes = NEW_BLUEPRINT_IDS.map(id => {
        const rows = resolveDroneBlueprint(id).spriteRows;
        assert.equal(rows.length, 8);
        assert.equal(rows.every(row => row.length === 8), true);
        return rows.join('\n');
    });

    assert.equal(new Set(silhouettes).size, NEW_BLUEPRINT_IDS.length);
});
