import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { Projectile } from './Projectile.js';

export class Boss {
    constructor(x, y, level) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.type = 'boss';
        this.isDead = false;
        this.angle = 0;
        this.parts = new Map(); // key: "x,y" (relative grid), value: PartInstance

        // Generation settings
        this.hullCount = 4 + (level * 2);
        this.weaponCount = 2 + (level * 2);

        // Initial core
        this.addPart(0, 0, 'core');

        this.generate();
        this.recalculateStats();

        // HP
        this.hp = this.stats.totalHp * 2; // Bosses have 2x HP of their parts sum
        this.maxHp = this.hp;
        this.freezeMeter = 0;
        this.frozenTimer = 0;
        this.lastFreezeTick = 0;

        this.radius = Math.sqrt(this.parts.size) * TILE_SIZE; // Approximate collision radius
    }

    generate() {
        // Simple random generation (similar to designer, but random)
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const availableSlots = new Set();
        const occupied = new Set(['0,0']);

        // Populate initial slots around core
        directions.forEach(d => availableSlots.add(`${d[0]},${d[1]}`));

        // Place Hulls
        let hullsLeft = this.hullCount;
        while (hullsLeft > 0 && availableSlots.size > 0) {
            // Pick random slot
            const slots = Array.from(availableSlots);
            const key = slots[Math.floor(Math.random() * slots.length)];
            const [qx, qy] = key.split(',').map(Number);

            if (this.addPart(qx, qy, 'hull')) {
                occupied.add(key);
                availableSlots.delete(key);
                // Add neighbors
                directions.forEach(d => {
                    const nk = `${qx + d[0]},${qy + d[1]}`;
                    if (!occupied.has(nk)) availableSlots.add(nk);
                });
                hullsLeft--;
            } else {
                availableSlots.delete(key); // Couldn't place (collision?), remove
            }
        }

        // Place Weapons (try to place on outer edges if possible, or just random)
        // Refresh available slots based on current hull layout
        let weaponsLeft = this.weaponCount;

        // Dynamic weapon types from library
        const weaponTypes = Object.keys(PartsLibrary).filter(id => {
            const def = PartsLibrary[id];
            // Only use official or valid weapons
            return def.type === 'weapon';
        });

        while (weaponsLeft > 0 && availableSlots.size > 0) {
            const slots = Array.from(availableSlots);
            const key = slots[Math.floor(Math.random() * slots.length)];
            const [qx, qy] = key.split(',').map(Number);

            // Random weapon based on level?
            const wId = weaponTypes[Math.floor(Math.random() * Math.min(weaponTypes.length, 1 + this.level))];

            if (this.addPart(qx, qy, wId)) {
                occupied.add(key);
                availableSlots.delete(key);
                directions.forEach(d => {
                    const nk = `${qx + d[0]},${qy + d[1]}`;
                    if (!occupied.has(nk)) availableSlots.add(nk);
                });
                weaponsLeft--;
            } else {
                availableSlots.delete(key);
            }
        }
    }

    addPart(x, y, partId) {
        const def = PartsLibrary[partId];
        if (!def) return false;

        const w = def.width;
        const h = def.height;

        // Check collision (very basic check, assumes 1x1 or fits in grid)
        // For simplicity in procedural generation, assume all Boss parts are placed unrotated (0) for now,
        // unless we want to get fancy.
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                if (this.parts.has(`${x + i},${y + j}`)) return false;
            }
        }

        const partInstance = {
            x, y,
            partId: partId,
            rotation: 0,
            cooldown: 0,
            hp: def.stats.hp
        };

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                this.parts.set(`${x + i},${y + j}`, partInstance);
            }
        }
        return true;
    }

    recalculateStats() {
        this.stats = { totalHp: 0 };
        const uniqueParts = new Set(this.parts.values());
        for (const p of uniqueParts) {
            const def = PartsLibrary[p.partId];
            this.stats.totalHp += def.stats.hp;
        }
    }

    update(dt, playerX, playerY, projectiles) {
        if (this.isDead) return;

        // Frozen Logic
        if (this.frozenTimer > 0) {
            this.frozenTimer -= dt;
            return;
        }

        if (this.freezeMeter > 0) {
            this.freezeMeter -= dt * 0.4; // Bosses shake off the cold slightly faster
            if (this.freezeMeter < 0) this.freezeMeter = 0;
        }

        // Visual wobble
        this.angle = Math.sin(Date.now() * 0.001) * 0.1;

        // 1. Move towards player if far
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 500) {
            this.x += (dx / dist) * 50 * dt;
            this.y += (dy / dist) * 50 * dt;
        }

        // 2. Fire weapons
        const uniqueParts = new Set(this.parts.values());
        for (const part of uniqueParts) {
            const def = PartsLibrary[part.partId];
            if (def.type === 'weapon') {
                if (part.cooldown > 0) part.cooldown -= dt;

                // Aim Logic
                // If charging, stop tracking 0.5s before shot (Telegraph)
                const isCharging = (part.chargeLeft > 0);
                const shouldTrack = !isCharging || (part.chargeLeft > 0.5);

                if (shouldTrack) {
                    const pX = this.x + part.x * TILE_SIZE;
                    const pY = this.y + part.y * TILE_SIZE;
                    part.aimAngle = Math.atan2(playerY - pY, playerX - pX);
                }

                // Charge & Fire Logic
                if (isCharging) {
                    part.chargeLeft -= dt;
                    if (part.chargeLeft <= 0) {
                        // FIRE!
                        const pX = this.x + part.x * TILE_SIZE;
                        const pY = this.y + part.y * TILE_SIZE;
                        const pSpeed = def.stats.projectileType === 'laser' ? 800 : 400;

                        // Use locked aimAngle
                        const finalAngle = part.aimAngle + (Math.random() - 0.5) * 0.1;

                        const proj = new Projectile(pX, pY, finalAngle, def.stats.projectileType || 'bullet', pSpeed, 'enemy', def.stats.damage);
                        projectiles.push(proj);

                        part.chargeLeft = 0;
                        part.cooldown = def.stats.cooldown * 1.5;
                    }
                } else {
                    // Start Attack?
                    if (part.cooldown <= 0 && dist < 1000) {
                        if (def.stats.chargeTime) {
                            // Start Charge
                            part.chargeLeft = def.stats.chargeTime;
                            // Optional: Sound hint?
                        } else {
                            // Instant Fire
                            const pX = this.x + part.x * TILE_SIZE;
                            const pY = this.y + part.y * TILE_SIZE;
                            const pSpeed = def.stats.projectileType === 'laser' ? 800 : 400;
                            const finalAngle = part.aimAngle + (Math.random() - 0.5) * 0.1;

                            const proj = new Projectile(pX, pY, finalAngle, def.stats.projectileType || 'bullet', pSpeed, 'enemy', def.stats.damage);
                            projectiles.push(proj);

                            part.cooldown = def.stats.cooldown * 1.5;
                        }
                    }
                }
            }
        }
    }

    takeDamage(amount, sourceProjectileType = null) {
        this.hp -= amount;

        if (sourceProjectileType === 'beam_freeze') {
            const now = Date.now();
            if (this.lastFreezeTick > 0) {
                const elapsed = Math.min(now - this.lastFreezeTick, 200);
                this.freezeMeter += (elapsed / 714);
            }
            this.lastFreezeTick = now;

            if (this.freezeMeter >= 3.0) {
                this.frozenTimer = 1.5; // Boss stays frozen for short time
                this.freezeMeter = 0;
            }
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    draw(renderer) {
        if (this.isDead) return;

        const ctx = renderer.ctx;
        const uniqueParts = new Set(this.parts.values());

        // Draw Parts
        // Note: Boss rotation is simplified to 0ish for now, or we implement full matrix
        // Let's implement full rotation for coolness

        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        if (this.frozenTimer > 0 || this.freezeMeter > 0) {
            const intensity = this.frozenTimer > 0 ? 1.0 : (this.freezeMeter / 3.0);
            ctx.save();
            ctx.globalAlpha = 0.5 + intensity * 0.3;
            ctx.shadowBlur = 10 + intensity * 20;
            ctx.shadowColor = '#00ffff';
        }

        for (const part of uniqueParts) {
            const def = PartsLibrary[part.partId];

            // Relative position
            const rx = part.x * TILE_SIZE;
            const ry = part.y * TILE_SIZE;

            // Rotated World Position
            const wx = this.x + (rx * cos - ry * sin);
            const wy = this.y + (rx * sin + ry * cos);

            // Draw Base
            const tint = (this.frozenTimer > 0) ? '#00ffff' : '#cc0000';
            if (def.type === 'weapon') {
                if (def.baseSprite) {
                    def.baseSprite.draw(ctx, wx, wy, this.angle, 0.5, 0.5, null, tint);
                } else if ((def.width === 1 && def.height === 2) || (def.width === 2 && def.height === 1)) {
                    // Placeholder
                }

                // Turret Position Calculation (with vector offset)
                let tx = wx;
                let ty = wy;

                // Base rotation of the part relative to ship/boss
                const partRotation = 0; // Bosses have static part rotations for now?
                // Actually they don't have rotation data in this simplified loop logic yet, 
                // but if they did, we'd add it here.

                // Mount angle = Boss Angle (since parts are static on boss? or aimed?)
                // Assuming parts are static relative to boss body:
                const mountAngle = this.angle;

                if (def.turretDrawOffset) {
                    let offsetX = 0;
                    let offsetY = 0;
                    if (typeof def.turretDrawOffset === 'object') {
                        const ox = def.turretDrawOffset.x || 0;
                        const oy = def.turretDrawOffset.y || 0;
                        offsetX = Math.cos(mountAngle) * ox - Math.sin(mountAngle) * oy;
                        offsetY = Math.sin(mountAngle) * ox + Math.cos(mountAngle) * oy;
                    } else {
                        // Scalar offset along mount angle (forward)
                        offsetX = Math.cos(mountAngle) * def.turretDrawOffset;
                        offsetY = Math.sin(mountAngle) * def.turretDrawOffset;
                    }
                    tx += offsetX;
                    ty += offsetY;
                }

                const aimAngle = part.aimAngle || this.angle;
                if (def.sprite) {
                    def.sprite.draw(ctx, tx, ty, aimAngle, null, null, null, (this.frozenTimer > 0) ? '#00ffff' : '#ff0033');
                }
            } else {
                if (def.sprite) {
                    def.sprite.draw(ctx, wx, wy, this.angle, 0.5, 0.5, null, tint);
                }
            }
        }

        // HP Bar
        const barW = 100;
        const barH = 8;
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - barW / 2, this.y - 60, barW, barH);
        ctx.fillStyle = '#ff00ff'; // Boss Purple
        ctx.fillRect(this.x - barW / 2, this.y - 60, barW * hpPct, barH);
        if (this.frozenTimer > 0 || this.freezeMeter > 0) {
            ctx.restore();
        }
    }
}
