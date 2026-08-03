import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { Enemy, getEnemyFloorScaling } = await import('./Enemy.js');

test('enemy weapon spread uses gameplay rng instead of global rng', () => {
    const enemy = new Enemy(0, 0, 'basic', 1, () => 0.5, 'enemy_test');
    enemy.warpTimer = 0;
    enemy.isWarpingIn = false;
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
    const tender = new Enemy(
        0,
        0,
        'repair_tender',
        1,
        () => 0.5,
        'tender'
    );
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
