import { BaseOrb } from './BaseOrb.js';

export class GoldOrb extends BaseOrb {
    constructor(x, y, value = 1) {
        super(x, y, value, 6);

        // Visual properties
        this.rotation = Math.random() * Math.PI * 2;
        this.color = '#ffd700'; // Gold
        this.spinSpeed = 8.0;
    }

    update(dt, playerX, playerY) {
        if (super.update(dt, playerX, playerY)) return true;
        if (this.isDead) return;

        this.rotation += dt * this.spinSpeed;
    }

    draw(renderer) {
        if (this.isDead) return;

        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Spinning Coin Effect (using scaleX to simulate 3D spin)
        const scaleX = Math.max(0.1, Math.abs(Math.sin(this.rotation)));
        ctx.scale(scaleX, 1);

        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Outer Ring
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner Content (Dollar sign or just solid?)
        // Let's do a solid center for better visibility
        ctx.fillStyle = '#ffffaa'; // Lighter gold
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
