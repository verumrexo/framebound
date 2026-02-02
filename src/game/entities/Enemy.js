import { Sprite } from '../../engine/Sprite.js';
import { Projectile } from './Projectile.js';
import { TILE_SIZE } from '../parts/PartDefinitions.js';
import { PartsLibrary } from '../parts/Part.js';

export class Enemy {
    constructor(x, y, type = 'basic', floorLevel = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.floorLevel = floorLevel;
        this.isDead = false;
        this.rotation = 0;
        this.rotationOffset = 0; // Default no offset
        this.spotted = false;
        this.freezeMeter = 0;
        this.frozenTimer = 0;
        this.lastFreezeTick = 0;

        if (type === 'striker') {
            // Striker uses user-designed ship with weapon turrets
            this.rotationOffset = 0;
            this.maxHp = 120;
            this.hp = this.maxHp;
            this.radius = TILE_SIZE * 1.5;
            this.speed = 160;
            this.turnRate = 3.5;
            this.engagementDist = 500;
            this.detectionDist = 1200;
            this.damageMultiplier = 0.3; // Nerf damage to 30%

            // Ship-based parts from user design
            this.shipParts = [
                { x: 0, y: 0, partId: "core", rotation: 0 },
                { x: 0, y: 1, partId: "custom_1767997148612", rotation: 1 },
                { x: 0, y: -1, partId: "custom_1767997148612", rotation: 3 },
                { x: -1, y: 0, partId: "lps", rotation: 3 }
            ];

            // Initialize weapon cooldowns for each weapon part
            this.weaponCooldowns = [];
            this.activeBursts = []; // Initialize burst state
            for (const part of this.shipParts) {
                const def = PartsLibrary[part.partId];
                if (def && def.type === 'weapon') {
                    this.weaponCooldowns.push({
                        part: part,
                        def: def,
                        cooldown: Math.random() * (def.stats.cooldown || 2)
                    });
                }
            }

            this.sprite = null; // Uses parts instead
            this.shootRate = 0; // Not used, weapons have individual cooldowns
            this.projectileType = null; // Not used, weapons define their own
        } else if (type === 'rocketeer') {
            // Rocketeer - Heavy rocket platform with 4x RocketHE
            this.rotationOffset = 0;
            this.maxHp = 200;
            this.hp = this.maxHp;
            this.radius = TILE_SIZE * 2.0;
            this.speed = 80; // Slower due to weight
            this.turnRate = 2.0;
            this.engagementDist = 600; // Keep distance
            this.detectionDist = 1200;
            this.damageMultiplier = 0.4; // 40% damage to balance 4 rocket launchers

            // Ship parts from user's friend's design
            this.shipParts = [
                { x: -1, y: -1, partId: "core", rotation: 0 },
                { x: -1, y: -2, partId: "hull", rotation: 0 },
                { x: -2, y: -1, partId: "hull", rotation: 0 },
                { x: -1, y: 0, partId: "hull", rotation: 0 },
                { x: 0, y: -1, partId: "hull", rotation: 0 },
                { x: 0, y: -3, partId: "custom_1768036702131", rotation: 0 },
                { x: 0, y: 0, partId: "custom_1768036702131", rotation: 1 },
                { x: -3, y: 0, partId: "custom_1768036702131", rotation: 2 },
                { x: -3, y: -3, partId: "custom_1768036702131", rotation: 3 },
                { x: -3, y: -1, partId: "custom_1767997495375", rotation: 1 }
            ];

            // Initialize weapon cooldowns
            this.weaponCooldowns = [];
            this.activeBursts = [];
            for (const part of this.shipParts) {
                const def = PartsLibrary[part.partId];
                if (def && def.type === 'weapon') {
                    this.weaponCooldowns.push({
                        part: part,
                        def: def,
                        cooldown: Math.random() * (def.stats.cooldown || 2)
                    });
                }
            }

            this.sprite = null;
            this.shootRate = 0;
            this.projectileType = null;
        } else if (type === 'sniper') {
            // Sniper - Long-range sniper, stationary until player gets close
            this.rotationOffset = 0;
            this.maxHp = 100;
            this.hp = this.maxHp;
            this.radius = TILE_SIZE * 1.8;
            this.speed = 60; // Very slow, prefers to stay still
            this.turnRate = 1.5; // Slow turn
            this.engagementDist = 900; // Increased from 150 to 900 for long-range combat
            this.detectionDist = 1500; // Can see very far
            this.damageMultiplier = 0.6; // 60% damage

            // Ship parts from user's friend's design
            this.shipParts = [
                { x: 1, y: -4, partId: "custom_1768857172136", rotation: 0 },
                { x: 0, y: -3, partId: "custom_1768676906827", rotation: 1 },
                { x: 0, y: -2, partId: "core", rotation: 1 },
                { x: 0, y: -1, partId: "core", rotation: 1 },
                { x: 0, y: 0, partId: "core", rotation: 1 },
                { x: 0, y: 1, partId: "custom_1768676906827", rotation: 3 },
                { x: 1, y: 1, partId: "custom_1768857172136", rotation: 0 },
                { x: 0, y: -4, partId: "custom_1768410823264", rotation: 0 },
                { x: 0, y: 2, partId: "custom_1768410823264", rotation: 0 },
                { x: -2, y: -1, partId: "custom_1768035239205", rotation: 3 },
                { x: -3, y: -1, partId: "custom_1767997495375", rotation: 1 }
            ];

            // Initialize weapon cooldowns
            this.weaponCooldowns = [];
            this.activeBursts = [];
            for (const part of this.shipParts) {
                const def = PartsLibrary[part.partId];
                if (def && def.type === 'weapon') {
                    this.weaponCooldowns.push({
                        part: part,
                        def: def,
                        cooldown: Math.random() * (def.stats.cooldown || 2)
                    });
                }
            }

            this.sprite = null;
            this.shootRate = 0;
            this.projectileType = null;
        } else if (type === 'hive_carrier') {
            // Hive Carrier - Cowardly drone spawner
            this.rotationOffset = 0;
            this.maxHp = 250;
            this.hp = this.maxHp;
            this.radius = TILE_SIZE * 4.0; // Large ship, needs bigger hitbox
            this.speed = 120; // Moderate speed to run away
            this.turnRate = 1.8;
            this.engagementDist = 800; // Wants to stay far away
            this.detectionDist = 1500;
            this.damageMultiplier = 0.5;

            // Parts layout provided by user
            this.shipParts = [
                { "x": -4, "y": -1, "partId": "custom_1769974460678", "rotation": 3 },
                { "x": 0, "y": -1, "partId": "custom_1769974460678", "rotation": 1 },
                { "x": -3, "y": -2, "partId": "custom_1768410823264", "rotation": 1 },
                { "x": 2, "y": -2, "partId": "custom_1768410823264", "rotation": 1 },
                { "x": -3, "y": 1, "partId": "custom_1768410823264", "rotation": 1 },
                { "x": 2, "y": 1, "partId": "custom_1768410823264", "rotation": 1 },
                { "x": -2, "y": -2, "partId": "custom_1768035239205", "rotation": 1 },
                { "x": -2, "y": 1, "partId": "custom_1768035239205", "rotation": 1 },
                { "x": 0, "y": 1, "partId": "custom_1767997148612", "rotation": 1 },
                { "x": 0, "y": -2, "partId": "custom_1767997148612", "rotation": 3 }
            ];

            // Hive Carrier has NO direct weapons, only drones.
            // We consciously DO NOT populate activeBursts or weaponCooldowns here.
            this.weaponCooldowns = [];
            this.activeBursts = [];

            this.sprite = null;
            this.shootRate = 0;
            this.projectileType = null;
        } else if (type === 'circler') {
            // Circler - Fast approach, then circles player shooting rockets
            this.rotationOffset = 0;
            this.maxHp = 80;
            this.hp = this.maxHp;
            this.radius = TILE_SIZE * 1.3;
            this.speed = 250; // Very fast initially
            this.turnRate = 4.0; // Good turning for circling
            this.engagementDist = 300; // Start circling at this range
            this.detectionDist = 1200;
            this.damageMultiplier = 0.5; // 50% damage

            // Circling behavior
            this.circleAngle = Math.random() * Math.PI * 2; // Random starting angle
            this.circleDirection = Math.random() < 0.5 ? 1 : -1; // Clockwise or counter-clockwise

            // Ship parts - booster and 2x rocketle
            this.shipParts = [
                { x: -2, y: -1, partId: "custom_1768392079955", rotation: 1 },
                { x: 0, y: -1, partId: "rocketle", rotation: 1 },
                { x: 0, y: 0, partId: "rocketle", rotation: 1 },
                { x: 1, y: -1, partId: "custom_1767997148612", rotation: 0 }
            ];

            // Initialize weapon cooldowns
            this.weaponCooldowns = [];
            this.activeBursts = [];
            for (const part of this.shipParts) {
                const def = PartsLibrary[part.partId];
                if (def && def.type === 'weapon') {
                    this.weaponCooldowns.push({
                        part: part,
                        def: def,
                        cooldown: Math.random() * (def.stats.cooldown || 2)
                    });
                }
            }

            this.sprite = null;
            this.shootRate = 0;
            this.projectileType = null;
        } else {
            // Basic enemy with ship parts
            this.rotationOffset = 0;
            this.maxHp = 50;
            this.hp = this.maxHp;
            this.radius = TILE_SIZE * 1.2;
            this.speed = 100;
            this.turnRate = 2.5;
            this.engagementDist = 300;
            this.detectionDist = 1000;

            // Ship-based parts from user design (centered)
            this.shipParts = [
                { x: 0, y: 0, partId: "custom_1768410823264", rotation: 0 },
                { x: -1, y: 0, partId: "gun_basic", rotation: 0 },
                { x: -1, y: -1, partId: "custom_1767997148612", rotation: 3 }
            ];

            // Initialize weapon cooldowns for each weapon part
            this.weaponCooldowns = [];
            this.activeBursts = [];
            for (const part of this.shipParts) {
                const def = PartsLibrary[part.partId];
                if (def && def.type === 'weapon') {
                    this.weaponCooldowns.push({
                        part: part,
                        def: def,
                        cooldown: Math.random() * (def.stats.cooldown || 2)
                    });
                }
            }

            this.sprite = null;
            this.shootRate = 0;
            this.projectileType = null;
        }

        this.shootCooldown = Math.random() * (this.shootRate || 2);

        // Floor-based scaling: 2x HP and damage per floor
        const floorMultiplier = Math.pow(2, this.floorLevel - 1);
        this.maxHp *= floorMultiplier;
        this.hp = this.maxHp;
        this.damageMultiplier = (this.damageMultiplier || 1) * floorMultiplier;
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
                const freezeDuration = (this.type === 'striker') ? 3.0 : 5.0;
                this.frozenTimer = freezeDuration;
                this.freezeMeter = 0;
            }
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
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

