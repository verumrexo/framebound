const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normalized(x, y) {
    const length = Math.hypot(x, y);
    return length > 0.0001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function addForce(total, x, y, weight = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(weight)) return;
    total.x += x * weight;
    total.y += y * weight;
}

function angleDelta(target, current) {
    let delta = target - current;
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    return delta;
}

export function predictInterceptAngle(source, target, projectileSpeed, prediction = 1) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const speed = Math.max(1, Number(projectileSpeed) || 400);
    const travel = Math.hypot(dx, dy) / speed;
    const vx = Number(target.vx ?? target.ship?.vx) || 0;
    const vy = Number(target.vy ?? target.ship?.vy) || 0;
    return Math.atan2(
        dy + vy * travel * clamp(prediction, 0, 1),
        dx + vx * travel * clamp(prediction, 0, 1)
    );
}

export function createTacticalState(random = Math.random, behavior = {}) {
    const direction = behavior.orbitDirection === 'left'
        ? -1
        : behavior.orbitDirection === 'right'
            ? 1
            : random() < 0.5 ? -1 : 1;
    return {
        intent: 'idle',
        orbitDirection: direction,
        dodgeCooldown: random() * 0.4,
        dodgeReactionTimer: 0,
        dodgeCommitTimer: 0,
        dodgeDirection: { x: 0, y: 0 },
        burstRemaining: Math.max(1, behavior.burstSize || 1),
        burstPauseTimer: random() * 0.35,
        phase: 'calm',
        lastTargetX: null,
        lastTargetY: null,
        targetVx: 0,
        targetVy: 0,
        ramCooldown: 0,
        ramCommitTimer: 0,
        specialCooldown: random() * 2,
        decisionTimer: 0,
        attackWindow: false,
        steering: { x: 0, y: 0 },
        threat: null
    };
}

