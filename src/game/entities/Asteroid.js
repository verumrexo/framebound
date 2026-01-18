import { XPOrb } from './XPOrb.js';
import { GoldOrb } from './GoldOrb.js';

export class Asteroid {
    constructor(x, y, size = 'medium', type = 'rock') {
        this.x = x;
        this.y = y;
        this.sizeCategory = size; // small, medium, large
        this.type = type; // rock, crystal_blue, crystal_gold
        this.isDead = false;
        this.isBroken = false;

        // Stats based on size
        let radiusBase = 40;
        let hpBase = 50;

        if (size === 'small') { radiusBase = 25; hpBase = 30; }
        if (size === 'large') { radiusBase = 70; hpBase = 120; }

        this.radius = radiusBase;
        this.maxHp = hpBase * (type === 'rock' ? 1.0 : 1.5); // Crystals are tougher
        this.hp = this.maxHp;

        // Physics
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.5; // Very slow spin
        this.vx = (Math.random() - 0.5) * 20; // Very slow drift
        this.vy = (Math.random() - 0.5) * 20;

        // Procedural Shape Generation
        this.vertices = [];
        const segments = 8 + Math.floor(Math.random() * 5); // 8-12 segments
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Radius variation for jaggedness (0.8 to 1.2 x radius)
            const r = this.radius * (0.8 + Math.random() * 0.4);
            this.vertices.push({
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r
            });
        }
    }

    takeDamage(amount) {
        if (this.isDead || this.isBroken) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isBroken = true;
            // Add some spin on break
            this.rotSpeed += (Math.random() - 0.5) * 5;
            return true; // Just broke
        }
        return false;
    }

    update(dt) {
        if (this.isDead) return;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.rotSpeed * dt;
    }

    draw(renderer) {
        if (this.isDead) return;
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Pixelated Style Drawing
        // Instead of vector lines, we draw small squares along the path
        const pixelSize = 4;

        if (this.type === 'rock') {
            ctx.fillStyle = this.isBroken ? '#333' : '#666';
        } else if (this.type === 'crystal_blue') {
            ctx.fillStyle = this.isBroken ? '#003333' : '#00ffff';
            if (!this.isBroken) {
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 10;
            }
        } else if (this.type === 'crystal_gold') {
            ctx.fillStyle = this.isBroken ? '#442200' : '#ffaa00';
            if (!this.isBroken) {
                ctx.shadowColor = '#ffaa00';
                ctx.shadowBlur = 10;
            }
        }

        const drawPixelLine = (x0, y0, x1, y1) => {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = (x0 < x1) ? 1 : -1;
            const sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;

            while (true) {
                ctx.fillRect(Math.floor(x0 / pixelSize) * pixelSize, Math.floor(y0 / pixelSize) * pixelSize, pixelSize, pixelSize);
                if (Math.abs(x0 - x1) < pixelSize && Math.abs(y0 - y1) < pixelSize) break;
                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x0 += sx * pixelSize; }
                if (e2 < dx) { err += dx; y0 += sy * pixelSize; } // Fix: Use correct Bresenham logic adapted for steps
            }
        };

        // Simpler stepped interpolation for pixel look
        const drawStepped = (x0, y0, x1, y1) => {
            const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / pixelSize;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const px = x0 + (x1 - x0) * t;
                const py = y0 + (y1 - y0) * t;
                ctx.fillRect(Math.floor(px / pixelSize) * pixelSize - pixelSize / 2, Math.floor(py / pixelSize) * pixelSize - pixelSize / 2, pixelSize, pixelSize);
            }
        };

        if (this.vertices.length > 0) {
            for (let i = 0; i < this.vertices.length; i++) {
                const nextI = (i + 1) % this.vertices.length;
                drawStepped(this.vertices[i].x, this.vertices[i].y, this.vertices[nextI].x, this.vertices[nextI].y);
            }
        }

        // Center fill (optional, or just outline?)
        // Let's just do thick outline for now to look like "vector pixel art"

        if (this.isBroken) {
            // Debris State
            ctx.globalAlpha = 0.4;
            // Draw scattered pixels interior
            ctx.fillStyle = this.type === 'rock' ? '#444' : this.type === 'crystal_blue' ? '#008888' : '#885500';
            for (let i = 0; i < 6; i++) {
                const px = (Math.random() - 0.5) * this.radius * 1.5;
                const py = (Math.random() - 0.5) * this.radius * 1.5;
                ctx.fillRect(px, py, pixelSize, pixelSize);
            }
        }

        ctx.restore();
    }
}
