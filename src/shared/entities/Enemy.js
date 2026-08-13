import { Projectile } from './Projectile.js';
import { TILE_SIZE } from '../parts/PartDefinitions.js';
import { PartsLibrary } from '../parts/Part.js';
import { getEnemyBlueprint } from '../enemies/EnemyBlueprints.js';
import {
    createTacticalState,
    noteTacticalShot,
    updateTacticalEnemy
} from '../enemies/EnemyTacticalAI.js';

export class Enemy {
    constructor(x, y, type = 'nail', floorLevel = 1, randomGen = null, id = null, options = {}) {
        this.id = id || `enemy_${Math.floor(Math.random() * 1000000)}`; // Fallback random if not provided
        this.x = x;
        this.y = y;
        this.type = type;
        this.floorLevel = floorLevel;
        this.random = randomGen || Math.random;
        this.isDead = false;
        this.rotation = 0;
        this.rotationOffset = 0; // Default no offset
        this.spotted = false;
        this.freezeMeter = 0;
        this.frozenTimer = 0;
        this.lastFreezeTick = 0;
        this.empTimer = 0;
        this.hackTimer = 0;
        this.hackedByPlayerId = undefined;

        this.isWarpingIn = true;
        this.warpTimer = 1.0 + (this.random() * 1.0);

        const blueprint = options.blueprint
            ? structuredClone(options.blueprint)
            : getEnemyBlueprint(type, { allowDraft: options.allowDraft === true });
        if (!blueprint) throw new Error(`enemy blueprint ${type} is unavailable`);
        this.blueprintId = blueprint.id;
        this.name = blueprint.name;
        this.tier = blueprint.tier;
        this.encounterRole = blueprint.encounterRole;
        this.isBoss = blueprint.encounterRole === 'boss';
        this.behavior = blueprint.behavior;
        this.behaviorProfile = blueprint.behavior;
        this.rewards = blueprint.rewards;
        this.shipParts = blueprint.parts;
        this.activeBursts = [];
        this.sprite = null;
        this.shootRate = 0;
        this.projectileType = null;
        this.circleAngle = this.random() * Math.PI * 2;
        this.circleDirection = this.random() < 0.5 ? 1 : -1;
        this.vx = 0;
        this.vy = 0;
        this.acceleration = blueprint.stats.acceleration;
        this.tacticalState = createTacticalState(this.random, this.behaviorProfile);
        this.supportCooldown = this.random() * 2;
        this.supportPulseTimer = 0;
        this.weaponCooldowns = this.shipParts.flatMap(part => {
            const def = PartsLibrary[part.partId];
            if (!def || def.type !== 'weapon') return [];
            return [{
                part,
                def,
                cooldown: this.random() * (def.stats.cooldown || 2),
                chargeTimer: 0,
                lockedAngle: null,
                isCharging: false
            }];
        });
        this.maxHp = blueprint.stats.maxHp;
        this.hp = this.maxHp;
        this.radius = TILE_SIZE * blueprint.stats.radiusTiles;
        this.speed = blueprint.stats.speed;
        this.turnRate = blueprint.stats.turnRate;
        this.engagementDist = blueprint.behavior.preferredMaxRange;
        this.detectionDist = blueprint.stats.detectionDist;
        this.damageMultiplier = blueprint.stats.damageMultiplier;

        this.shootCooldown = this.random() * (this.shootRate || 2);

        const scaling = getEnemyFloorScaling(this.floorLevel);
        this.maxHp = Math.round(this.maxHp * scaling.hp);
        this.hp = this.maxHp;
        this.damageMultiplier = (this.damageMultiplier || 1) * scaling.damage;

        // Interpolation
        this.interpolationBuffer = [];
        this.INTERPOLATION_DELAY = 100; // ms
    }

    addSnapshot(data) {
        // data: { x, y, r, hp, w }
        if (data.w !== undefined) this.isWarpingIn = data.w;

        this.interpolationBuffer.push({
            timestamp: Date.now(),
            x: data.x,
            y: data.y,
            rotation: data.r,
            hp: data.hp
        });

        // Prune
        if (this.interpolationBuffer.length > 20) {
            this.interpolationBuffer.splice(0, this.interpolationBuffer.length - 20);
        }
    }

