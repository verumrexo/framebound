import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUESTED_ARSENAL_PART_SPECS } from './RequestedArsenalParts.js';

const EXPECTED = [
    {
        id: 'warp_gate',
        name: 'warp gate',
        type: 'utility',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            activeAbility: 'blink',
            abilityCooldown: 7,
            abilityRange: 260
        }
    },
    {
        id: 'mine_placer',
        name: 'mine placer',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            damage: 18,
            cooldown: 2.6,
            projectileType: 'proximity_mine',
            weaponGroup: 'rocket',
            armingTime: 0.65,
            triggerRadius: 80,
            aoeRadius: 90,
            lifetime: 18
        }
    },
    {
        id: 'captain_seat',
        name: 'captain seat',
        type: 'utility',
        width: 2,
        height: 2,
        stats: { hp: 80, mass: 8, cameraZoom: 0.48 }
    },
    {
        id: 'beam_sword',
        name: 'beam sword',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            damage: 11.8,
            cooldown: 0.85,
            projectileType: 'beam_sword',
            weaponGroup: 'laser',
            range: 120,
            lifetime: 0.22
        }
    },
    {
        id: 'shrapnel_grenade',
        name: 'shrapnel grenade',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            damage: 6,
            cooldown: 3.2,
            projectileType: 'shrapnel_grenade',
            weaponGroup: 'rocket',
            lifetime: 1.35,
            aoeRadius: 70,
            shrapnelCount: 10,
            shrapnelDamage: 2.4
        }
    },
    {
        id: 'decoy',
        name: 'decoy',
        type: 'utility',
        width: 1,
        height: 2,
        stats: {
            hp: 40,
            mass: 4,
            activeAbility: 'decoy',
            abilityCooldown: 12,
            abilityDuration: 6,
            decoyHp: 35,
            abilityRange: 180
        }
    },
    {
        id: 'stealth',
        name: 'stealth',
        type: 'utility',
        width: 1,
        height: 2,
        stats: {
            hp: 35,
            mass: 3,
            activeAbility: 'stealth',
            abilityCooldown: 14,
            abilityDuration: 4
        }
    },
    {
        id: 'hack_dart',
        name: 'hack dart',
        type: 'weapon',
        width: 1,
        height: 2,
        stats: {
            hp: 35,
            mass: 4,
            damage: 1,
            cooldown: 6,
            projectileType: 'hack_dart',
            projectileSpeed: 900,
            weaponGroup: 'utility',
            hackDuration: 8
        }
    },
    {
        id: 'auto_aim',
        name: 'auto aim',
        type: 'utility',
        width: 1,
        height: 1,
        stats: {
            hp: 18,
            mass: 2,
            aimAssistAngle: 0.2443460953,
            aimAssistRange: 750
        }
    },
    {
        id: 'prism',
        name: 'prism',
        type: 'utility',
        width: 1,
        height: 1,
        stats: {
            hp: 18,
            mass: 2,
            laserSplitCount: 2,
            laserSplitAngle: 0.1396263402,
            laserSplitDamageMul: 0.45
        }
    },
    {
        id: 'emp',
        name: 'emp',
        type: 'utility',
        width: 2,
        height: 2,
        stats: {
            hp: 75,
            mass: 8,
            activeAbility: 'emp',
            abilityCooldown: 16,
            abilityRadius: 360,
            abilityDuration: 3,
            bossDuration: 1.25
        }
    },
    {
        id: 'fmj',
        name: 'fmj',
        type: 'utility',
        width: 1,
        height: 1,
        stats: {
            hp: 18,
            mass: 2,
            velocityDamageMul: 1.1,
            velocityPierceAdd: 1
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

function assertDeepFrozen(value) {
    assert.equal(Object.isFrozen(value), true);
    if (value === null || typeof value !== 'object') return;
    for (const child of Object.values(value)) assertDeepFrozen(child);
}

test('exports all twelve requested parts in manager-defined order and tuning', () => {
    assert.equal(REQUESTED_ARSENAL_PART_SPECS.length, EXPECTED.length);

    for (const [index, expected] of EXPECTED.entries()) {
        const actual = REQUESTED_ARSENAL_PART_SPECS[index];
        assert.equal(actual.id, expected.id);
        assert.equal(actual.name, expected.name);
        assert.equal(actual.type, expected.type);
        assert.equal(actual.width, expected.width);
        assert.equal(actual.height, expected.height);
        assert.deepEqual(actual.stats, expected.stats);
    }
});

test('every requested part has exact pixel geometry and a legal hand-authored palette', () => {
    for (const part of REQUESTED_ARSENAL_PART_SPECS) {
        assertSpriteRows(
            part.spriteRows,
            part.width * 7 + 1,
            part.height * 7 + 1
        );
    }
});

test('all requested part art is distinct', () => {
    const silhouettes = REQUESTED_ARSENAL_PART_SPECS.map(part =>
        part.spriteRows.join('\n')
    );
    assert.equal(new Set(silhouettes).size, silhouettes.length);
});

test('the exported arsenal data is deeply frozen', () => {
    assertDeepFrozen(REQUESTED_ARSENAL_PART_SPECS);
});
