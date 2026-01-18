import { PartsLibrary, UserPartsLibrary, TILE_SIZE } from '../parts/Part.js';

export class ShopItem {
    constructor(x, y, itemData) {
        this.x = x;
        this.y = y;
        this.data = itemData; // { type, name, partId, description, price, icon }
        this.radius = 40;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.life = 0;
        this.purchased = false;

        // Get part def if it's a part
        if (this.data.type === 'part' && this.data.partId) {
            this.partDef = PartsLibrary[this.data.partId] || UserPartsLibrary[this.data.partId];
        }
    }

    update(dt) {
        this.life += dt;
    }

    draw(renderer) {
        if (this.purchased) return;

        const ctx = renderer.ctx;
        const bobY = this.y + Math.sin(this.life * 2 + this.bobOffset) * 6;

        ctx.save();
        ctx.translate(this.x, bobY);

        // Glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.data.type === 'heal' ? '#44ff44' : '#ffd700';

        // Background circle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = this.data.type === 'heal' ? '#44ff44' : '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Draw part sprite or heal icon
        if (this.data.type === 'heal') {
            // Draw heart/cross
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-10, -3, 20, 6);
            ctx.fillRect(-3, -10, 6, 20);
        } else if (this.partDef && this.partDef.sprite) {
            this.partDef.sprite.draw(ctx, 0, 0, 0);
        }

        // Price tag below
        ctx.fillStyle = '#ffd700';
        ctx.font = "bold 14px 'VT323'";
        ctx.textAlign = 'center';
        ctx.fillText(`${this.data.price}g`, 0, this.radius + 18);

        ctx.restore();
    }

    drawTooltip(renderer, canAfford) {
        if (this.purchased) return;

        const ctx = renderer.ctx;
        const bobY = this.y + Math.sin(this.life * 2 + this.bobOffset) * 6;

        const tooltipW = 180;
        const tooltipH = this.data.type === 'heal' ? 70 : 90;
        const tooltipX = this.x - tooltipW / 2;
        const tooltipY = bobY - this.radius - tooltipH - 20;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.strokeStyle = canAfford ? '#ffd700' : '#ff4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);

        // Name
        ctx.fillStyle = '#fff';
        ctx.font = "bold 16px 'VT323'";
        ctx.textAlign = 'center';
        ctx.fillText(this.data.name, this.x, tooltipY + 20);

        // Description/Stats
        ctx.fillStyle = '#aaa';
        ctx.font = "14px 'VT323'";
        ctx.fillText(this.data.description, this.x, tooltipY + 40);

        // Part stats if available
        if (this.partDef && this.partDef.stats) {
            const stats = this.partDef.stats;
            ctx.fillStyle = '#888';
            ctx.font = "12px 'VT323'";
            ctx.fillText(`HP: ${stats.hp || 0} | Mass: ${stats.mass || 0}`, this.x, tooltipY + 56);
        }

        // Buy prompt
        ctx.fillStyle = canAfford ? '#44ff44' : '#ff4444';
        ctx.font = "bold 14px 'VT323'";
        const promptText = canAfford ? '[E] Buy' : 'Not enough gold!';
        ctx.fillText(promptText, this.x, tooltipY + tooltipH - 8);

        ctx.textAlign = 'left';
    }
}