export function updateTacticalEnemy(enemy, dt, target, {
    projectiles = [],
    asteroids = [],
    lootCrates = [],
    allies = [],
    room = null
} = {}) {
    const step = clamp(Number(dt) || 0, 0, 0.05);
    if (!Number.isFinite(enemy.x)) enemy.x = 0;
    if (!Number.isFinite(enemy.y)) enemy.y = 0;
    if (!Number.isFinite(enemy.rotation)) enemy.rotation = 0;
    if (step <= 0 || !target) {
        return { canFire: false, aimAngle: enemy.rotation || 0 };
    }
    const behavior = enemy.behaviorProfile || enemy.behavior || {};
    const state = enemy.tacticalState || (enemy.tacticalState = createTacticalState(enemy.random, behavior));
    enemy.vx = Number.isFinite(enemy.vx) ? enemy.vx : 0;
    enemy.vy = Number.isFinite(enemy.vy) ? enemy.vy : 0;

    if (state.lastTargetX !== null) {
        const smoothing = 1 - Math.exp(-step * 8);
        const measuredVx = (target.x - state.lastTargetX) / step;
        const measuredVy = (target.y - state.lastTargetY) / step;
        state.targetVx += (clamp(measuredVx, -1000, 1000) - state.targetVx) * smoothing;
        state.targetVy += (clamp(measuredVy, -1000, 1000) - state.targetVy) * smoothing;
    }
    state.lastTargetX = target.x;
    state.lastTargetY = target.y;
    const trackedTarget = { ...target, vx: target.vx ?? state.targetVx, vy: target.vy ?? state.targetVy };

    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const toward = { x: dx / distance, y: dy / distance };
    const tangent = { x: -toward.y * state.orbitDirection, y: toward.x * state.orbitDirection };
    const minRange = Math.max(0, behavior.preferredMinRange || 0);
    const maxRange = Math.max(minRange, behavior.preferredMaxRange || minRange + 1);
    const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    state.phase = hpRatio <= (behavior.berserkHp || 0)
        ? 'berserk'
        : hpRatio <= (behavior.panicHp || 0) ? 'panic' : 'calm';
    let style = behavior.movementStyle || 'approach';
    if (['support', 'deployer', 'mine-layer'].includes(behavior.specialAction) && style === 'approach') style = 'retreat';
    if (['disabler', 'shield-anchor'].includes(behavior.specialAction) && style === 'approach') style = 'hold';
    if (behavior.specialAction === 'phase-switch' && state.phase === 'berserk') style = 'approach';
    if (state.phase === 'panic' && behavior.specialAction !== 'rammer') style = 'retreat';

    const desired = { x: 0, y: 0 };
    if (distance > maxRange) {
        state.intent = style === 'flank' ? 'flanking' : 'closing';
        addForce(desired, toward.x, toward.y, style === 'flank' ? 0.65 : 1);
        if (style === 'flank') addForce(desired, tangent.x, tangent.y, 0.85);
    } else if (distance < minRange) {
        state.intent = 'disengaging';
        addForce(desired, -toward.x, -toward.y, 1);
        if (style === 'orbit' || style === 'strafe' || style === 'flank') addForce(desired, tangent.x, tangent.y, 0.55);
    } else {
        state.intent = style === 'orbit' ? 'orbiting'
            : style === 'strafe' ? 'strafing'
                : style === 'retreat' ? 'kiting'
                    : style === 'flank' ? 'flanking' : 'holding range';
        if (style === 'orbit') addForce(desired, tangent.x, tangent.y, 1);
        else if (style === 'strafe') addForce(desired, tangent.x, tangent.y, 0.8);
        else if (style === 'retreat') addForce(desired, -toward.x, -toward.y, 0.45);
        else if (style === 'flank') addForce(desired, tangent.x, tangent.y, 1);
        else if (style === 'approach') addForce(desired, toward.x, toward.y, 0.08 + (behavior.aggression || 0) * 0.16);
    }

    addObstacleForces(desired, enemy, asteroids, lootCrates);
    addAllyForces(desired, enemy, allies, behavior);
    addFormationForce(desired, enemy, allies, target, behavior);
    addLeashForce(desired, enemy, room);
    updateDodge(state, enemy, projectiles, behavior, step);
    if (state.dodgeCommitTimer > 0) {
        state.intent = 'evading';
        addForce(desired, state.dodgeDirection.x, state.dodgeDirection.y, 2.2 * (behavior.dodgeStrength || 0));
    }
    if (behavior.specialAction === 'rammer') updateRammer(state, desired, toward, distance, behavior, step);

    const direction = normalized(desired.x, desired.y);
    state.steering = direction;
    const acceleration = Math.max(40, behavior.acceleration || enemy.acceleration || 500);
    const speed = Math.max(20, behavior.speed || enemy.speed || 120) * (state.phase === 'berserk' ? 1.25 : 1);
    const hasIntent = Math.hypot(direction.x, direction.y) > 0.01;
    if (hasIntent) {
        enemy.vx += direction.x * acceleration * step;
        enemy.vy += direction.y * acceleration * step;
    }
    const drag = Math.exp(-step * (hasIntent ? 2.2 : 5.5));
    enemy.vx *= drag;
    enemy.vy *= drag;
    const velocity = Math.hypot(enemy.vx, enemy.vy);
    if (velocity > speed) {
        enemy.vx = enemy.vx / velocity * speed;
        enemy.vy = enemy.vy / velocity * speed;
    }
    enemy.x += enemy.vx * step;
    enemy.y += enemy.vy * step;

    const facing = velocity > 5 ? Math.atan2(enemy.vy, enemy.vx) : Math.atan2(dy, dx);
    const turnRate = Math.max(0.2, behavior.turnRate || enemy.turnRate || 3);
    enemy.rotation += clamp(angleDelta(facing, enemy.rotation), -turnRate * step, turnRate * step);
    if (!Number.isFinite(enemy.rotation)) enemy.rotation = 0;
    if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) {
        enemy.x = Number.isFinite(enemy.x) ? enemy.x : 0;
        enemy.y = Number.isFinite(enemy.y) ? enemy.y : 0;
        enemy.vx = 0;
        enemy.vy = 0;
    }

    state.burstPauseTimer = Math.max(0, state.burstPauseTimer - step);
    state.decisionTimer -= step;
    if (state.decisionTimer <= 0) {
        state.attackWindow = !state.attackWindow;
        state.decisionTimer = state.attackWindow
            ? 0.45 + (behavior.aggression || 0.65) * 1.8
            : 0.15 + (behavior.patience || 0.45) * 1.9;
    }
    const canFire = state.attackWindow && state.burstPauseTimer <= 0 && distance <= maxRange * 1.25;
    const projectileSpeed = enemy.weaponCooldowns?.find(weapon => weapon.def?.stats)?.def?.stats?.projectileSpeed || 400;
    const accuracy = clamp(behavior.aimAccuracy ?? 0.88, 0.2, 1);
    const error = (enemy.random() - 0.5) * (1 - accuracy) * 0.7;
    const aimAngle = predictInterceptAngle(enemy, trackedTarget, projectileSpeed, behavior.aimPrediction) + error;
    return { canFire, aimAngle, distance, intent: state.intent, target: trackedTarget };
}