    update(dt, playerX, playerY, projectiles, asteroids = [], lootCrates = [], allEnemies = [], room = null) {
        if (this.isDead) return;

        // DEBUG: Catch NaN entry
        if (isNaN(this.x) || isNaN(this.y) || isNaN(this.rotation)) {
            console.error(`[Enemy] NaN Detected at START of Update! ID: ${this.type}`, this.x, this.y, this.rotation);
            // reset to safe?
            return;
        }

        // Calculate Aim Angle (Global)
        if (playerX !== undefined && playerY !== undefined) {
            this.aimAngle = Math.atan2(playerY - this.y, playerX - this.x);
        }

        // Frozen Logic
        if (this.frozenTimer > 0) {
            this.frozenTimer -= dt;
            return;
        }

        if (this.freezeMeter > 0) {
            this.freezeMeter -= dt * 0.5; // Decays
            if (this.freezeMeter < 0) this.freezeMeter = 0;
        }

        // Calculate vector to player
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (this.spotted || dist < this.detectionDist) {
            this.spotted = true;

            // --- MOVEMENT LOGIC ---
            let moveX = 0;
            let moveY = 0;
            let applyMovement = false;

            if (this.type === 'circler') {
                // CIRCLER LOGIC
                const orbitRange = this.engagementDist * 1.5;
                const isOrbiting = dist <= orbitRange;

                if (isOrbiting) {
                    // ORBIT
                    const currentAngle = Math.atan2(this.y - playerY, this.x - playerX);
                    const direction = 1;
                    const orbitSpeed = 0.64;
                    const nextAngle = currentAngle + orbitSpeed * direction * dt;
                    const desiredRadius = this.engagementDist * 1.2;
                    const nextRadius = dist + (desiredRadius - dist) * 2.0 * dt;

                    this.x = playerX + Math.cos(nextAngle) * nextRadius;
                    this.y = playerY + Math.sin(nextAngle) * nextRadius;

                    const targetRotation = nextAngle + (Math.PI / 2);
                    let diff = targetRotation - this.rotation;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    const maxStep = this.turnRate * dt;
                    if (Math.abs(diff) > maxStep) {
                        this.rotation += Math.sign(diff) * maxStep;
                    } else {
                        this.rotation = targetRotation;
                    }
                    applyMovement = false;
                } else {
                    // APPROACH
                    const targetRotation = Math.atan2(dy, dx);
                    let diff = targetRotation - this.rotation;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    const maxStep = this.turnRate * dt;
                    if (Math.abs(diff) > maxStep) {
                        this.rotation += Math.sign(diff) * maxStep;
                    } else {
                        this.rotation = targetRotation;
                    }
                    moveX = Math.cos(this.rotation) * this.speed * dt;
                    moveY = Math.sin(this.rotation) * this.speed * dt;
                    applyMovement = true;
                }

            } else if (this.type === 'hive_carrier') {
                // HIVE CARRIER LOGIC - FLEE/COWARD

                // Leash Logic (Room Based)
                let tooFar = false;
                if (room) {
                    // Start Room might be cleared, but we still respect its bounds if passed
                    // room.x/y/width/height are in WORLD PIXELS
                    const roomWorldCX = room.x + room.width / 2;
                    const roomWorldCY = room.y + room.height / 2;
                    const roomRadius = (Math.min(room.width, room.height) / 2) * 0.9;

                    const rdx = this.x - roomWorldCX;
                    const rdy = this.y - roomWorldCY;
                    if (rdx * rdx + rdy * rdy > roomRadius * roomRadius) {
                        tooFar = true;
                        // Turn back to room center
                        var targetRotation = Math.atan2(-rdy, -rdx);
                    }
                } else if (dist > 1500) {
                    // Fallback Leash to player if no room info
                    tooFar = true;
                    var targetRotation = Math.atan2(dy, dx);
                }

                if (!tooFar) {
                    if (dist < this.engagementDist) {
                        // Too close! Run away
                        const angleToPlayer = Math.atan2(dy, dx);
                        targetRotation = angleToPlayer + Math.PI;
                        applyMovement = true;
                    } else {
                        // Just right? Drift slowly
                        targetRotation = this.rotation;
                        // Add slight drift
                        moveX = Math.cos(this.rotation) * this.speed * 0.2 * dt;
                        moveY = Math.sin(this.rotation) * this.speed * 0.2 * dt;
                        this.x += moveX;
                        this.y += moveY;
                        applyMovement = false; // We handled it manually
                    }
                } else {
                    applyMovement = true; // Move back to center
                }
                // (Block merged)

                // DEBUG TARGET ROTATION
                if (typeof targetRotation === 'undefined' || isNaN(targetRotation)) {
                    console.error('[Enemy] targetRotation is NaN/Undefined!', {
                        type: this.type,
                        room: !!room,
                        tooFar,
                        dist,
                        x: this.x,
                        y: this.y
                    });
                    // Rescue
                    targetRotation = this.rotation;
                }

                // Rotation Smoothing
                let diff = targetRotation - this.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                const maxStep = this.turnRate * dt;
                if (Math.abs(diff) > maxStep) {
                    this.rotation += Math.sign(diff) * maxStep;
                } else {
                    this.rotation = targetRotation;
                }

                if (applyMovement) {
                    moveX = Math.cos(this.rotation) * this.speed * dt;
                    moveY = Math.sin(this.rotation) * this.speed * dt;
                }

                // Ensure no weapons
                if (this.weaponCooldowns.length > 0) this.weaponCooldowns = [];
            } else {
                // STANDARD ENEMY LOGIC
                const targetRotation = Math.atan2(dy, dx);
                let diff = targetRotation - this.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                const maxStep = this.turnRate * dt;
                if (Math.abs(diff) > maxStep) {
                    this.rotation += Math.sign(diff) * maxStep;
                } else {
                    this.rotation = targetRotation;
                }

                if (dist > this.engagementDist) {
                    moveX = Math.cos(this.rotation) * this.speed * dt;
                    moveY = Math.sin(this.rotation) * this.speed * dt;
                    applyMovement = true;
                }
            }

            // --- OBSTACLE AVOIDANCE (Only if applying movement) ---
            if (applyMovement) {
                const avoidRadius = this.radius + 60;
                let avoidX = 0;
                let avoidY = 0;

                // Asteroids
                for (const asteroid of asteroids) {
                    if (asteroid.isDead || asteroid.isBroken) continue;
                    const adx = this.x - asteroid.x;
                    const ady = this.y - asteroid.y;
                    const aDist = Math.sqrt(adx * adx + ady * ady);
                    const minDist = avoidRadius + asteroid.radius;
                    if (aDist < minDist && aDist > 0) {
                        const strength = (minDist - aDist) / minDist;
                        avoidX += (adx / aDist) * strength * this.speed * dt * 2;
                        avoidY += (ady / aDist) * strength * this.speed * dt * 2;
                    }
                }

                // Loot Crates
                for (const crate of lootCrates) {
                    if (crate.isOpened) continue;
                    const cdx = this.x - crate.x;
                    const cdy = this.y - crate.y;
                    const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
                    const minDist = avoidRadius + crate.radius;
                    if (cDist < minDist && cDist > 0) {
                        const strength = (minDist - cDist) / minDist;
                        avoidX += (cdx / cDist) * strength * this.speed * dt * 2;
                        avoidY += (cdy / cDist) * strength * this.speed * dt * 2;
                    }
                }

                this.x += moveX + avoidX;
                this.y += moveY + avoidY;
            }
        }

        // --- ENEMY SEPARATION (prevent stacking) ---
        for (const other of allEnemies) {
            if (other === this || other.isDead) continue;
            const ex = this.x - other.x;
            const ey = this.y - other.y;
            const eDist = Math.sqrt(ex * ex + ey * ey);
            const minSep = 60; // Minimum separation distance
            if (eDist < minSep && eDist > 0) {
                const pushStrength = (minSep - eDist) / minSep;
                this.x += (ex / eDist) * pushStrength * 50 * dt;
                this.y += (ey / eDist) * pushStrength * 50 * dt;
            }
        }

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
                    const angleToPlayer = Math.atan2(dy, dx);

                    const spread = (Math.random() - 0.5) * (burst.def.stats.spread || 0);
                    const pType = burst.def.stats.projectileType || 'bullet';
                    const pSpeed = burst.def.stats.projectileSpeed || (pType === 'laser' || pType === 'small_laser' ? 800 : 400);
                    const baseDamage = burst.def.stats.damage || 5;
                    const finalDamage = baseDamage * (this.damageMultiplier || 1);

                    projectiles.push(new Projectile(worldX, worldY, angleToPlayer + spread, pType, pSpeed, 'enemy', finalDamage));

                    burst.count--;
                    if (burst.count <= 0) {
                        this.activeBursts.splice(i, 1);
                    } else {
                        burst.timer = burst.def.stats.burstInterval || 0.1;
                    }
                }
            }

            // Check cooldowns
            for (const wep of this.weaponCooldowns) {
                wep.cooldown -= dt;
                if (wep.cooldown <= 0) {
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
                        const angleToPlayer = Math.atan2(dy, dx);

                        const spread = (Math.random() - 0.5) * (wep.def.stats.spread || 0);
                        const pType = wep.def.stats.projectileType || 'bullet';
                        const pSpeed = wep.def.stats.projectileSpeed || (pType === 'laser' || pType === 'small_laser' ? 800 : 400);
                        const baseDamage = wep.def.stats.damage || 5;
                        const finalDamage = baseDamage * (this.damageMultiplier || 1);

                        projectiles.push(new Projectile(worldX, worldY, angleToPlayer + spread, pType, pSpeed, 'enemy', finalDamage));
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
                    projectiles.push(new Projectile(this.x, this.y, this.rotation, this.projectileType, pSpeed, 'enemy'));
                    this.shootCooldown = this.shootRate;
                }
            }
        }
    }

    draw(renderer) {
        if (this.isDead) return;

        // Render ship parts if available (Striker)
        if (this.shipParts && this.shipParts.length > 0) {
            const ctx = renderer.ctx;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation + this.rotationOffset);

            if (this.frozenTimer > 0 || this.freezeMeter > 0) {
                // Blue tint for frozen or freezing enemies
                const intensity = this.frozenTimer > 0 ? 1.0 : (this.freezeMeter / 3.0);
                ctx.shadowBlur = 5 + intensity * 10;
                ctx.shadowColor = '#00ffff';
                ctx.globalAlpha = 0.8;
                // We'll also apply a blue tint to the sprites below if we can
            }

            for (const partData of this.shipParts) {
                const def = PartsLibrary[partData.partId];
                if (!def) continue;

                const isRotated = ((partData.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;
                const drawX = (partData.x + (w - 1) / 2) * TILE_SIZE;
                const drawY = (partData.y + (h - 1) / 2) * TILE_SIZE;

                const baseAngle = (partData.rotation || 0) * (Math.PI / 2);

                let drawAngle = baseAngle;
                let turretX = drawX;
                let turretY = drawY;

                // If it's a weapon, aim at player
                if (def.type === 'weapon') {
                    // Offset Logic (Same as Player Ship)
                    let offsetX = 0;
                    let offsetY = 0;

                    if (def.turretDrawOffset) {
                        if (typeof def.turretDrawOffset === 'object') {
                            const ox = def.turretDrawOffset.x || 0;
                            const oy = def.turretDrawOffset.y || 0;
                            offsetX = Math.cos(baseAngle) * ox - Math.sin(baseAngle) * oy;
                            offsetY = Math.sin(baseAngle) * ox + Math.cos(baseAngle) * oy;
                        } else {
                            // Scalar (aim based) is tricky here because we haven't calculated aim angle yet.
                            // But enemies aim at player.
                            // For now, simplify scalar to just be forward offset? Or skip.
                            // Most don't use scalar.
                            // Simple approximation: Forward relative to mount
                            offsetX = Math.cos(baseAngle) * def.turretDrawOffset;
                            offsetY = Math.sin(baseAngle) * def.turretDrawOffset;
                        }
                    }

                    turretX = drawX + offsetX;
                    turretY = drawY + offsetY;
                    // But we don't have access to player pos in draw(). 

                    // Workaround: We'll assume the enemy AI keeps it facing roughly, 
                    // BUT we use the calculated aimAngle (from update) if available.

                    if (this.aimAngle !== undefined) {
                        // Transform global aim angle to local rotation
                        // Global = ShipRotation + RotationOffset + LocalPartRot
                        // We want: DrawAngle = AimAngle - (ShipRotation + RotationOffset)

                        // But wait, ctx is already rotated by (this.rotation + this.rotationOffset).
                        // So we just need the difference.
                        drawAngle = this.aimAngle - (this.rotation + (this.rotationOffset || 0));
                    } else {
                        // Fallback: Fixed forward relative to ship
                        drawAngle = 0;
                    }
                }

                // Red tint for enemy (using sprite override instead of CSS filter for Edge performance)
                let enemyColor = '#ff6666'; // Red tint
                if (this.frozenTimer > 0) enemyColor = '#00ffff'; // Frozen Blue

                // Draw base block for weapons (like player ship does)
                if (def.type === 'weapon' && def.baseSprite) {
                    def.baseSprite.draw(ctx, drawX, drawY, (partData.rotation || 0) * (Math.PI / 2), 0.5, 0.5, null, enemyColor);
                }

                // Turret uses tracked rotation (Forward)
                def.sprite.draw(ctx, turretX, turretY, drawAngle + (def.rotationOffset || 0), null, null, null, enemyColor);

                // Shield Visual
                if (def.type === 'shield' && (!partData.shieldCooldown || partData.shieldCooldown <= 0)) {
                    // Draw nice pulsing blue shield overlay
                    // We need a time factor for pulse, maybe just use Date.now or pass active timer
                    const pulse = 1.0 + Math.sin(Date.now() / 200) * 0.1;
                    const scale = (def.stats.shieldRadiusScale || 1.4) * pulse;

                    ctx.beginPath();
                    ctx.arc(drawX, drawY, (def.width * TILE_SIZE / 2) * scale, 0, Math.PI * 2);
                    ctx.strokeStyle = '#00ffff'; // Cyan shield
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#00ffff';
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();

                    ctx.fillStyle = '#00ffff';
                    ctx.globalAlpha = 0.1;
                    ctx.fill();

                    // Reset context for next part
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1.0;
                }
            }

            if (this.frozenTimer > 0 || this.freezeMeter > 0) {
                ctx.globalAlpha = 1.0;
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        } else if (this.sprite) {
            // Fallback single sprite (basic enemy)
            const color = (this.frozenTimer > 0) ? '#00ffff' : undefined;
            this.sprite.draw(renderer.ctx, this.x, this.y, this.rotation + this.rotationOffset, 0.5, 0.5, null, color);
        }

        // Health bar - position above the topmost part in world space
        let barCenterX = this.x;
        let topY = this.y - this.radius;

        if (this.shipParts && this.shipParts.length > 0) {
            const cos = Math.cos(this.rotation + this.rotationOffset);
            const sin = Math.sin(this.rotation + this.rotationOffset);

            // Find bounding box in world space
            let minWorldY = Infinity;
            let minWorldX = Infinity;
            let maxWorldX = -Infinity;

            for (const partData of this.shipParts) {
                const def = PartsLibrary[partData.partId];
                if (!def) continue;

                const isRotated = ((partData.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;

                // Check all corners of the part
                const corners = [
                    { x: partData.x, y: partData.y },
                    { x: partData.x + w, y: partData.y },
                    { x: partData.x, y: partData.y + h },
                    { x: partData.x + w, y: partData.y + h }
                ];

                for (const corner of corners) {
                    const localX = corner.x * TILE_SIZE;
                    const localY = corner.y * TILE_SIZE;
                    const worldX = this.x + (localX * cos - localY * sin);
                    const worldY = this.y + (localX * sin + localY * cos);

                    minWorldY = Math.min(minWorldY, worldY);
                    minWorldX = Math.min(minWorldX, worldX);
                    maxWorldX = Math.max(maxWorldX, worldX);
                }
            }

            topY = minWorldY;
            barCenterX = (minWorldX + maxWorldX) / 2; // Center of bounding box
        }

        // Scale width by max HP, minimum 40px, maximum 160px
        const barW = Math.min(160, Math.max(40, this.maxHp / 2));
        const barH = 8;
        const hpPct = Math.max(0, this.hp / this.maxHp);
        const barY = topY - 25;

        const ctx = renderer.ctx;
        ctx.save();

        // Terminal/Holographic Border
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barCenterX - barW / 2 - 2, barY - 2, barW + 4, barH + 4);

        // Dark Background
        ctx.fillStyle = 'rgba(0, 20, 30, 0.8)';
        ctx.fillRect(barCenterX - barW / 2, barY, barW, barH);

        // Health Fill (Red to Bright Red Gradient)
        if (hpPct > 0) {
            const fillW = barW * hpPct;
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(barCenterX - barW / 2, barY, fillW, barH);

            // Highlight shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(barCenterX - barW / 2, barY, fillW, barH / 2);
        }

        // Tech Segments (Dynamic count based on width)
        const segmentCount = Math.floor(barW / 20);
        if (segmentCount > 1) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            for (let i = 1; i < segmentCount; i++) {
                const sx = (barCenterX - barW / 2) + (barW / segmentCount) * i;
                ctx.beginPath();
                ctx.moveTo(sx, barY - 2);
                ctx.lineTo(sx, barY + barH + 2);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}