    interpolate(dt, playerX, playerY) {
        this.tickStatuses(dt);
        const renderTime = Date.now() - this.INTERPOLATION_DELAY;

        // Calculate Aim Angle (Visual)
        if (playerX !== undefined && playerY !== undefined) {
            this.aimAngle = Math.atan2(playerY - this.y, playerX - this.x);
        }

        // Find two snapshots
        let fromNode = null;
        let toNode = null;

        for (let i = this.interpolationBuffer.length - 1; i >= 0; i--) {
            const snap = this.interpolationBuffer[i];
            if (snap.timestamp <= renderTime) {
                fromNode = snap;
                toNode = this.interpolationBuffer[i + 1];
                break;
            }
        }

        if (!fromNode) {
            if (this.interpolationBuffer.length > 0) {
                const snap = this.interpolationBuffer[0];
                this.x = snap.x;
                this.y = snap.y;
                this.rotation = snap.rotation;
                this.hp = snap.hp;
            }
            return;
        }

        if (!toNode) {
            const snap = fromNode;
            this.x = snap.x;
            this.y = snap.y;
            this.rotation = snap.rotation;
            this.hp = snap.hp;
            return;
        }

        // Interpolate
        const timeDiff = toNode.timestamp - fromNode.timestamp;
        const progress = (renderTime - fromNode.timestamp) / timeDiff;

        this.x = fromNode.x + (toNode.x - fromNode.x) * progress;
        this.y = fromNode.y + (toNode.y - fromNode.y) * progress;

        // Rotation Lerp
        let rotDiff = toNode.rotation - fromNode.rotation;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        this.rotation = fromNode.rotation + rotDiff * progress;

        this.hp = fromNode.hp; // HP usually discrete, stick to older state or latest known

    }