export function noteTacticalShot(enemy) {
    const state = enemy.tacticalState;
    const behavior = enemy.behaviorProfile || enemy.behavior || {};
    if (!state) return;
    state.burstRemaining--;
    if (state.burstRemaining <= 0) {
        state.burstRemaining = Math.max(1, behavior.burstSize || 1);
        state.burstPauseTimer = Math.max(0, behavior.burstPause || 0);
    }
}

function updateDodge(state, enemy, projectiles, behavior, dt) {
    state.dodgeCooldown = Math.max(0, state.dodgeCooldown - dt);
    state.dodgeCommitTimer = Math.max(0, state.dodgeCommitTimer - dt);
    if (state.dodgeCommitTimer > 0) return;
    let threat = null;
    let soonest = Infinity;
    for (const projectile of projectiles || []) {
        if (projectile.isDead || projectile.owner === 'enemy') continue;
        const vx = Number(projectile.vx) || Math.cos(projectile.angle || 0) * (projectile.speed || 0);
        const vy = Number(projectile.vy) || Math.sin(projectile.angle || 0) * (projectile.speed || 0);
        const speedSq = vx * vx + vy * vy;
        if (speedSq < 1) continue;
        const rx = enemy.x - projectile.x;
        const ry = enemy.y - projectile.y;
        const time = clamp((rx * vx + ry * vy) / speedSq, 0, behavior.dodgeLookahead || 0.8);
        const miss = Math.hypot(rx - vx * time, ry - vy * time);
        if (miss < (enemy.radius || 24) + (projectile.radius || 4) + 28 && time < soonest) {
            threat = { projectile, vx, vy, time, miss };
            soonest = time;
        }
    }
    state.threat = threat;
    if (!threat || state.dodgeCooldown > 0 || (behavior.dodgeChance || 0) <= 0) {
        state.dodgeReactionTimer = 0;
        return;
    }
    state.dodgeReactionTimer += dt;
    if (state.dodgeReactionTimer < (behavior.dodgeReaction || 0.24)) return;
    state.dodgeReactionTimer = 0;
    state.dodgeCooldown = 0.8 + enemy.random() * 0.7;
    if (enemy.random() > behavior.dodgeChance) return;
    const cross = threat.vx * (enemy.y - threat.projectile.y) - threat.vy * (enemy.x - threat.projectile.x);
    const side = cross >= 0 ? 1 : -1;
    const normal = normalized(-threat.vy * side, threat.vx * side);
    state.dodgeDirection = normal;
    state.dodgeCommitTimer = 0.3 + (behavior.dodgeStrength || 0.7) * 0.35;
}

function updateRammer(state, desired, toward, distance, behavior, dt) {
    state.ramCooldown = Math.max(0, state.ramCooldown - dt);
    state.ramCommitTimer = Math.max(0, state.ramCommitTimer - dt);
    if (state.ramCommitTimer > 0) {
        state.intent = 'ramming';
        desired.x = toward.x * 2;
        desired.y = toward.y * 2;
    } else if (state.ramCooldown <= 0 && distance < Math.max(350, behavior.preferredMaxRange * 2)) {
        state.ramCommitTimer = 0.8;
        state.ramCooldown = 3.5;
    } else if (state.ramCooldown > 2.2) {
        state.intent = 'recovering';
        addForce(desired, -toward.x, -toward.y, 1.2);
    }
}

