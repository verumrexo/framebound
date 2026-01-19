import { PartsLibrary } from '../parts/Part.js';
import { TILE_SIZE } from '../parts/PartDefinitions.js';
import { Assets } from '../../Assets.js';

export class ItemPickup {
    constructor(x, y, partId) {
        this.x = x;
        this.y = y;
        this.partId = partId;
        this.radius = TILE_SIZE * 0.5;

        // Drifting physics
        const angle = Math.random() * Math.PI * 2;
        const speed = 10 + Math.random() * 20;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.bobOffset = Math.random() * 100;
        this.life = 0;
        this.isDead = false;

        // Attraction to player
        this.magnetRadius = 150;
        this.magnetForce = 500;

        // Get Def for sprite
        this.def = PartsLibrary[partId];
    }

    update(dt, player) {
        if (this.isDead) return;
        this.life += dt;

        // Magnet effect
        if (player && !player.isDead) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < this.magnetRadius * this.magnetRadius) {
                const dist = Math.sqrt(distSq);
                const force = (1.0 - dist / this.magnetRadius) * this.magnetForce * dt;

                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            }
        }

        // Drag
        this.vx *= 0.95;
        this.vy *= 0.95;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(renderer) {
        const ctx = renderer.ctx;
        const CELL = TILE_SIZE; // 24

        const bob = Math.sin(this.life * 5 + this.bobOffset) * 4;

        ctx.save();
        ctx.translate(this.x, this.y + bob);

        // Glow
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 10;

        // Draw Part Sprite Scaled
        if (this.def) {
            // Scale down slightly to look like a "drop"
            const scale = 0.6;
            ctx.scale(scale, scale);

            if (this.def.baseSprite) {
                this.def.baseSprite.draw(ctx, 0, 0, 0);
            } else {
                if (this.def.sprite) this.def.sprite.draw(ctx, 0, 0, 0);
            }
        } else {
            // Fallback
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(-6, -6, 12, 12);
        }

        ctx.restore();
    }
}
