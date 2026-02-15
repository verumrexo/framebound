import { BaseOrb } from './BaseOrb.js';

export class XPOrb extends BaseOrb {
    constructor(x, y, value = 1) {
        super(x, y, value, 2.5);

        // Visual properties
        this.pulseAngle = Math.random() * Math.PI * 2;
        this.color = '#00ffff'; // Brighter Cyan
    }

    update(dt, playerX, playerY) {
        if (super.update(dt, playerX, playerY)) return true;
        if (this.isDead) return;

        this.pulseAngle += dt * 2.5; // Slower pulse speed
    }

    draw(renderer) {
        if (this.isDead) return;

        const pulse = Math.sin(this.pulseAngle) * 0.5; // Reduced pulse magnitude
        const r = this.radius + pulse;

        // Glow
        const ctx = renderer.ctx;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Inner Core
        renderer.drawCircle(this.x, this.y, r, this.color);

        // Outer Core
        ctx.globalAlpha = 0.5;
        renderer.drawCircle(this.x, this.y, r * 1.5, this.color);

        ctx.restore();
    }
}
