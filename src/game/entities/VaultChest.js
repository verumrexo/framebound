import { PartsLibrary, UserPartsLibrary, TILE_SIZE } from '../parts/Part.js';

export class VaultChest {
    constructor(x, y, costType, costAmount) {
        this.x = x;
        this.y = y;
        this.costType = costType; // 'gold' or 'hp'
        this.costAmount = costAmount;
        this.radius = 50;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.life = 0;
        this.opened = false; // "Opened" means successfully claimed after ambush
        this.locked = false;  // Triggered when paid (ambush active)
        this.ambushActive = false; // Waiting for ambush to clear
        this.rotation = 0;

        // Get chest sprite from UserParts (reuse treasure chest or use a variant)
        this.sprite = UserPartsLibrary['treasure_chest']?.sprite || null;
    }

    update(dt) {
        this.life += dt;
        if (this.ambushActive) {
            // Spin violently while ambush is active
            this.rotation += dt * 10;
        } else if (this.locked) {
            this.rotation = 0;
        }
    }

    draw(renderer) {
        if (this.opened) return; // Disappear when looted

        const ctx = renderer.ctx;
        const bobY = this.y + Math.sin(this.life * 1.5 + this.bobOffset) * 8;

        ctx.save();
        ctx.translate(this.x, bobY);
        ctx.rotate(this.rotation);

        // Glow effect
        ctx.shadowBlur = this.ambushActive ? 40 : 25;
        ctx.shadowColor = this.costType === 'hp' ? '#ff0000' : '#ffd700';

        // Draw the chest sprite
        if (this.sprite) {
            this.sprite.draw(ctx, 0, 0, 0); // Rotation handle by container
        } else {
            // Fallback
            ctx.fillStyle = this.costType === 'hp' ? '#800000' : '#ffd700';
            ctx.fillRect(-30, -30, 60, 60);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(-30, -30, 60, 60);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawTooltip(renderer, player) {
        if (this.opened || this.ambushActive) return;

        const ctx = renderer.ctx;
        const bobY = this.y + Math.sin(this.life * 1.5 + this.bobOffset) * 8;

        const tooltipW = 200;
        const tooltipH = 60;
        const tooltipX = this.x - tooltipW / 2;
        const tooltipY = bobY - this.radius - tooltipH - 20;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.strokeStyle = this.costType === 'hp' ? '#ff4444' : '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);

        // Name
        const name = this.costType === 'hp' ? 'Blood Vault' : 'Gilded Vault';
        ctx.fillStyle = this.costType === 'hp' ? '#ff4444' : '#ffd700';
        ctx.font = "bold 16px 'VT323'";
        ctx.textAlign = 'center';
        ctx.fillText(name, this.x, tooltipY + 20);

        // Cost
        const canAfford = this.costType === 'hp'
            ? player.hp > this.costAmount
            : player.gold >= this.costAmount;

        ctx.fillStyle = canAfford ? '#44ff44' : '#ff4444';
        const costText = this.costType === 'hp'
            ? `Sacrifice ${this.costAmount} HP`
            : `Pay ${this.costAmount} Gold`;

        ctx.fillText(`[E] ${costText}`, this.x, tooltipY + 45);

        ctx.textAlign = 'left';
    }
}