function addObstacleForces(total, enemy, asteroids, lootCrates) {
    const obstacles = [
        ...(asteroids || []).filter(item => !item.isDead && !item.isBroken),
        ...(lootCrates || []).filter(item => !item.isOpened && !item.isDead)
    ];
    for (const obstacle of obstacles) {
        const dx = enemy.x - obstacle.x;
        const dy = enemy.y - obstacle.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const safe = (enemy.radius || 24) + (obstacle.radius || 30) + 70;
        if (distance < safe) addForce(total, dx / distance, dy / distance, (safe - distance) / safe * 2.4);
    }
}

function addAllyForces(total, enemy, allies, behavior) {
    let centerX = 0;
    let centerY = 0;
    let count = 0;
    for (const ally of allies || []) {
        if (ally === enemy || ally.isDead) continue;
        const dx = enemy.x - ally.x;
        const dy = enemy.y - ally.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const spacing = Math.max(enemy.radius + (ally.radius || 20), behavior.allySpacing || 80);
        if (distance < spacing) addForce(total, dx / distance, dy / distance, (spacing - distance) / spacing * 2);
        if (distance < spacing * 5) {
            centerX += ally.x;
            centerY += ally.y;
            count++;
        }
    }
    if (count && behavior.cohesion > 0) {
        const toward = normalized(centerX / count - enemy.x, centerY / count - enemy.y);
        addForce(total, toward.x, toward.y, behavior.cohesion * 0.45);
    }
}

function addFormationForce(total, enemy, allies, target, behavior) {
    if (!target || behavior.formation === 'loose' || behavior.cohesion <= 0) return;
    const members = [...new Set([enemy, ...(allies || [])])]
        .filter(ally => !ally.isDead)
        .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    if (members.length < 2) return;
    const index = members.indexOf(enemy);
    if (index < 0) return;
    const spacing = Math.max(40, behavior.allySpacing || 80);
    const range = Math.max(spacing * 1.5,
        ((behavior.preferredMinRange || 0) + (behavior.preferredMaxRange || 360)) * 0.5);
    const towardTarget = normalized(target.x - enemy.x, target.y - enemy.y);
    const tangent = { x: -towardTarget.y, y: towardTarget.x };
    let slotX;
    let slotY;
    if (behavior.formation === 'ring') {
        const angle = TAU * index / members.length;
        slotX = target.x + Math.cos(angle) * range;
        slotY = target.y + Math.sin(angle) * range;
    } else {
        const offset = (index - (members.length - 1) / 2) * spacing;
        const depth = behavior.formation === 'wedge' ? Math.abs(offset) * 0.55 : 0;
        slotX = target.x - towardTarget.x * (range + depth) + tangent.x * offset;
        slotY = target.y - towardTarget.y * (range + depth) + tangent.y * offset;
    }
    const slot = normalized(slotX - enemy.x, slotY - enemy.y);
    const distance = Math.hypot(slotX - enemy.x, slotY - enemy.y);
    addForce(total, slot.x, slot.y,
        Math.min(1.4, distance / spacing) * behavior.cohesion * 0.8);
}

function addLeashForce(total, enemy, room) {
    if (!room || !Number.isFinite(room.width) || !Number.isFinite(room.height)) return;
    const margin = Math.min(180, Math.min(room.width, room.height) * 0.12);
    const minX = room.x + margin;
    const maxX = room.x + room.width - margin;
    const minY = room.y + margin;
    const maxY = room.y + room.height - margin;
    if (enemy.x < minX) addForce(total, 1, 0, 2);
    if (enemy.x > maxX) addForce(total, -1, 0, 2);
    if (enemy.y < minY) addForce(total, 0, 1, 2);
    if (enemy.y > maxY) addForce(total, 0, -1, 2);
}
