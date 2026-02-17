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

}
