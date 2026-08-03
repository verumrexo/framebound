import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ship } from '../entities/Ship.js';
import {
    STARTER_LOADOUTS,
    applyRandomStarterLoadout
} from './StarterLoadouts.js';

test('starter packages stay exclusive, drone-free, and near one damage budget', () => {
    assert.deepEqual(
        STARTER_LOADOUTS.map(loadout => loadout.id),
        ['ballistic', 'laser', 'missile']
    );
    assert.ok(STARTER_LOADOUTS.every(loadout =>
        loadout.theoreticalDps >= 15 && loadout.theoreticalDps <= 15.5
    ));
    assert.ok(STARTER_LOADOUTS.every(loadout =>
        loadout.parts.every(part => part.partId !== 'custom_1769974460678')
    ));
});

test('starter selection replaces the legacy fixed weapons with a valid package', () => {
    for (const [roll, expectedId, expectedWeapons] of [
        [0, 'ballistic', ['gun_basic', 'gun_basic', 'gun_basic']],
        [0.5, 'laser', ['lps', 'lps']],
        [0.999, 'missile', ['rocketle']]
    ]) {
        const ship = new Ship();
        const selected = applyRandomStarterLoadout(ship, () => roll);
        const partIds = [...ship.getUniqueParts()].map(part => part.partId);

        assert.equal(selected.id, expectedId);
        assert.deepEqual(
            partIds.filter(partId => ['gun_basic', 'lps', 'rocketle'].includes(partId)),
            expectedWeapons
        );
        assert.ok(partIds.includes('core'));
        assert.ok(partIds.includes('custom_1767997495375'));
        assert.equal(ship.hp, ship.maxHp);
    }
});
