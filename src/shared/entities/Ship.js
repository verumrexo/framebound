import { PartsLibrary, PartType, TILE_SIZE } from '../parts/Part.js';
import { Collision } from '../CollisionSystem.js';
import { createPermanentStats } from '../combat/WeaponFamilies.js';
import {
    clamp,
    createShipBuildProfile,
    massMovementMultipliers
} from '../combat/ShipBuildProfile.js';

export class Ship {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;

        this.parts = new Map(); // key: "x,y", value: PartInstance
        this.stats = {
            totalHp: 0,
            totalMass: 0,
            thrust: 0,
            accelerantCount: 0,
            regen: 0,
            laserCount: 0,
            rocketCount: 0,
            velocityCount: 0,
            rocketBayCount: 0,
            droneCount: 0,
            boosterCount: 0,
            boosterPartId: null,
            turnSpeed: 0,
            cameraZoom: 0.6,
            pickupRadiusMul: 1,
            globalFireRateMul: 1,
            projectileSpeedMul: 1,
            velocityDamageMul: 1,
            velocityPierceAdd: 0,
            aimAssistAngle: 0,
            aimAssistRange: 0,
            laserSplitCount: 0,
            laserSplitAngle: 0,
            laserSplitDamageMul: 1
        };

        // Permanent Upgrades (Level Up System)
        this.permanentStats = createPermanentStats();

        this.hp = 0;
        this.maxHp = 0;
        this.isDead = false;
        this.combatSilenceTimer = 999;
        this.ambushReady = false;

        // Dash State
        this.dashCooldown = 0;
        this.dashMaxCooldown = 10;
        this.dashActiveTimer = 0;
        this.dashDuration = 1.5;
        this.dashPower = 4000;

        // Default Loadout (Core at 0,0) - Orientation Fixed
        this.addPart(0, 0, 'core');
        this.addPart(0, -1, 'rocketle', 1); // Front (Up) - Rot 1
        this.addPart(0, 1, 'custom_1767997495375', 0); // Back (Down) - Rot 0
        this.addPart(-1, 0, 'gun_basic', 0); // Left - Rot 0
        this.addPart(1, 0, 'gun_basic', 0);  // Right - Rot 0

