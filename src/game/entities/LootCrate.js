import { TILE_SIZE } from '../parts/Part.js';
import { XPOrb } from './XPOrb.js';
import { GoldOrb } from './GoldOrb.js';

export class LootCrate {
    constructor(x, y, sizeInfo = '1x1') {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.rotation = (Math.floor(Math.random() * 4) * Math.PI) / 2; // Aligned rotation
        this.rotSpeed = 0; // Rotational velocity
        this.isDead = false;
        this.isOpened = false;

        // Size Parsing
        // '1x1', '1x2', '2x2'
        const parts = sizeInfo.split('x').map(Number);
        this.wTiles = parts[0];
        this.hTiles = parts[1];

        this.width = this.wTiles * TILE_SIZE;
        this.height = this.hTiles * TILE_SIZE;

        // Physics Radius
        this.radius = Math.max(this.width, this.height) / 2;

        this.maxHp = 20 * (this.wTiles * this.hTiles);
        this.hp = this.maxHp;

        // Visual Variance
        this.variant = Math.floor(Math.random() * 2); // 0 or 1
        // Colors:
        // Variant 0: Military Grey/Cyan (XP)
        // Variant 1: Industrial Brown/Orange (Gold)
        this.baseColor = this.variant === 0 ? '#506070' : '#706050';
        this.detailColor = this.variant === 0 ? '#304050' : '#504030';
        // Force distinct light colors: Cyan for XP, Gold for Money
        this.lightColor = this.variant === 0 ? '#00ffff' : '#ffd700';
    }

    takeDamage(amount) {
        if (this.isOpened) return;
        this.hp -= amount;

        // Shake / hit effect?
        this.rotSpeed += (Math.random() - 0.5) * 5;

        if (this.hp <= 0) {
            this.hp = 0;
            this.isOpened = true;
            this.rotSpeed += (Math.random() - 0.5) * 10; // Violence on break
            return true; // Return true if just opened
        }
        return false;
    }

    update(dt) {
        // Physics (Friction is high)
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.rotSpeed * dt;

        // Friction
        const friction = 0.92;
        this.vx *= friction;
        this.vy *= friction;
        this.rotSpeed *= friction;
    }

    draw(renderer) {
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        const w = this.width;
        const h = this.height;
        const hw = w / 2;
        const hh = h / 2;

        // Pixel Size for Retro Look
        const ps = 4; // Pixel scale

        if (this.isOpened) {
            // DEBRIS STATE (Smashed Crate)
            // Draw dark broken pieces
            ctx.fillStyle = '#222'; // Dark burnt interior

            // Draw "floor" of the crate
            ctx.fillRect(-hw, -hh, w, h);

            // Draw scraps (simulated pixels)
            ctx.fillStyle = this.detailColor;
            for (let i = 0; i < 8; i++) {
                const px = (Math.random() - 0.5) * w;
                const py = (Math.random() - 0.5) * h;
                ctx.fillRect(px, py, ps * 2, ps * 2);
            }

        } else {
            // ALIVE STATE (Retro Box)

            // 1. Draw Update: Beveled Box using Rects
            ctx.fillStyle = this.baseColor;
            ctx.fillRect(-hw, -hh, w, h);

            // 2. Darker Inner Panel
            const b = ps * 2; // Border thickness
            ctx.fillStyle = this.detailColor;
            ctx.fillRect(-hw + b, -hh + b, w - b * 2, h - b * 2);

            // 3. Tech Lights / Corners
            ctx.fillStyle = this.lightColor;

            // Corners
            const c = ps * 2; // corner size
            ctx.fillRect(-hw, -hh, c, c); // TL
            ctx.fillRect(hw - c, -hh, c, c); // TR
            ctx.fillRect(hw - c, hh - c, c, c); // BR
            ctx.fillRect(-hw, hh - c, c, c); // BL

            // Center details depending on size
            if (this.wTiles === 2 || this.hTiles === 2) {
                // Bar in middle
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                if (this.wTiles === 2) ctx.fillRect(-2, -hh + b, 4, h - b * 2); // Vert split
                if (this.hTiles === 2) ctx.fillRect(-hw + b, -2, w - b * 2, 4); // Horz split
            }

            // Tech Blip (Center light)
            ctx.fillStyle = this.lightColor;
            // Pulsate transparency
            const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
            ctx.globalAlpha = 0.5 + pulse * 0.5;
            ctx.fillRect(-ps, -ps, ps * 2, ps * 2);
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();
    }
}
