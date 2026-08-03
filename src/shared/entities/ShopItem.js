import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';

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
            this.partDef = PartsLibrary[this.data.partId];
        }
    }

    update(dt) {
        this.life += dt;
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
        ctx.font = "14px 'Silkscreen', 'Pixelify Sans', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(String(this.data.name).toLowerCase(), this.x, tooltipY + 20);

        // Description/Stats
        ctx.fillStyle = '#aaa';
        ctx.font = "13px 'Pixelify Sans', 'Silkscreen', monospace";
        ctx.fillText(String(this.data.description).toLowerCase(), this.x, tooltipY + 40);

        // Part stats if available
        if (this.partDef && this.partDef.stats) {
            const stats = this.partDef.stats;
            ctx.fillStyle = '#888';
            ctx.font = "11px 'Pixelify Sans', 'Silkscreen', monospace";
            ctx.fillText(`hp: ${stats.hp || 0} | mass: ${stats.mass || 0}`, this.x, tooltipY + 56);
        }

        // Buy prompt
        ctx.fillStyle = canAfford ? '#44ff44' : '#ff4444';
        ctx.font = "13px 'Pixelify Sans', 'Silkscreen', monospace";
        const promptText = canAfford ? '[e] buy' : 'not enough gold!';
        ctx.fillText(promptText, this.x, tooltipY + tooltipH - 8);

        ctx.textAlign = 'left';
    }
}
