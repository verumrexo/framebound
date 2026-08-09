import { TILE_SIZE } from '../parts/Part.js';
import { XPOrb } from './XPOrb.js';
import { GoldOrb } from './GoldOrb.js';

export class LootCrate {
    constructor(x, y, sizeInfo = '1x1', randomGen = null) {
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.vx = 0;
        this.vy = 0;
        this.rotation = (Math.floor(this.random() * 4) * Math.PI) / 2; // Aligned rotation
        this.rotSpeed = 0; // Rotational velocity
        this.isDead = false;
        this.isOpened = false;
        this.breakAge = 0;
        this.breakFragments = [];

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
        this.variant = Math.floor(this.random() * 3); // 0, 1, or 2
        // Colors:
        // Variant 0: Military Grey/Cyan (XP)
        // Variant 1: Industrial Brown/Orange (Gold)
        // Variant 2: Medical Green (HP)
        this.refreshVariantColors();
    }

    refreshVariantColors() {
        const variantColors = [
            { base: '#506070', detail: '#304050', light: '#00ffff' },  // XP
            { base: '#706050', detail: '#504030', light: '#ffd700' },  // Gold
            { base: '#507050', detail: '#305030', light: '#44ff44' }   // HP
        ];
        const colors = variantColors[this.variant] || variantColors[0];
        this.baseColor = colors.base;
        this.detailColor = colors.detail;
        this.lightColor = colors.light;
    }

    takeDamage(amount) {
        if (this.isOpened) return;
        this.hp -= amount;

        // Shake / hit effect?
        this.rotSpeed += (this.random() - 0.5) * 5;

        if (this.hp <= 0) {
            this.hp = 0;
            this.isOpened = true;
            this.createBreakFragments();
            this.rotSpeed += (this.random() - 0.5) * 10; // Violence on break
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

        if (this.isOpened && this.breakFragments.length > 0) {
            this.breakAge += dt;
            for (const fragment of this.breakFragments) {
                fragment.x += fragment.vx * dt;
                fragment.y += fragment.vy * dt;
                fragment.rotation += fragment.rotSpeed * dt;
                fragment.vx *= 0.88;
                fragment.vy *= 0.88;
                fragment.rotSpeed *= 0.86;
            }
        }
    }

    createBreakFragments() {
        if (this.breakFragments.length > 0) return;
        const columns = this.wTiles === 2 ? 2 : 1;
        const rows = this.hTiles === 2 ? 2 : 1;
        const panelWidth = this.width / columns;
        const panelHeight = this.height / rows;
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const x = -this.width / 2 + panelWidth * (column + 0.5);
                const y = -this.height / 2 + panelHeight * (row + 0.5);
                const angle = Math.atan2(y || this.random() - 0.5, x || this.random() - 0.5);
                const speed = 24 + this.random() * 34;
                this.breakFragments.push({
                    x,
                    y,
                    width: Math.max(8, panelWidth - 3),
                    height: Math.max(8, panelHeight - 3),
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    rotation: 0,
                    rotSpeed: (this.random() - 0.5) * 4,
                    color: (row + column) % 2 === 0
                        ? this.baseColor
                        : this.detailColor
                });
            }
        }
        for (let index = 0; index < 2; index++) {
            const angle = this.random() * Math.PI * 2;
            const speed = 30 + this.random() * 35;
            this.breakFragments.push({
                x: 0,
                y: 0,
                width: 6,
                height: 6,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rotation: angle,
                rotSpeed: (this.random() - 0.5) * 6,
                color: this.lightColor
            });
        }
    }
}
