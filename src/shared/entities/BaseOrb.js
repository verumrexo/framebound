export class BaseOrb {
    constructor(x, y, value = 1, radius = 2.5) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = radius;
        this.isDead = false;
        this.forced = false;
    }

    /**
     * Updates the orb position based on player proximity.
     * @param {number} dt Delta time in seconds
     * @param {number} playerX Player X position
     * @param {number} playerY Player Y position
     * @param {number} [pickupRadiusMul=1] Player's magnet range multiplier
     * @returns {boolean} True if collected, false otherwise
     */
    update(dt, playerX, playerY, pickupRadiusMul = 1) {
        if (this.isDead) return false;

        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        const multiplier = Number.isFinite(pickupRadiusMul) && pickupRadiusMul >= 0
            ? pickupRadiusMul
            : 1;
        const magnetRange = 300 * multiplier;
        const collectRange = 40;

        if (dist < collectRange) {
            this.isDead = true;
            return true; // Signal collection
        }

        if (this.forced || dist < magnetRange) {
            // Stronger pull as it gets closer. If forced, we use a consistent high force.
            const force = this.forced ? 1500 : (1 - dist / magnetRange) * 1200;
            if (dist > 0) {
                this.x += (dx / dist) * force * dt;
                this.y += (dy / dist) * force * dt;
            }
        }

        return false;
    }
}
