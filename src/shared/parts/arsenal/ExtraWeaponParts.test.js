import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTRA_WEAPON_PART_SPECS } from './ExtraWeaponParts.js';

const EXPECTED_PARTS = [
    {
        id: 'needler',
        name: 'needler',
        width: 1,
        height: 1,
        stats: {
            hp: 15,
            mass: 2,
            damage: 1.2,
            cooldown: 0.12,
            projectileType: 'mini_bullet',
            projectileSpeed: 1050,
            weaponGroup: 'velocity'
        }
    },
    {
        id: 'twin_dart',
        name: 'twin dart',
        width: 1,
        height: 2,
        stats: {
            hp: 35,
            mass: 4,
            damage: 4,
            cooldown: 0.75,
            projectileSpeed: 900,
            projectileType: 'bullet',
            weaponGroup: 'velocity',
            pelletCount: 2,
            spread: 0.04,
            barrelSpacing: 10
        }
    },
    {
        id: 'heavy_slugger',
        name: 'heavy slugger',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 5,
            damage: 22,
            cooldown: 1.6,
            projectileSpeed: 850,
            projectileType: 'bullet',
            weaponGroup: 'velocity'
        }
    },
    {
        id: 'burst_cannon',
        name: 'burst cannon',
        width: 2,
        height: 2,
        stats: {
            hp: 75,
            mass: 9,
            damage: 4,
            cooldown: 1.8,
            projectileSpeed: 900,
            projectileType: 'bullet',
            weaponGroup: 'velocity',
            burstCount: 5,
            burstInterval: 0.07
        }
    },
    {
        id: 'ricochet_cannon',
        name: 'ricochet cannon',
        width: 1,
        height: 2,
        stats: {
            hp: 35,
            mass: 4,
            damage: 8,
            cooldown: 0.9,
            projectileSpeed: 800,
            projectileType: 'ricochet_slug',
            weaponGroup: 'velocity',
            ricochetCount: 1,
            ricochetRange: 320,
            ricochetDamageMul: 0.7
        }
    },
    {
        id: 'arc_welder',
        name: 'arc welder',
        width: 1,
        height: 1,
        stats: {
            hp: 15,
            mass: 2,
            damage: 3.5,
            cooldown: 0.18,
            projectileType: 'arc_welder',
            weaponGroup: 'laser',
            range: 140,
            lifetime: 0.06
        }
    },
    {
        id: 'pulse_lance',
        name: 'pulse lance',
        width: 1,
        height: 2,
        stats: {
            hp: 35,
            mass: 4,
            damage: 14,
            cooldown: 1.05,
            projectileType: 'laser',
            projectileSpeed: 1500,
            weaponGroup: 'laser'
        }
    },
    {
        id: 'lightning_rod',
        name: 'lightning rod',
        width: 2,
        height: 2,
        stats: {
            hp: 70,
            mass: 8,
            damage: 10,
            cooldown: 1.6,
            projectileType: 'small_laser',
            projectileSpeed: 1800,
            weaponGroup: 'laser',
            baseChainCount: 2
        }
    },
    {
        id: 'micro_missile_pod',
        name: 'micro missile pod',
        width: 1,
        height: 1,
        stats: {
            hp: 20,
            mass: 2,
            damage: 5,
            cooldown: 1.7,
            projectileType: 'guided_rocket',
            projectileSpeed: 520,
            weaponGroup: 'rocket',
            burstCount: 3,
            burstInterval: 0.16,
            lifetime: 2.4
        }
    },
    {
        id: 'torpedo_tube',
        name: 'torpedo tube',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 5,
            damage: 55,
            cooldown: 4.8,
            projectileType: 'torpedo',
            projectileSpeed: 280,
            weaponGroup: 'rocket',
            lifetime: 4,
            aoeRadius: 100
        }
    }
];

function assertSpriteRows(rows, width, height) {
    assert.equal(rows.length, height);
    for (const row of rows) {
        assert.equal(typeof row, 'string');
        assert.equal(row.length, width);
        assert.match(row, /^[012]+$/);
    }
}

function assertDeeplyFrozen(value) {
    if (value === null || typeof value !== 'object') return;
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

test('extra weapon specs lock order, names, dimensions, and tuning', () => {
    assert.equal(EXTRA_WEAPON_PART_SPECS.length, EXPECTED_PARTS.length);

    for (const [index, expected] of EXPECTED_PARTS.entries()) {
        const part = EXTRA_WEAPON_PART_SPECS[index];
        assert.equal(part.id, expected.id);
        assert.equal(part.name, expected.name);
        assert.equal(part.type, 'weapon');
        assert.equal(part.width, expected.width);
        assert.equal(part.height, expected.height);
        assert.deepEqual(part.stats, expected.stats);
        assertSpriteRows(
            part.spriteRows,
            expected.width * 7 + 1,
            expected.height * 7 + 1
        );
    }
});

test('extra weapon silhouettes are distinct hand-authored raster art', () => {
    const silhouettes = EXTRA_WEAPON_PART_SPECS.map(part => part.spriteRows.join('\n'));
    assert.equal(new Set(silhouettes).size, silhouettes.length);
});

test('extra weapon specs are deeply frozen', () => {
    assertDeeplyFrozen(EXTRA_WEAPON_PART_SPECS);
});
