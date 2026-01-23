import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { Assets } from '../../Assets.js';

export class TreasureChest {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 50;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.life = 0;
        this.opened = false;
        this.rotation = 0;

        // Get chest sprite from Assets
        this.sprite = Assets.TreasureChest;
    }

    update(dt) {
        this.life += dt;
    }

    draw(renderer) {
        if (this.opened) return;

        const ctx = renderer.ctx;
        const bobY = this.y + Math.sin(this.life * 1.5 + this.bobOffset) * 8;

        ctx.save();
        ctx.translate(this.x, bobY);

        // Glow effect
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ffd700';

        // Draw the chest sprite
        if (this.sprite) {
            this.sprite.draw(ctx, 0, 0, this.rotation);
        } else {
            // Fallback if sprite not found
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-30, -30, 60, 60);
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 3;
            ctx.strokeRect(-30, -30, 60, 60);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawTooltip(renderer, canOpen) {
        if (this.opened) return;

        const ctx = renderer.ctx;
        const bobY = this.y + Math.sin(this.life * 1.5 + this.bobOffset) * 8;

        const tooltipW = 150;
        const tooltipH = 50;
        const tooltipX = this.x - tooltipW / 2;
        const tooltipY = bobY - this.radius - tooltipH - 20;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);

        // Name
        ctx.fillStyle = '#ffd700';
        ctx.font = "12px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText('Treasure Chest', this.x, tooltipY + 20);

        // Open prompt
        ctx.fillStyle = '#44ff44';
        ctx.font = "12px 'Press Start 2P'";
        ctx.fillText('[E] Open', this.x, tooltipY + 40);

        ctx.textAlign = 'left';
    }
}
