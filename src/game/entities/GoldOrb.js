export class GoldOrb {
    constructor(x, y, value = 1) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.isDead = false;

        // Visual properties
        this.rotation = Math.random() * Math.PI * 2;
        this.color = '#ffd700'; // Gold
        this.forced = false;
        this.spinSpeed = 8.0;
        this.radius = 6;
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