    takeDamage(amount, sourceProjectileType = null) {
        if (this.isDead) return;
        this.hp -= amount;

        // Status Effects
        if (sourceProjectileType === 'beam_freeze') {
            const now = Date.now();
            if (this.lastFreezeTick > 0) {
                const elapsed = Math.min(now - this.lastFreezeTick, 200);
                this.freezeMeter += (elapsed / 666); // 1.5 per second (0.5 decay = 1.0 net)
            }
            this.lastFreezeTick = now;

            if (this.freezeMeter >= 3.0) {
                const freezeDuration = this.isBoss ? 3.0 : 5.0;
                this.frozenTimer = freezeDuration;
                this.freezeMeter = 0;
            }
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    tickStatuses(dt) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (this.frozenTimer > 0) {
            this.frozenTimer = Math.max(0, this.frozenTimer - dt);
        }
        if (this.freezeMeter > 0) {
            this.freezeMeter = Math.max(0, this.freezeMeter - dt * 0.5);
        }
        if (this.empTimer > 0) {
            this.empTimer = Math.max(0, this.empTimer - dt);
        }
        if (this.hackTimer > 0) {
            this.hackTimer = Math.max(0, this.hackTimer - dt);
            if (this.hackTimer === 0) this.hackedByPlayerId = undefined;
        } else if (this.hackedByPlayerId !== undefined) {
            this.hackedByPlayerId = undefined;
        }
    }

    spawnProjectile(projectiles, x, y, angle, type, speed, damage, lifetime = null) {
        const hacked = this.hackTimer > 0 &&
            this.hackedByPlayerId !== null &&
            this.hackedByPlayerId !== undefined;
        const projectile = new Projectile(
            x,
            y,
            angle,
            type,
            speed,
            hacked ? 'player' : 'enemy',
            damage,
            lifetime,
            this.random
        );
        if (hacked) projectile.sourcePlayerId = this.hackedByPlayerId;
        projectiles.push(projectile);
        return projectile;
    }

    /**
     * Check if a projectile at (px, py) hits any active shield on this enemy.
     * Returns { hit: true, partData } if blocked, { hit: false } otherwise.
     * On hit, puts that shield on cooldown.
     */
    checkShieldHit(px, py) {
        if (!this.shipParts || this.shipParts.length === 0) return { hit: false };

        const shipCos = Math.cos(this.rotation + (this.rotationOffset || 0));
        const shipSin = Math.sin(this.rotation + (this.rotationOffset || 0));

        for (const partData of this.shipParts) {
            const def = PartsLibrary[partData.partId];
            if (!def || def.type !== 'shield') continue;

            // Check if shield is on cooldown
            if (partData.shieldCooldown && partData.shieldCooldown > 0) continue;

            // Calculate shield world position
            const isRotated = ((partData.rotation || 0) % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;
            const localCX = (partData.x + (w - 1) / 2) * TILE_SIZE;
            const localCY = (partData.y + (h - 1) / 2) * TILE_SIZE;
            const shieldWorldX = this.x + (localCX * shipCos - localCY * shipSin);
            const shieldWorldY = this.y + (localCX * shipSin + localCY * shipCos);

            // Shield radius based on part size and scale factor
            const shieldRadius = (def.width * TILE_SIZE / 2) * (def.stats.shieldRadiusScale || 1.4);

            // Distance check
            const dx = px - shieldWorldX;
            const dy = py - shieldWorldY;
            const distSq = dx * dx + dy * dy;

            if (distSq < shieldRadius * shieldRadius) {
                // Hit! Put shield on cooldown
                partData.shieldCooldown = def.stats.shieldCooldown || 3.0;
                return { hit: true, partData, shieldX: shieldWorldX, shieldY: shieldWorldY };
            }
        }

        return { hit: false };
    }

    /**
     * Check if a point (px, py) hits any part on this enemy.
     * Uses rotated rectangle collision for accurate per-part detection.
     * @param {number} px - Projectile X position
     * @param {number} py - Projectile Y position
     * @param {number} pRadius - Projectile radius (optional, default 4)
     * @returns {{ hit: boolean, partData?: object }}
     */
    checkPartHit(px, py, pRadius = 4) {
        if (!this.shipParts || this.shipParts.length === 0) {
            // Fallback to radius-based collision for enemies without parts
            const dx = px - this.x;
            const dy = py - this.y;
            const distSq = dx * dx + dy * dy;
            const minDist = pRadius + (this.radius || 20);
            if (distSq < minDist * minDist) {
                return { hit: true };
            }
            return { hit: false };
        }

        const shipAngle = this.rotation + (this.rotationOffset || 0);
        const shipCos = Math.cos(shipAngle);
        const shipSin = Math.sin(shipAngle);

        for (const partData of this.shipParts) {
            const def = PartsLibrary[partData.partId];
            if (!def) continue;

            // Calculate part world position and size
            const isRotated = ((partData.rotation || 0) % 2 !== 0);
            const partW = (isRotated ? def.height : def.width) * TILE_SIZE;
            const partH = (isRotated ? def.width : def.height) * TILE_SIZE;
            const localCX = (partData.x + (isRotated ? def.height : def.width) / 2 - 0.5) * TILE_SIZE;
            const localCY = (partData.y + (isRotated ? def.width : def.height) / 2 - 0.5) * TILE_SIZE;
            const partWorldX = this.x + (localCX * shipCos - localCY * shipSin);
            const partWorldY = this.y + (localCX * shipSin + localCY * shipCos);

            // Transform projectile to part's local space (unrotate)
            const dx = px - partWorldX;
            const dy = py - partWorldY;
            const localX = dx * Math.cos(-shipAngle) - dy * Math.sin(-shipAngle);
            const localY = dx * Math.sin(-shipAngle) + dy * Math.cos(-shipAngle);

            // Expand hitbox by projectile radius for point-in-rect check
            const halfW = partW / 2 + pRadius;
            const halfH = partH / 2 + pRadius;

            if (Math.abs(localX) < halfW && Math.abs(localY) < halfH) {
                return { hit: true, partData, partWorldX, partWorldY };
            }
        }

        return { hit: false };
    }

    update(dt, playerX, playerY, projectiles, asteroids = [], lootCrates = [], allEnemies = [], room = null, targetState = null) {
        if (this.isDead) return;

        this.tickStatuses(dt);

        if (this.warpTimer > 0) {
            this.warpTimer -= dt;
            if (this.warpTimer > 0) {
                this.isWarpingIn = true;
                return;
            } else {
                this.isWarpingIn = false;
            }
        }

        // DEBUG: Catch NaN entry
        if (isNaN(this.x) || isNaN(this.y) || isNaN(this.rotation)) {
            console.error(`[Enemy] NaN Detected at START of Update! ID: ${this.type} `, this.x, this.y, this.rotation);
            // reset to safe?
            return;
        }

        // Frozen Logic
        if (this.frozenTimer > 0) {
            return;
        }
        if (this.supportPulseTimer > 0) this.supportPulseTimer -= dt;

        if (this.empTimer > 0) return;

        const tactical = updateTacticalEnemy(this, dt, {
            ...(targetState || {}),
            x: playerX,
            y: playerY
        }, {
            projectiles,
            asteroids,
            lootCrates,
            allies: allEnemies,
            room
        });
        this.aimAngle = tactical.aimAngle;
        this.canFireTactical = tactical.canFire;
        this.spotted = true;
        this.updateSpecialAction(dt, allEnemies);

        // --- SHOOTING LOGIC ---
        if (this.weaponCooldowns && this.weaponCooldowns.length > 0) {
            // Process active bursts
            for (let i = this.activeBursts.length - 1; i >= 0; i--) {
                const burst = this.activeBursts[i];
                burst.timer -= dt;
                if (burst.timer <= 0) {
                    const partAngle = (burst.part.rotation || 0) * (Math.PI / 2);
                    const isRotated = ((burst.part.rotation || 0) % 2 !== 0);
                    const w = isRotated ? burst.def.height : burst.def.width;
                    const h = isRotated ? burst.def.width : burst.def.height;
                    const localX = (burst.part.x + (w - 1) / 2) * TILE_SIZE;
                    const localY = (burst.part.y + (h - 1) / 2) * TILE_SIZE;

                    const shipAngle = this.rotation + (this.rotationOffset || 0);
                    const cos = Math.cos(shipAngle);
                    const sin = Math.sin(shipAngle);
                    const worldX = this.x + (localX * cos - localY * sin);
                    const worldY = this.y + (localX * sin + localY * cos);

                    const dx = playerX - worldX;
                    const dy = playerY - worldY;
                    const angleToPlayer = Number.isFinite(this.aimAngle)
                        ? this.aimAngle
                        : Math.atan2(dy, dx);

                    const spread = (this.random() - 0.5) * (burst.def.stats.spread || 0);
                    const pType = burst.def.stats.projectileType || 'bullet';
                    const pSpeed = burst.def.stats.projectileSpeed || (pType === 'laser' || pType === 'small_laser' ? 800 : 400);
                    const baseDamage = burst.def.stats.damage || 5;
                    const finalDamage = baseDamage * (this.damageMultiplier || 1);

                    this.spawnProjectile(projectiles, worldX, worldY, angleToPlayer + spread, pType, pSpeed, finalDamage);
                    noteTacticalShot(this);

                    burst.count--;
                    if (burst.count <= 0) {
                        this.activeBursts.splice(i, 1);
                    } else {
                        burst.timer = burst.def.stats.burstInterval || 0.1;
                    }
                }
            }

            // Check cooldowns
            // Check cooldowns
            for (const wep of this.weaponCooldowns) {
                // Ensure properties exist (for saved games / old enemies)
                if (typeof wep.chargeTimer === 'undefined') wep.chargeTimer = 0;

                // If on cooldown, reduce it
                if (wep.cooldown > 0) {
                    wep.cooldown -= dt;
                    continue;
                }
                if (!this.canFireTactical) continue;

                // Ready to fire (or start charging)
                const chargeStats = wep.def.stats.chargeTime || 0;

                if (chargeStats > 0) {
                    // HAS CHARGE TIME
                    wep.isCharging = true;
                    wep.chargeTimer += dt;

                    // Logic for Aiming vs Locking
                    // Lock aim after 60% of charge
                    const lockThreshold = chargeStats * 0.6;

                    let aimAtAngle = 0;

                    // Calculate current aim info
                    // Local Part Pos
                    const partAngle = (wep.part.rotation || 0) * (Math.PI / 2);
                    const isRotated = ((wep.part.rotation || 0) % 2 !== 0);
                    const w = isRotated ? wep.def.height : wep.def.width;
                    const h = isRotated ? wep.def.width : wep.def.height;
                    const localX = (wep.part.x + (w - 1) / 2) * TILE_SIZE;
                    const localY = (wep.part.y + (h - 1) / 2) * TILE_SIZE;

                    const shipAngle = this.rotation + (this.rotationOffset || 0);
                    const cos = Math.cos(shipAngle);
                    const sin = Math.sin(shipAngle);
                    const worldX = this.x + (localX * cos - localY * sin);
                    const worldY = this.y + (localX * sin + localY * cos);

                    const dx = playerX - worldX;
                    const dy = playerY - worldY;
                    const currentAngleToPlayer = Number.isFinite(this.aimAngle)
                        ? this.aimAngle
                        : Math.atan2(dy, dx);

                    if (wep.chargeTimer < lockThreshold) {
                        // Track Player
                        wep.lockedAngle = currentAngleToPlayer;
                    }
                    // Else: keep old wep.lockedAngle

                    // Check if charge complete
                    if (wep.chargeTimer >= chargeStats) {
                        // FIRE!
                        // Logic same as single shot, but use lockedAngle
                        const spread = (this.random() - 0.5) * (wep.def.stats.spread || 0);
                        const pType = wep.def.stats.projectileType || 'bullet';
                        const pSpeed = wep.def.stats.projectileSpeed || (pType === 'laser' || pType === 'small_laser' ? 800 : 400);
                        const baseDamage = wep.def.stats.damage || 5;
                        const finalDamage = baseDamage * (this.damageMultiplier || 1);

                        // Use locked angle (or current if something failed)
                        const fireAngle = (wep.lockedAngle !== null ? wep.lockedAngle : currentAngleToPlayer) + spread;

                        this.spawnProjectile(projectiles, worldX, worldY, fireAngle, pType, pSpeed, finalDamage);
                        noteTacticalShot(this);

                        // Reset
                        wep.cooldown = wep.def.stats.cooldown || 2;
                        wep.chargeTimer = 0;
                        wep.isCharging = false;
                        wep.lockedAngle = null;

                        this.audio?.play('shoot_' + (pType === 'railgun' ? 'rail_shot' : (pType === 'saber' ? 'lsr' : 'lps')), { volume: 0.6 });
                    }

                } else {
                    // INSTANT FIRE (Previous Logic)
                    const burstCount = wep.def.stats.burstCount || 1;
                    if (burstCount > 1) {
                        this.activeBursts.push({
                            part: wep.part,
                            def: wep.def,
                            count: burstCount,
                            timer: 0
                        });
                        wep.cooldown = wep.def.stats.cooldown || 2;
                    } else {
                        // Single shot
                        const partAngle = (wep.part.rotation || 0) * (Math.PI / 2);
                        const isRotated = ((wep.part.rotation || 0) % 2 !== 0);
                        const w = isRotated ? wep.def.height : wep.def.width;
                        const h = isRotated ? wep.def.width : wep.def.height;
                        const localX = (wep.part.x + (w - 1) / 2) * TILE_SIZE;
                        const localY = (wep.part.y + (h - 1) / 2) * TILE_SIZE;

                        const shipAngle = this.rotation + (this.rotationOffset || 0);
                        const cos = Math.cos(shipAngle);
                        const sin = Math.sin(shipAngle);
                        const worldX = this.x + (localX * cos - localY * sin);
                        const worldY = this.y + (localX * sin + localY * cos);

                        const dx = playerX - worldX;
                        const dy = playerY - worldY;
                        const angleToPlayer = Number.isFinite(this.aimAngle)
                            ? this.aimAngle
                            : Math.atan2(dy, dx);

                        const spread = (this.random() - 0.5) * (wep.def.stats.spread || 0);
                        const pType = wep.def.stats.projectileType || 'bullet';
                        const pSpeed = wep.def.stats.projectileSpeed || (pType === 'laser' || pType === 'small_laser' ? 800 : 400);
                        const baseDamage = wep.def.stats.damage || 5;
                        const finalDamage = baseDamage * (this.damageMultiplier || 1);

                        this.spawnProjectile(projectiles, worldX, worldY, angleToPlayer + spread, pType, pSpeed, finalDamage);
                        noteTacticalShot(this);
                        wep.cooldown = wep.def.stats.cooldown || 2;
                    }
                }
            }
        } else {
            // Basic enemy shooting
            if (this.shootRate > 0) {
                this.shootCooldown -= dt;
                if (this.shootCooldown <= 0) {
                    const pSpeed = this.projectileType === 'laser' ? 800 : 400;
                    this.spawnProjectile(projectiles, this.x, this.y, this.rotation, this.projectileType, pSpeed, 10);
                    this.shootCooldown = this.shootRate;
                }
            }
        }
    }

    updateSpecialAction(dt, allEnemies) {
        if (this.behaviorProfile?.specialAction !== 'support') return;
        this.supportCooldown -= Math.max(0, Math.min(0.05, Number(dt) || 0));
        if (this.supportCooldown > 0) return;
        const damaged = (allEnemies || [])
            .filter(other => other !== this && !other.isDead && other.hp < other.maxHp &&
                Math.hypot(other.x - this.x, other.y - this.y) <= 600)
            .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (!damaged) {
            this.supportCooldown = 0.5;
            return;
        }
        damaged.hp = Math.min(damaged.maxHp, damaged.hp + Math.max(8, damaged.maxHp * 0.08));
        this.supportPulseTimer = 0.45;
        this.supportTargetX = damaged.x;
        this.supportTargetY = damaged.y;
        this.supportCooldown = 3;
    }

}

export function getEnemyFloorScaling(floorLevel) {
    const floorIndex = Math.max(0, Math.floor(floorLevel || 1) - 1);
    return {
        hp: 1 + floorIndex * 0.55 + floorIndex * floorIndex * 0.06,
        damage: 1 + floorIndex * 0.22 + floorIndex * floorIndex * 0.018
    };
}
