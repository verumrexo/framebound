import { Sprite } from '../../engine/Sprite.js';
import { TILE_SIZE } from '../parts/PartDefinitions.js';

export class TrainingDummy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isDead = false;
        this.type = 'dummy';
        this.radius = TILE_SIZE * 1.5;
        this.rotation = 0;

        // Stats
        this.maxHp = 10000;
        this.hp = this.maxHp;

        // DPS Tracking
        this.totalDamage = 0;
        this.startTime = 0;
        this.lastHitTime = 0;
        this.currentDps = 0;
        this.dpsWindow = 5; // Calculate over last 5 seconds or since start

        // Visual
        this.sprite = new Sprite([
            0, 0, 1, 1, 1, 1, 0, 0,
            0, 1, 2, 2, 2, 2, 1, 0,
            1, 2, 1, 1, 1, 1, 2, 1,
            1, 2, 1, 0, 0, 1, 2, 1,
            1, 2, 1, 0, 0, 1, 2, 1,
            1, 2, 1, 1, 1, 1, 2, 1,
            0, 1, 2, 2, 2, 2, 1, 0,
            0, 0, 1, 1, 1, 1, 0, 0
        ], 8, 8, 6, { 1: '#ffffff', 2: '#ff0000' });
    }

    takeDamage(amount) {
        const now = Date.now();
        if (this.startTime === 0) {
            this.startTime = now;
        }

        this.totalDamage += amount;
        this.lastHitTime = now;

        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = this.maxHp; // Reset HP
        }
    }

    update(dt, playerX, playerY, projectiles) {
        const now = Date.now();
        if (this.startTime !== 0) {
            const duration = (now - this.startTime) / 1000;
            if (duration > 0.1) {
                this.currentDps = Math.round(this.totalDamage / duration);
            }

            // Reset if no hits for 8 seconds
            if (now - this.lastHitTime > 8000) {
                this.startTime = 0;
                this.totalDamage = 0;
                this.currentDps = 0;
            }
        }
    }

    draw(renderer) {
        this.sprite.draw(renderer.ctx, this.x, this.y, this.rotation);

        // UI
        renderer.ctx.fillStyle = '#fff';
        renderer.ctx.font = "20px 'VT323'";
        renderer.ctx.textAlign = 'center';
        renderer.ctx.fillText(`TRAINING DUMMY`, this.x, this.y - (this.radius + 30));

        renderer.ctx.fillStyle = '#0f0';
        renderer.ctx.font = "30px 'VT323'";
        renderer.ctx.fillText(`${this.currentDps} DPS`, this.x, this.y - (this.radius + 5));

        renderer.ctx.textAlign = 'start'; // Reset
    }
}
