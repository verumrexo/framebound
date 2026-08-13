import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTacticalState, predictInterceptAngle, updateTacticalEnemy } from './EnemyTacticalAI.js';

function enemy(overrides = {}) {
    const behaviorProfile = {
        movementStyle: 'orbit', preferredMinRange: 150, preferredMaxRange: 250,
        speed: 120, acceleration: 500, turnRate: 3, dodgeChance: 1,
        dodgeStrength: 1, dodgeReaction: .1, dodgeLookahead: 1,
        aimPrediction: 1, aimAccuracy: 1, burstSize: 2, burstPause: .5,
        allySpacing: 80, cohesion: .2, panicHp: .2, berserkHp: .1,
        specialAction: 'none'
    };
    return { x: 0, y: 0, vx: 0, vy: 0, rotation: 0, radius: 20, hp: 100, maxHp: 100, random: () => 0, behaviorProfile, tacticalState: createTacticalState(() => 0, behaviorProfile), ...overrides };
}

test('orbit steering accelerates smoothly instead of teleporting', () => {
    const unit = enemy();
    updateTacticalEnemy(unit, .05, { x: 200, y: 0 }, {});
    assert.ok(Math.hypot(unit.x, unit.y) < 2);
    assert.ok(Math.abs(unit.vy) > 0);
    assert.equal(unit.tacticalState.intent, 'orbiting');
});

test('projectile dodge waits for reaction then commits to one side', () => {
    const unit = enemy();
    const threat = { x: -80, y: 0, vx: 300, vy: 0, owner: 'player', radius: 3, isDead: false };
    updateTacticalEnemy(unit, .05, { x: 200, y: 0 }, { projectiles: [threat] });
    assert.equal(unit.tacticalState.dodgeCommitTimer, 0);
    updateTacticalEnemy(unit, .05, { x: 200, y: 0 }, { projectiles: [threat] });
    assert.ok(unit.tacticalState.dodgeCommitTimer > 0);
    const direction = { ...unit.tacticalState.dodgeDirection };
    updateTacticalEnemy(unit, .05, { x: 200, y: 0 }, { projectiles: [] });
    assert.deepEqual(unit.tacticalState.dodgeDirection, direction);
});

test('predictive aim leads a moving target and invalid dt never makes nan', () => {
    assert.ok(predictInterceptAngle({ x: 0, y: 0 }, { x: 100, y: 0, vx: 0, vy: 100 }, 100, 1) > 0);
    const unit = enemy({ x: Number.NaN });
    updateTacticalEnemy(unit, Infinity, { x: 100, y: 0 }, {});
    assert.equal(Number.isNaN(unit.y), false);
});

test('authored formations produce different real steering decisions', () => {
    const target = { x: 500, y: 0 };
    const ally = enemy({ id: 'ally', x: 0, y: 100 });
    const line = enemy({ id: 'line' });
    const ring = enemy({ id: 'ring' });
    line.behaviorProfile = { ...line.behaviorProfile, formation: 'line', cohesion: 1 };
    ring.behaviorProfile = { ...ring.behaviorProfile, formation: 'ring', cohesion: 1 };
    updateTacticalEnemy(line, 0.05, target, { allies: [line, ally] });
    updateTacticalEnemy(ring, 0.05, target, { allies: [ring, ally] });
    assert.notDeepEqual(line.tacticalState.steering, ring.tacticalState.steering);
});
