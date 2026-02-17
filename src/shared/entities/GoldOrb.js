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

}
