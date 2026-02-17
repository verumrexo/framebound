import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';

export class VaultChest {
    constructor(x, y, costType, costAmount, randomGen = null) {
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.costType = costType; // 'gold' or 'hp'
        this.costAmount = costAmount;
        this.radius = 50;
        this.bobOffset = this.random() * Math.PI * 2;
        this.life = 0;
        this.opened = false; // "Opened" means successfully claimed after ambush
        this.locked = false;  // Triggered when paid (ambush active)
        this.ambushActive = false; // Waiting for ambush to clear
        this.rotation = 0;

        // Get chest sprite from Assets
        this.sprite = Assets.TreasureChest;
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
        ctx.font = "12px 'Press Start 2P'";
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

        ctx.fillText(`[E] ${costText} `, this.x, tooltipY + 45);

        ctx.textAlign = 'left';
    }
}
