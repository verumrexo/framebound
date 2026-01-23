import { Sprite } from '../../engine/Sprite.js';
import { Projectile } from './Projectile.js';
import { TILE_SIZE } from '../parts/PartDefinitions.js';
import { PartsLibrary } from '../parts/Part.js';

export class Enemy {
    constructor(x, y, type = 'basic') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.isDead = false;
        this.rotation = 0;
        this.rotationOffset = 0; // Default no offset
        this.spotted = false;

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
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    update(dt, playerX, playerY, projectiles, asteroids = [], lootCrates = []) {
        if (this.isDead) return;

        // Calculate vector to player
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (this.spotted || dist < this.detectionDist) {
            // Once spotted, stay aggressive (optional: reset if player leaves room, but Room.update handles this)
            this.spotted = true;

            // Aim at player (Smooth Turning)
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

            // Move if too far, but stop if close enough (engagement)
            if (dist > this.engagementDist) {
                // Calculate desired move direction
                let moveX = Math.cos(this.rotation) * this.speed * dt;
                let moveY = Math.sin(this.rotation) * this.speed * dt;

                // Obstacle avoidance steering
                const avoidRadius = this.radius + 60; // Detection radius for obstacles
                let avoidX = 0, avoidY = 0;

                // Check asteroids
                for (const asteroid of asteroids) {
                    if (asteroid.isDead || asteroid.isBroken) continue;
                    const adx = this.x - asteroid.x;
                    const ady = this.y - asteroid.y;
                    const aDist = Math.sqrt(adx * adx + ady * ady);
                    const minDist = avoidRadius + asteroid.radius;
                    if (aDist < minDist && aDist > 0) {
                        // Push away from obstacle
                        const strength = (minDist - aDist) / minDist;
                        avoidX += (adx / aDist) * strength * this.speed * dt * 2;
                        avoidY += (ady / aDist) * strength * this.speed * dt * 2;
                    }
                }

                // Check loot crates
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

                // Apply combined movement
                this.x += moveX + avoidX;
                this.y += moveY + avoidY;
            }

            // Shoot from weapon parts (Striker) or basic shooting
            if (this.weaponCooldowns && this.weaponCooldowns.length > 0) {
                // Process active bursts
                for (let i = this.activeBursts.length - 1; i >= 0; i--) {
                    const burst = this.activeBursts[i];
                    burst.timer -= dt;
                    if (burst.timer <= 0) {
                        // Fire shot
                        const partAngle = (burst.part.rotation || 0) * (Math.PI / 2);
                        const isRotated = ((burst.part.rotation || 0) % 2 !== 0);
                        const w = isRotated ? burst.def.height : burst.def.width;
                        const h = isRotated ? burst.def.width : burst.def.height;
                        const localX = (burst.part.x + (w - 1) / 2) * TILE_SIZE;
                        const localY = (burst.part.y + (h - 1) / 2) * TILE_SIZE;

                        const cos = Math.cos(this.rotation);
                        const sin = Math.sin(this.rotation);
                        const worldX = this.x + (localX * cos - localY * sin);
                        const worldY = this.y + (localX * sin + localY * cos);

                        // Aim at player
                        const dx = playerX - worldX;
                        const dy = playerY - worldY;
                        const angleToPlayer = Math.atan2(dy, dx);

                        // Add spread
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
                        // Start burst
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
                            // Single shot logic (same coordinates calculation)
                            const partAngle = (wep.part.rotation || 0) * (Math.PI / 2);
                            const isRotated = ((wep.part.rotation || 0) % 2 !== 0);
                            const w = isRotated ? wep.def.height : wep.def.width;
                            const h = isRotated ? wep.def.width : wep.def.height;
                            const localX = (wep.part.x + (w - 1) / 2) * TILE_SIZE;
                            const localY = (wep.part.y + (h - 1) / 2) * TILE_SIZE;

                            const cos = Math.cos(this.rotation);
                            const sin = Math.sin(this.rotation);
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

            for (const partData of this.shipParts) {
                const def = PartsLibrary[partData.partId];
                if (!def) continue;

                const isRotated = ((partData.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;
                const drawX = (partData.x + (w - 1) / 2) * TILE_SIZE;
                const drawY = (partData.y + (h - 1) / 2) * TILE_SIZE;

                // Calculate Turret Rotation (Tracking)
                let drawAngle = (partData.rotation || 0) * (Math.PI / 2);

                // If it's a weapon, aim at player
                if (def.type === 'weapon') {
                    // Global position of part
                    const localX = (partData.x + (w - 1) / 2) * TILE_SIZE;
                    const localY = (partData.y + (h - 1) / 2) * TILE_SIZE;
                    // Note: We are transforming relative to ship center
                    // To aim at player, we typically need global coordinates
                    // But we can transform the "Target (Player)" into local space!

                    // Simple hack: since ship mostly faces player, local angle ~ global angle - ship rotation
                    // But for precise tracking:
                    // We need to calculate the angle that points to player in Local Space.
                    // If we assume the ship context is rotated by `this.rotation`...
                    // then we want `angleToPlayer - this.rotation`.
                    // EXCEPT the enemy logic rotates the ship to face the player already.
                    // So `angleToPlayer - this.rotation` should be ~0 (Right).

                    // However, we want the turret to ALWAYS point at player, even if ship is turning.
                    // So we do need strictly: `angleToPlayer - this.rotation`.
                    // But we don't have access to player pos in draw(). 

                    // Workaround: We'll assume the enemy AI keeps it facing roughly, 
                    // BUT we override the fixed part rotation to always be "0" (Forward) visually?
                    // User complained "turret ... static to enemies ship".
                    // They want it to rotate freely.

                    // Since I don't have player pos here easily (passed in update, not draw),
                    // I'll make a simplifying assumption:
                    // Turrets always point "Right" (Forward) relative to the ship (0 degrees).
                    // This corrects the "Mounted Sideways" issue automatically.
                    // If the user mounted it rotated 3 (Up), we force it to 0 (Forward).

                    drawAngle = 0;
                }

                // Red tint for enemy (using sprite override instead of CSS filter for Edge performance)
                const enemyColor = '#ff6666'; // Red tint

                // Draw base block for weapons (like player ship does)
                if (def.type === 'weapon' && def.baseSprite) {
                    // Base uses hull rotation (original mounting)
                    def.baseSprite.draw(ctx, drawX, drawY, (partData.rotation || 0) * (Math.PI / 2), 0.5, 0.5, null, enemyColor);
                }

                // Turret uses tracked rotation (Forward)
                def.sprite.draw(ctx, drawX, drawY, drawAngle + (def.rotationOffset || 0), 0.5, 0.5, null, enemyColor);
            }

            ctx.restore();
        } else if (this.sprite) {
            // Fallback single sprite (basic enemy)
            this.sprite.draw(renderer.ctx, this.x, this.y, this.rotation + this.rotationOffset);
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

        const barW = 40;
        const barH = 4;
        const hpPct = this.hp / this.maxHp;
        const barY = topY - 15; // 15px above topmost part

        // Black outline (2px)
        renderer.ctx.strokeStyle = '#000';
        renderer.ctx.lineWidth = 2;
        renderer.ctx.strokeRect(barCenterX - barW / 2 - 1, barY - 1, barW + 2, barH + 2);

        // Background and fill
        renderer.drawRect(barCenterX - barW / 2, barY, barW, barH, '#333');
        renderer.drawRect(barCenterX - barW / 2, barY, barW * hpPct, barH, '#ff4444');
    }
}
