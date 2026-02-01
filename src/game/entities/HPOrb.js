export class HPOrb {
    constructor(x, y, value = 10) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.isDead = false;
        this.radius = 6;

        // Visual properties
        this.rotation = Math.random() * Math.PI * 2;
        this.color = '#44ff44'; // Green
        this.forced = false;
        this.spinSpeed = 6.0;
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
