import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Enemy, getEnemyFloorScaling } = await import('./Enemy.js');
const { BASE_ENEMY_BLUEPRINTS } = await import('../enemies/EnemyBlueprints.js');

function makeEnemy(id = 'nail', specialAction = 'none') {
    const blueprint = structuredClone(BASE_ENEMY_BLUEPRINTS[id]);
    blueprint.parts = [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: 1, y: 0, partId: 'gun_basic', rotation: 0 }
    ];
    blueprint.behavior.specialAction = specialAction;
    blueprint.behavior.aimAccuracy = 1;
    const enemy = new Enemy(0, 0, id, 1, () => 0.5, `${id}_test`, { blueprint, allowDraft: true });
    enemy.warpTimer = 0;
    enemy.isWarpingIn = false;
    enemy.tacticalState.burstPauseTimer = 0;
    return enemy;
}

test('enemy weapon spread uses gameplay rng instead of global rng', () => {
    const enemy = makeEnemy();
    enemy.spotted = true;
    enemy.engagementDist = 1000;
    enemy.random = () => 1;
    enemy.activeBursts = [];
    enemy.weaponCooldowns = [{
        part: { x: 0, y: 0, rotation: 0 },
        def: {
            width: 1,
            height: 1,
            stats: {
                spread: 1,
                projectileType: 'bullet',
                projectileSpeed: 400,
                damage: 5,
                cooldown: 2
            }
        },
        cooldown: 0
    }];
    const projectiles = [];

    enemy.update(0.1, 100, 0, projectiles);

    assert.equal(projectiles.length, 1);
    assert.ok(Math.abs(projectiles[0].angle - 0.5) < 0.000001);
});

test('floor scaling grows without the old exponential stat explosion', () => {
    assert.deepEqual(getEnemyFloorScaling(1), { hp: 1, damage: 1 });
    assert.ok(getEnemyFloorScaling(5).hp < 5);
    assert.ok(getEnemyFloorScaling(5).damage < 3);
    assert.ok(getEnemyFloorScaling(10).hp > getEnemyFloorScaling(5).hp);
});

test('repair tenders heal the most damaged nearby ally on a cooldown', () => {
    const tender = makeEnemy('patcher', 'support');
    const ally = {
        x: 100,
        y: 0,
        hp: 20,
        maxHp: 100,
        isDead: false
    };
    tender.warpTimer = 0;
    tender.spotted = true;
    tender.supportCooldown = 0;

    tender.update(0.1, 300, 0, [], [], [], [tender, ally]);

    assert.equal(ally.hp, 28);
    assert.equal(tender.supportCooldown, 3);
    assert.ok(tender.supportPulseTimer > 0);
});

test('emp freezes movement and firing while its timer still ticks', () => {
    const enemy = makeEnemy();
    enemy.spotted = true;
    enemy.empTimer = 1;
    enemy.weaponCooldowns = [{
        part: { x: 0, y: 0, rotation: 0 },
        def: {
            width: 1,
            height: 1,
            stats: {
                projectileType: 'bullet',
                projectileSpeed: 400,
                damage: 5,
                cooldown: 2
            }
        },
        cooldown: 0
    }];
    const before = [enemy.x, enemy.y];
    const projectiles = [];

    enemy.update(0.25, 100, 0, projectiles);

    assert.equal(enemy.empTimer, 0.75);
    assert.deepEqual([enemy.x, enemy.y], before);
    assert.equal(projectiles.length, 0);
});

test('hacked enemies fire allied projectiles and ownership expires cleanly', () => {
    const enemy = makeEnemy();
    enemy.spotted = true;
    enemy.hackTimer = 1;
    enemy.hackedByPlayerId = 'guest_1';
    enemy.weaponCooldowns = [{
        part: { x: 0, y: 0, rotation: 0 },
        def: {
            width: 1,
            height: 1,
            stats: {
                projectileType: 'bullet',
                projectileSpeed: 400,
                damage: 5,
                cooldown: 2
            }
        },
        cooldown: 0
    }];
    const projectiles = [];

    enemy.update(0.1, 100, 0, projectiles);

    assert.equal(projectiles.length, 1);
    assert.equal(projectiles[0].owner, 'player');
    assert.equal(projectiles[0].sourcePlayerId, 'guest_1');

    enemy.tickStatuses(1);
    assert.equal(enemy.hackTimer, 0);
    assert.equal(enemy.hackedByPlayerId, undefined);
});
