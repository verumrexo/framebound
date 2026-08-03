import { WEAPON_FAMILIES } from '../../shared/combat/WeaponFamilies.js';
import { UI_FONTS } from '../ui/UiTheme.js';

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

    drawWorld() {
        // Draw Explosions
        for (const explosion of this.game.explosions) {
            const alpha = explosion.life / explosion.maxLife;
            this.game.renderer.ctx.save();
            this.game.renderer.ctx.globalAlpha = alpha * 0.5;
            this.game.renderer.drawCircle(explosion.x, explosion.y, explosion.radius * (1.2 - alpha), '#ffaa44');
            this.game.renderer.ctx.restore();
        }

        // Draw Damage Numbers (World Space)
        if (this.game.showDamageNumbers) {
            const ctx = this.game.renderer.ctx;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (const damageNumber of this.game.damageNumbers) {
                const alpha = Math.min(1.0, damageNumber.life * 2.0); // Quick fade at end
                const color = damageNumber.isPlayer
                    ? '#ff4444'
                    : WEAPON_FAMILIES[damageNumber.source?.family]?.color || '#00ffff';
                const size = Math.floor(12 * damageNumber.scale);

                ctx.font = `${size}px 'Pixelify Sans', 'Silkscreen', monospace`;

                // Black glow/outline
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'black';
                ctx.fillStyle = 'black';
                ctx.fillText(Math.ceil(damageNumber.amount), damageNumber.x + 2, damageNumber.y + 2);

                ctx.shadowBlur = 0;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = color;
                ctx.fillText(Math.ceil(damageNumber.amount), damageNumber.x, damageNumber.y);
            }
            ctx.restore();
        }
    }

    drawNotifications() {
        if (this.game.notifications.length === 0) return;

        this.game.renderer.ctx.save();
        this.game.renderer.ctx.textAlign = 'center';
        this.game.renderer.ctx.font = UI_FONTS.small;

        let y = this.game.renderer.height - 100;
        for (const notification of this.game.notifications) {
            const alpha = Math.min(1, notification.life * 2); // Fade out
            this.game.renderer.ctx.globalAlpha = alpha;
            this.game.renderer.ctx.fillStyle = notification.color;

            // Shadow for readability
            this.game.renderer.ctx.shadowBlur = 4;
            this.game.renderer.ctx.shadowColor = 'black';

            this.game.renderer.ctx.fillText(notification.text, this.game.renderer.width / 2, y);
            y -= 30; // Stack upwards
        }
        this.game.renderer.ctx.restore();
    }
}
