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

}
