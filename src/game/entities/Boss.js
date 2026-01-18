import { PartsLibrary, TILE_SIZE, UserPartsLibrary } from '../parts/Part.js';
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
        const weaponTypes = ['gun_basic', 'lps', 'scattr', 'rocketle', 'railgun', 'ggbm'];

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
        const def = PartsLibrary[partId] || UserPartsLibrary[partId];
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
            const def = PartsLibrary[p.partId] || UserPartsLibrary[p.partId];
            this.stats.totalHp += def.stats.hp;
        }
    }

    update(dt, playerX, playerY, projectiles) {
        if (this.isDead) return;

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
            const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];
            if (def.type === 'weapon') {
                if (part.cooldown > 0) part.cooldown -= dt;

                // Fire
                if (part.cooldown <= 0 && dist < 1000) {
                    // Calc aim angle
                    // Boss parts are relative to boss X,Y
                    // Coordinates: bossX + (partX * TILE_SIZE) rotated by bossAngle...
                    // For now, simplify boss angle ~ 0
                    const pX = this.x + part.x * TILE_SIZE;
                    const pY = this.y + part.y * TILE_SIZE;

                    const aimAngle = Math.atan2(playerY - pY, playerX - pX);
                    part.aimAngle = aimAngle;

                    // Spawn Projectile
                    const pSpeed = def.stats.projectileType === 'laser' ? 800 : 400;
                    // Add some spread
                    const finalAngle = aimAngle + (Math.random() - 0.5) * 0.1;

                    const proj = new Projectile(pX, pY, finalAngle, def.stats.projectileType || 'bullet', pSpeed, 'enemy', def.stats.damage);
                    projectiles.push(proj);

                    part.cooldown = def.stats.cooldown * 1.5; // Boss fires slightly slower
                }
            }
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
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

        for (const part of uniqueParts) {
            const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];

            // Relative position
            const rx = part.x * TILE_SIZE;
            const ry = part.y * TILE_SIZE;

            // Rotated World Position
            const wx = this.x + (rx * cos - ry * sin);
            const wy = this.y + (rx * sin + ry * cos);

            // Draw Base
            if (def.type === 'weapon') {
                if (def.baseSprite) {
                    def.baseSprite.draw(ctx, wx, wy, this.angle, 0.5, 0.5, null, '#cc0000');
                } else if ((def.width === 1 && def.height === 2) || (def.width === 2 && def.height === 1)) {
                    // Placeholder
                }

                const aimAngle = part.aimAngle || this.angle;
                if (def.sprite) {
                    def.sprite.draw(ctx, wx, wy, aimAngle, 0.5, 0.5, null, '#ff0033');
                }
            } else {
                if (def.sprite) {
                    def.sprite.draw(ctx, wx, wy, this.angle, 0.5, 0.5, null, '#cc0000');
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
    }
}