        this.hp = this.maxHp;
    }

    update(dt, input, {
        movementMultiplier = 1.0,
        externalDashActive = null
    } = {}) {
        if (this.isDead) return;

        // --- Dash Logic ---
        const boosterCount = this.stats.boosterCount || 0;
        const usesExternalDash = typeof externalDashActive === 'boolean';

        if (!usesExternalDash) {
            if (this.dashCooldown > 0) {
                this.dashCooldown -= dt;
            }

            // The shared ship owns dash on the server. The local game supplies
            // its external dash state so the same force is not applied twice.
            if (boosterCount > 0 && input && input.shift && this.dashCooldown <= 0) {
                const actualMaxCooldown = Math.max(1.0, this.dashMaxCooldown / boosterCount);
                this.dashActiveTimer = this.dashDuration;
                this.dashCooldown = actualMaxCooldown;
            }

            if (this.dashActiveTimer > 0) {
                this.dashActiveTimer -= dt;
            }
        }
        const dashActive = usesExternalDash
            ? externalDashActive
            : this.dashActiveTimer > 0;

        // --- Movement Physics ---
        // Base Stats
        const baseThrust = (this.stats.thrust !== undefined) ? this.stats.thrust : 0;
        const thrustMultiplier = 1 + (baseThrust * 0.05);

        const levelBonus = 1.0; // Pass level?

        const profile = this.stats.profile || createShipBuildProfile(this, PartsLibrary);
        const massMovement = massMovementMultipliers(this.stats.totalMass);
        const quietSpeed = profile.doctrineId === 'phantom' && this.combatSilenceTimer >= profile.quietSpeedDelay
            ? profile.quietSpeedMul
            : 1;
        const accelerationFactor = clamp(
            massMovement.acceleration * profile.accelerationMul,
            0.4,
            2
        );
        const speedFactor = clamp(
            massMovement.speed * profile.speedMul * quietSpeed,
            0.4,
            2
        );
        const currentAccel = 2500 * thrustMultiplier * levelBonus * movementMultiplier *
            accelerationFactor;

        // Max VELOCITY
        let maxSpeed = 150 * thrustMultiplier * levelBonus * movementMultiplier *
            speedFactor;
        if (dashActive) {
            maxSpeed *= 2.5;
        }

        let ax = 0;
        let ay = 0;

        if (input) {
            if (input.up) ay = -1;
            if (input.down) ay = 1;
            if (input.left) ax = -1;
            if (input.right) ax = 1;

            // Analog support (if provided)
            if (input.analogX !== undefined) ax = input.analogX;
            if (input.analogY !== undefined) ay = input.analogY;
        }

        // Normalize
        if (ax !== 0 || ay !== 0) {
            const len = Math.sqrt(ax * ax + ay * ay);
            if (len > 1) {
                ax /= len;
                ay /= len;
            }
        }

        // Apply Acceleration
        if (ax !== 0 || ay !== 0) {
            this.vx += ax * currentAccel * dt;
            this.vy += ay * currentAccel * dt;
        }

        // Apply Dash Force
        if (dashActive && !usesExternalDash) {
            const angle = this.rotation - Math.PI / 2;
            this.vx += Math.cos(angle) * this.dashPower * dt;
            this.vy += Math.sin(angle) * this.dashPower * dt;
        }

        // Friction
        const friction = (ax === 0 && ay === 0) ? 0.92 : 0.96;
        this.vx *= friction;
        this.vy *= friction;

        // Speed Cap
        const vSq = this.vx * this.vx + this.vy * this.vy;
        if (vSq > maxSpeed * maxSpeed) {
            const vLen = Math.sqrt(vSq);
            this.vx = (this.vx / vLen) * maxSpeed;
            this.vy = (this.vy / vLen) * maxSpeed;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // --- Rotation Logic ---
        let targetRotation = null;

        // Aim Angle from input
        if (Number.isFinite(input?.aimAngle)) {
            targetRotation = input.aimAngle;
        } else {
            // Fallback: Move direction if fast enough
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > 50) {
                targetRotation = Math.atan2(this.vy, this.vx) + Math.PI / 2;
            }
        }

        if (targetRotation !== null) {
            let diff = targetRotation - this.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            const baseTurnRate = 5.0;
            const currentMass = this.stats.totalMass || 5;
            let turnRate = (Math.max(0.5, baseTurnRate * (5 / currentMass)) + (this.stats.turnSpeed || 0));
            turnRate *= profile.turnMul;

            const maxStep = turnRate * dt;

            if (Math.abs(diff) > maxStep) {
                this.rotation += Math.sign(diff) * maxStep;
            } else {
                this.rotation = targetRotation;
            }
        }
    }

    takeDamage(amount) {
        if (this.isDead || this.godMode) return;
        if (Number.isFinite(amount) && amount > 0) {
            this.stealthTimer = 0;
        }
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    canPlaceAt(x, y, partId, rotation = 0) {
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(rotation) ||
            !Object.hasOwn(PartsLibrary, partId)
        ) {
            return false;
        }

        const def = PartsLibrary[partId];

        if (this.getUniqueGroupConflict(partId)) return false;

        const isRotated = (rotation % 2 !== 0);
        const w = isRotated ? def.height : def.width;
        const h = isRotated ? def.width : def.height;

        let hasCollision = false;
        let hasAdjacency = false;

        // If ship is totally empty (shouldn't happen with core), allow anything
        if (this.parts.size === 0) return true;

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                const cx = x + i;
                const cy = y + j;

                // Collision Check
                if (this.parts.has(`${cx},${cy}`)) {
                    hasCollision = true;
                }

                // Adjacency Check (Up, Down, Left, Right)
                if (
                    this.parts.has(`${cx + 1},${cy}`) ||
                    this.parts.has(`${cx - 1},${cy}`) ||
                    this.parts.has(`${cx},${cy + 1}`) ||
                    this.parts.has(`${cx},${cy - 1}`)
                ) {
                    hasAdjacency = true;
                }
            }
        }

        return !hasCollision && hasAdjacency;
    }

    getUniqueGroupConflict(partId) {
        const definition = PartsLibrary[partId];
        if (!definition?.uniqueGroup) return null;
        for (const part of this.getUniqueParts()) {
            const installed = PartsLibrary[part.partId];
            if (installed?.uniqueGroup === definition.uniqueGroup) return installed;
        }
        return null;
    }

    addPart(x, y, partId, rotation = 0) {
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(rotation) ||
            !Object.hasOwn(PartsLibrary, partId)
        ) {
            return false;
        }

        // Core exception: Always allow (since it's the first part)
        const isCore = (x === 0 && y === 0);

        if (!isCore && !this.canPlaceAt(x, y, partId, rotation)) {
            return false;
        }

        const def = PartsLibrary[partId];
        const isRotated = (rotation % 2 !== 0);
        const w = isRotated ? def.height : def.width;
        const h = isRotated ? def.width : def.height;

        // Create Instance
        const partInstance = {
            x, y,
            partId: partId,
            rotation: rotation
        };

        // Occupy all cells
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                this.parts.set(`${x + i},${y + j}`, partInstance);
            }
        }

        this.recalculateStats();
        return true;
    }

    removePart(x, y) {
        if (x === 0 && y === 0) return; // Cannot remove core

        const key = `${x},${y}`;
        if (!this.parts.has(key)) return;

        const part = this.parts.get(key);
        const originX = part.x;
        const originY = part.y;

        const def = PartsLibrary[part.partId];
        if (!def) {
            this.parts.delete(key);
            return;
        }

        const isRotated = ((part.rotation || 0) % 2 !== 0);
        const w = isRotated ? def.height : def.width;
        const h = isRotated ? def.width : def.height;

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                this.parts.delete(`${originX + i},${originY + j}`);
            }
        }

        this.recalculateStats();
    }

    getPart(x, y) {
        return this.parts.get(`${x},${y}`);
    }

    clone() {
        const newShip = new Ship();
        newShip.parts.clear();

        // Copy the occupied grid directly. Replaying addPart() can reject a
        // valid layout when Map insertion order is not core-outward, silently
        // dropping parts as soon as the hangar opens.
        const clonedParts = new Map();
        for (const [key, part] of this.parts) {
            if (!clonedParts.has(part)) {
                clonedParts.set(part, { ...part });
            }
            newShip.parts.set(key, clonedParts.get(part));
        }

        newShip.x = this.x;
        newShip.y = this.y;
        newShip.vx = this.vx;
        newShip.vy = this.vy;
        newShip.rotation = this.rotation;
        newShip.hp = this.hp;
        newShip.isDead = this.isDead;
        newShip.godMode = this.godMode;
        newShip.permanentStats = { ...this.permanentStats };
        newShip.dashCooldown = this.dashCooldown;
        newShip.dashActiveTimer = this.dashActiveTimer;
        newShip.combatSilenceTimer = this.combatSilenceTimer;
        newShip.ambushReady = this.ambushReady;

        newShip.recalculateStats();

        return newShip;
    }

    getUniqueParts() {
        // Returns an iterator of unique part instances
        return new Set(this.parts.values());
    }

    recalculateStats() {
        this.stats = {
            totalHp: 0,
            totalMass: 0,
            thrust: 0,
            accelerantCount: 0,
            regen: 1.0, // Base regeneration
            laserCount: 0,
            rocketCount: 0,
            velocityCount: 0,
            rocketBayCount: 0,
            droneCount: 0,
            turnSpeed: 0,
            boosterCount: 0,
            boosterPartId: null,
            cameraZoom: 0.6,
            pickupRadiusMul: 1,
            globalFireRateMul: 1,
            projectileSpeedMul: 1,
            velocityDamageMul: 1,
            velocityPierceAdd: 0,
            aimAssistAngle: 0,
            aimAssistRange: 0,
            laserSplitCount: 0,
            laserSplitAngle: 0,
            laserSplitDamageMul: 1
        };

        let hasLaserSplitDamageMultiplier = false;
        for (const part of this.getUniqueParts()) {
            const def = PartsLibrary[part.partId];
            if (!def) continue;

            if (def.stats) {
                if (def.stats.hp) this.stats.totalHp += def.stats.hp;
                if (def.stats.mass) this.stats.totalMass += def.stats.mass;
                if (def.stats.thrust) this.stats.thrust += def.stats.thrust;
                if (def.stats.turnSpeed) this.stats.turnSpeed += def.stats.turnSpeed;
                if (def.stats.regen) this.stats.regen += def.stats.regen;

                const stats = def.stats;
                if (Number.isFinite(stats.cameraZoom) && stats.cameraZoom > 0) {
                    this.stats.cameraZoom = Math.min(
                        this.stats.cameraZoom,
                        stats.cameraZoom
                    );
                }
                for (const key of [
                    'pickupRadiusMul',
                    'globalFireRateMul',
                    'projectileSpeedMul',
                    'velocityDamageMul'
                ]) {
                    if (Number.isFinite(stats[key]) && stats[key] > 0) {
                        this.stats[key] *= stats[key];
                    }
                }
                if (Number.isFinite(stats.velocityPierceAdd)) {
                    this.stats.velocityPierceAdd += stats.velocityPierceAdd;
                }
                for (const key of [
                    'aimAssistAngle',
                    'aimAssistRange',
                    'laserSplitCount',
                    'laserSplitAngle'
                ]) {
                    if (Number.isFinite(stats[key])) {
                        this.stats[key] = Math.max(this.stats[key], stats[key]);
                    }
                }
                if (Number.isFinite(stats.laserSplitDamageMul)) {
                    this.stats.laserSplitDamageMul = hasLaserSplitDamageMultiplier
                        ? Math.max(
                            this.stats.laserSplitDamageMul,
                            stats.laserSplitDamageMul
                        )
                        : stats.laserSplitDamageMul;
                    hasLaserSplitDamageMultiplier = true;
                }
            }
            if (def.type === PartType.ACCELERANT) this.stats.accelerantCount++;
            if (def.type === 'weapon') {
                if (def.stats.weaponGroup === 'laser') this.stats.laserCount++;
                if (def.stats.weaponGroup === 'rocket') this.stats.rocketCount++;
                if (def.stats.weaponGroup === 'velocity') this.stats.velocityCount++;
            }
            if (def.type === PartType.ROCKET_BAY) this.stats.rocketBayCount++;
            if (def.type === PartType.BOOSTER) {
                this.stats.boosterCount++;
                this.stats.boosterPartId ||= def.id;
            }
            if (def.type === PartType.DRONE) this.stats.droneCount++;
        }

        // Apply Permanent Upgrades
        const profile = createShipBuildProfile(this, PartsLibrary);
        this.stats.profile = profile;
        this.stats.totalHp = Math.floor(this.stats.totalHp * profile.maxHpMul);
        this.stats.regen = this.stats.regen * profile.regenMul +
            profile.regenAdd;
        this.stats.droneCapacity = Math.min(24, [...this.getUniqueParts()].reduce(
            (total, part) => total + (PartsLibrary[part.partId]?.stats?.droneCapacity || 0),
            0
        ) + profile.droneCapacityAdd);
        // thrust and turnSpeed multipliers are applied in PlayerControlSystem

        // Finalize
        this.maxHp = this.stats.totalHp;
        // Clamp HP if needed, or leave it to regenerate
        if (this.hp > this.maxHp) this.hp = this.maxHp;
    }


    /**
     * Checks if a point/circle/beam hits any part of the ship
     * @param {number} sx - Ship X (Now uses this.x if not provided, but CollisionSystem passes it)
     * @param {number} sy - Ship Y
     * @param {number} sRot - Ship Rotation
     * @param {number} ox - Object X (Projectile/Collider)
     * @param {number} oy - Object Y
     * @param {number} radius - Object Radius
     * @param {boolean} isBeam - Is this a beam check?
     * @param {object} beamProps - { angle, length }
     * @returns {{ hit: boolean, blocked: boolean, damage: number, shieldHit: boolean, worldX: number, worldY: number }}
     */
    checkCollision(sx, sy, sRot, ox, oy, radius, isBeam = false, beamProps = {}) {
        // Fallback if called without ship coords (using internal state)
        if (sx === undefined) sx = this.x;
        if (sy === undefined) sy = this.y;
        if (sRot === undefined) sRot = this.rotation;

        const CELL_STRIDE = TILE_SIZE;
        const shipCos = Math.cos(sRot);
        const shipSin = Math.sin(sRot);
        const cellRadius = CELL_STRIDE / 2;

        for (const key of this.parts.keys()) {
            const [cx, cy] = key.split(',').map(Number);
            // Calculate part center based on grid coordinates
            // Assuming cx,cy are 0-indexed indices.
            // In Game.js: const rx = cx * CELL_STRIDE; const ry = cy * CELL_STRIDE;
            const rx = cx * CELL_STRIDE;
            const ry = cy * CELL_STRIDE;

            const worldCellX = sx + (rx * shipCos - ry * shipSin);
            const worldCellY = sy + (rx * shipSin + ry * shipCos);

            let isHit = false;
            const partRef = this.parts.get(key);
            const def = PartsLibrary[partRef.partId];

            // Shield Radius Logic
            let effectiveRadius = cellRadius;
            const isShieldActive = (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0));
            if (isShieldActive) {
                effectiveRadius *= (def.stats.shieldRadiusScale || 1.4) *
                    (this.stats.profile?.shieldRadiusMul || 1);
            }

            if (isBeam) {
                // Beam Check
                if (Collision.beamCircle(ox, oy, beamProps.angle, beamProps.length, radius, worldCellX, worldCellY, effectiveRadius + radius)) {
                    isHit = true;
                }
            } else {
                // Circle Check
                // Using simple distance check vs effective radius
                // Or CollisionSystem loop? CollisionSystem uses standard logic.
                const distSq = (ox - worldCellX) ** 2 + (oy - worldCellY) ** 2;
                const hitDist = effectiveRadius + radius;
                if (distSq < hitDist * hitDist) {
                    isHit = true;
                }
            }

            if (isHit) {
                if (isShieldActive) {
                    // Shield Block logic is handled by the caller (applying cooldown etc), 
                    // but we need to return that it was a shield hit.
                    // Actually, modifying part state inside checkCollision is a side effect.
                    // But it simplifies the caller loop.
                    // Let's modify state here for consistency with Game.js logic.
                    partRef.shieldCooldown = (def.stats.shieldCooldown || 3.0) *
                        (this.stats.profile?.shieldCooldownMul || 1);
                    return { hit: true, blocked: true, shieldHit: true, worldX: worldCellX, worldY: worldCellY };
                }
                // Normal Hit
                return { hit: true, blocked: false, shieldHit: false, worldX: worldCellX, worldY: worldCellY };
            }
        }
        return { hit: false };
    }
}
