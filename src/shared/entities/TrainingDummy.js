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

        // Visual (Handled by EntityRenderer)
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
            const timeSinceStart = (now - this.startTime) / 1000;
            if (timeSinceStart > 0) {
                this.currentDps = Math.round(this.totalDamage / timeSinceStart);
            }

            if (now - this.lastHitTime > 5000) {
                this.startTime = 0;
                this.totalDamage = 0;
                this.currentDps = 0;
            }
        }
    }

    checkShieldHit(px, py) {
        return { hit: false };
    }

    checkPartHit(px, py, radius = 4) {
        const dx = px - this.x;
        const dy = py - this.y;
        const distSq = dx * dx + dy * dy;
        const hitDist = this.radius + radius;
        if (distSq < hitDist * hitDist) {
            return { hit: true };
        }
        return { hit: false };
    }

}
