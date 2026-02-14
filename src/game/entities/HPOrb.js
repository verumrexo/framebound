import { BaseOrb } from './BaseOrb.js';

export class HPOrb extends BaseOrb {
    constructor(x, y, value = 10) {
        super(x, y, value, 6);

        // Visual properties
        this.rotation = Math.random() * Math.PI * 2;
        this.color = '#44ff44'; // Green
        this.spinSpeed = 6.0;
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
        ctx.rotate(this.rotation);

        // Glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;

        // Draw spinning cross (health symbol)
        const size = this.radius;
        const thickness = 3;

        ctx.fillStyle = this.color;

        // Vertical bar
        ctx.fillRect(-thickness / 2, -size, thickness, size * 2);
        // Horizontal bar
        ctx.fillRect(-size, -thickness / 2, size * 2, thickness);

        // Inner glow (brighter center)
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#aaffaa';
        const innerThick = 1.5;
        ctx.fillRect(-innerThick / 2, -size + 1, innerThick, (size - 1) * 2);
        ctx.fillRect(-size + 1, -innerThick / 2, (size - 1) * 2, innerThick);

        ctx.restore();
    }
}
