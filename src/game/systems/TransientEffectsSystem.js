
export class TransientEffectsSystem {
    constructor(game) {
        this.game = game;
    }

    showNotification(text, color = '#00ffff') {
        this.game.notifications.push({
            text: text.toLowerCase(),
            color,
            life: 3.0,
            maxLife: 3.0
        });
    }

    spawnDamageNumber(x, y, amount, isPlayer = false, source = null) {
        this.game.combatTelemetry?.record?.(amount, {
            ...source,
            isPlayer
        });
        if (!this.game.showDamageNumbers) return;

        if (this.game.damageNumberMode === 'additive') {
            // Find existing damage number nearby that isn't too old
            const existing = this.game.damageNumbers.find(d =>
                d.isPlayer === isPlayer &&
                (d.source?.family || null) === (source?.family || null) &&
                Math.hypot(d.x - x, d.y - y) < 60 &&
                d.life > d.maxLife * 0.4
            );

            if (existing) {
                existing.amount += amount;
                existing.life = existing.maxLife; // Refresh life
                existing.scale = 1.6; // Pulse size
                existing.x = (existing.x + x) / 2; // Move toward new hit
                existing.y = (existing.y + y) / 2;
                return;
            }
        }

        const damageNumber = {
            x, y,
            amount,
            isPlayer,
            life: 1.2,
            maxLife: 1.2,
            vx: (Math.random() - 0.5) * 40,
            vy: -80 - Math.random() * 40,
            scale: 1.0
        };
        if (source) damageNumber.source = source;
        this.game.damageNumbers.push(damageNumber);
    }

    spawnExplosion(x, y, radius = 50, duration = 0.5, color = '#ffaa44') {
        this.game.explosions.push({
            x,
            y,
            radius,
            life: duration,
            maxLife: duration,
            color
        });
    }

    updateDamageNumbers(dt) {
        for (let i = this.game.damageNumbers.length - 1; i >= 0; i--) {
            const damageNumber = this.game.damageNumbers[i];
            damageNumber.life -= dt;
            if (damageNumber.life <= 0) {
                this.game.damageNumbers.splice(i, 1);
                continue;
            }
            damageNumber.x += damageNumber.vx * dt;
            damageNumber.y += damageNumber.vy * dt;
            damageNumber.vy += 200 * dt; // Gravity
            if (damageNumber.scale > 1.0) damageNumber.scale -= dt * 3.0;
            if (damageNumber.scale < 1.0) damageNumber.scale = 1.0;
        }
    }

    updateExplosions(dt) {
        for (let i = this.game.explosions.length - 1; i >= 0; i--) {
            const explosion = this.game.explosions[i];
            explosion.life -= dt;
            if (explosion.life <= 0) this.game.explosions.splice(i, 1);
        }
    }

    updateNotifications(dt) {
        for (let i = this.game.notifications.length - 1; i >= 0; i--) {
            this.game.notifications[i].life -= dt;
            if (this.game.notifications[i].life <= 0) {
                this.game.notifications.splice(i, 1);
            }
        }
    }

}
