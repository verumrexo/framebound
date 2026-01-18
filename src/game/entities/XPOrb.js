export class XPOrb {
    constructor(x, y, value = 1) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.isDead = false;
        this.radius = 2.5; // Smaller

        // Visual properties
        this.pulseAngle = Math.random() * Math.PI * 2;
        this.color = '#00ffff'; // Brighter Cyan
        this.forced = false;
    }

    update(dt, playerX, playerY) {
        if (this.isDead) return;

        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        const magnetRange = 300;
        const collectRange = 40;

        if (dist < collectRange) {
            this.isDead = true;
            return true; // Signal collection
        }

        if (this.forced || dist < magnetRange) {
            // Stronger pull as it gets closer. If forced, we use a consistent high force.
            const force = this.forced ? 1500 : (1 - dist / magnetRange) * 1200;
            this.x += (dx / dist) * force * dt;
            this.y += (dy / dist) * force * dt;
        }

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
