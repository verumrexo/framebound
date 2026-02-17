import { PartsLibrary } from '../parts/Part.js';
import { TILE_SIZE } from '../parts/PartDefinitions.js';

export class ItemPickup {
    constructor(x, y, partId, randomGen = null) {
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.partId = partId;
        this.radius = TILE_SIZE * 0.5;

        // Drifting physics
        const angle = this.random() * Math.PI * 2;
        const speed = 10 + this.random() * 20;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.bobOffset = this.random() * 100;
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

}
