import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { Collision } from '../systems/CollisionSystem.js';
import { Assets } from '../../Assets.js';

export class Ship {
    constructor() {
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
            boosterCount: 0
        };

        this.hp = 0;
        this.maxHp = 0;
        this.isDead = false;

        // Default Loadout (Core at 0,0) - Orientation Fixed
        this.addPart(0, 0, 'core');
        this.addPart(0, -1, 'rocketle', 1); // Front (Up) - Rot 1
        this.addPart(0, 1, 'custom_1767997495375', 0); // Back (Down) - Rot 0
        this.addPart(-1, 0, 'gun_basic', 0); // Left - Rot 0
        this.addPart(1, 0, 'gun_basic', 0);  // Right - Rot 0
    }

    draw(renderer, x, y, rotation, targetX, targetY) {
        if (this.isDead) return;

        const ctx = renderer.ctx;
        const CELL_STRIDE = TILE_SIZE;

        const shipCos = Math.cos(rotation);
        const shipSin = Math.sin(rotation);

        for (const partRef of this.getUniqueParts()) {
            const def = PartsLibrary[partRef.partId];
            if (!def) continue;

            const isRotated = ((partRef.rotation || 0) % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            const localCX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
            const localCY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

            const worldPartX = x + (localCX * shipCos - localCY * shipSin);
            const worldPartY = y + (localCX * shipSin + localCY * shipCos);

            if (def.type === 'weapon') {
                // Draw base
                if (def.baseSprite) {
                    def.baseSprite.draw(ctx, worldPartX, worldPartY, rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                    // Long Hull (1x2)
                    if (Assets.LongHull) Assets.LongHull.draw(ctx, worldPartX, worldPartY, rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else {
                    // Standard Base
                    if (Assets.PlayerBase) Assets.PlayerBase.draw(ctx, worldPartX, worldPartY, rotation, 0.5, 0.5);
                }

                // Draw turret (aimed at target)
                const angle = Math.atan2(targetY - worldPartY, targetX - worldPartX);
                const baseAngle = rotation + (partRef.rotation || 0) * (Math.PI / 2);

                let offsetX = 0;
                let offsetY = 0;

                // Turret Offset Logic
                if (def.turretDrawOffset) {
                    if (typeof def.turretDrawOffset === 'object') {
                        const ox = def.turretDrawOffset.x || 0;
                        const oy = def.turretDrawOffset.y || 0;
                        offsetX = Math.cos(baseAngle) * ox - Math.sin(baseAngle) * oy;
                        offsetY = Math.sin(baseAngle) * ox + Math.cos(baseAngle) * oy;
                    } else {
                        offsetX = Math.cos(angle) * def.turretDrawOffset;
                        offsetY = Math.sin(angle) * def.turretDrawOffset;
                    }
                }

                if (partRef.recoil) {
                    offsetX -= Math.cos(angle) * partRef.recoil;
                    offsetY -= Math.sin(angle) * partRef.recoil;
                }

                if (def.baseSprite && (def.baseSprite.anchorX !== 0.5 || def.baseSprite.anchorY !== 0.5)) {
                    const bpx = (def.baseSprite.anchorX - 0.5) * def.baseSprite.width * def.baseSprite.scale;
                    const bpy = (def.baseSprite.anchorY - 0.5) * def.baseSprite.height * def.baseSprite.scale;
                    offsetX += Math.cos(baseAngle) * bpx - Math.sin(baseAngle) * bpy;
                    offsetY += Math.sin(baseAngle) * bpx + Math.cos(baseAngle) * bpy;
                }

                const drawX = worldPartX + offsetX;
                const drawY = worldPartY + offsetY;

                def.sprite.draw(ctx, drawX, drawY, angle + (def.rotationOffset || 0), null, null, 'rgba(255,255,255,0.4)');

                // Charge Effect (Railway/Saber)
                if ((partRef.chargeLeft > 0 || partRef.chargeReady) && (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'saber')) {
                    const pct = partRef.chargeReady ? 1.0 : (1.0 - (partRef.chargeLeft / def.stats.chargeTime));
                    let barrelLen = (h > 1.5) ? CELL_STRIDE * 1.3 : CELL_STRIDE * 0.6;
                    barrelLen += (def.turretDrawOffset || 0);
                    const tipX = worldPartX + Math.cos(angle) * barrelLen;
                    const tipY = worldPartY + Math.sin(angle) * barrelLen;

                    const isSaber = def.stats.projectileType === 'saber';
                    const baseRadius = isSaber ? 5 : 15;
                    const radius = 5 + pct * baseRadius + Math.sin(Date.now() * 0.01) * 2;
                    ctx.save();
                    ctx.globalAlpha = 0.5 + Math.random() * 0.3;
                    renderer.drawCircle(tipX, tipY, radius, '#00ffff'); // Helper from Renderer? No, Renderer has drawCircle but ctx is raw.
                    // Renderer.drawCircle uses ctx.arc
                    ctx.beginPath();
                    ctx.arc(tipX, tipY, radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#00ffff';
                    ctx.fill();

                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(tipX, tipY, radius * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.restore();
                }
            } else {
                // Static Part
                def.sprite.draw(ctx, worldPartX, worldPartY, rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);

                // Shield
                if (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0)) {
                    const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.1;
                    const scale = def.stats.shieldRadiusScale || 1.4;
                    const radius = (CELL_STRIDE / 2) * scale * pulse;

                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(worldPartX, worldPartY, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // Core Effect
            if (def.id === 'core' && def.coreEffectSprite) {
                const spin = Date.now() * 0.003;
                def.coreEffectSprite.draw(ctx, worldPartX, worldPartY, spin);
            }
        }
    }

    takeDamage(amount) {
        if (this.isDead || this.godMode) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    canPlaceAt(x, y, partId, rotation = 0) {
        const def = PartsLibrary[partId];
        if (!def) return false;

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

    addPart(x, y, partId, rotation = 0) {
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

    getUniqueParts() {
        // Returns an iterator of unique part instances
        return new Set(this.parts.values());
    }

    clone() {
        // Create new ship
        const newShip = new Ship();
        // Clear default core (optional, but addPart handles collision if we overwrite)
        // Actually addPart collision check prevents overwriting 0,0 Core.
        // So we should clear parts first or just rely on addPart logic.
        newShip.parts.clear();

        this.getUniqueParts().forEach(p => {
            newShip.addPart(p.x, p.y, p.partId, p.rotation);
        });

        // Preserve HP and state
        newShip.hp = this.hp;
        newShip.isDead = this.isDead;
        newShip.godMode = this.godMode;

        return newShip;
    }

    recalculateStats() {
        this.stats.totalHp = 0;
        this.stats.totalMass = 0;
        this.stats.thrust = 0;
        this.stats.accelerantCount = 0;
        this.stats.regen = 1.0; // Base regeneration
        this.stats.laserCount = 0;
        this.stats.rocketCount = 0;
        this.stats.velocityCount = 0;
        this.stats.rocketBayCount = 0;
        this.stats.turnSpeed = 0; // Initialize turnSpeed

        for (const part of this.getUniqueParts()) {
            const def = PartsLibrary[part.partId];
            if (def) {
                this.stats.totalHp += def.stats.hp || 0;
                this.stats.totalMass += def.stats.mass || 0;
                this.stats.turnSpeed += def.stats.turnSpeed || 0;

                // Explicit thrust stat (from any part type)
                if (def.stats.thrust) {
                    this.stats.thrust += def.stats.thrust;
                }

                // If it's a thruster, count each block (Legacy / Type-based)
                if (def.type === 'thruster') {
                    this.stats.thrust += (def.width * def.height);
                }

                if (def.type === 'accelerant') {
                    this.stats.accelerantCount += (def.width * def.height);
                }

                if (def.type === 'rocket_bay') {
                    this.stats.rocketBayCount += (def.width * def.height);
                }

                if (def.type === 'booster') {
                    this.stats.boosterCount += 1;
                }

                if (def.stats.regen) {
                    this.stats.regen += def.stats.regen;
                }

                if (def.type === 'weapon' && def.stats.weaponGroup) {
                    const groupKey = `${def.stats.weaponGroup}Count`;
                    this.stats[groupKey] += (def.width * def.height);
                }
            }
        }

        this.maxHp = this.stats.totalHp;
        if (this.hp === 0 && !this.isDead) {
            this.hp = this.maxHp;
        }
    }

    /**
     * Checks if a point/circle/beam hits any part of the ship
     * @param {number} sx - Ship X
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
                effectiveRadius *= (def.stats.shieldRadiusScale || 1.4);
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
                    partRef.shieldCooldown = def.stats.shieldCooldown || 3.0;
                    return { hit: true, blocked: true, shieldHit: true, worldX: worldCellX, worldY: worldCellY };
                }
                // Normal Hit
                return { hit: true, blocked: false, shieldHit: false, worldX: worldCellX, worldY: worldCellY };
            }
        }
        return { hit: false };
    }
}
