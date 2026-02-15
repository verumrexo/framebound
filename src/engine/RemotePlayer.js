
import { PartsLibrary } from '../game/parts/Part.js';
import { Assets } from '../Assets.js';
import { TILE_SIZE } from '../game/parts/Part.js';

export class RemotePlayer {
    constructor(id) {
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.parts = []; // Array of {x, y, partId, rotation}
        this.input = {}; // { up, down, left, right, x, y, rotation }
        this.hp = 100;
        this.maxHp = 100;
    }

    setShipData(parts) {
        this.parts = parts || [];
    }

    draw(renderer) {
        const ctx = renderer.ctx;
        const CELL_STRIDE = TILE_SIZE;
        const shipCos = Math.cos(this.rotation);
        const shipSin = Math.sin(this.rotation);

        ctx.save();

        // Draw Health Bar
        if (this.hp < this.maxHp) {
            const barWidth = 60;
            const barHeight = 6;
            const barX = this.x - barWidth / 2;
            const barY = this.y - 60; // Above ship

            // Background
            ctx.fillStyle = '#330000';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Foreground
            const validHp = Math.max(0, this.hp);
            const pct = validHp / this.maxHp;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(barX, barY, barWidth * pct, barHeight);

            // Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        // We can either translate/rotate the context for the whole ship
        // OR calculate world positions for each part like the local player.
        // Local player calculates world positions to handle independent turret rotation and offsets correctly.
        // Let's stick to world position calculation for consistency with Ship.js draw().

        for (const partRef of this.parts) {
            const def = PartsLibrary[partRef.partId];
            if (!def) continue;

            const isRotated = ((partRef.rotation || 0) % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            const localCX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
            const localCY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

            const worldPartX = this.x + (localCX * shipCos - localCY * shipSin);
            const worldPartY = this.y + (localCX * shipSin + localCY * shipCos);

            if (def.type === 'weapon') {
                // Draw base
                if (def.baseSprite) {
                    def.baseSprite.draw(ctx, worldPartX, worldPartY, this.rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                    if (Assets.LongHull) Assets.LongHull.draw(ctx, worldPartX, worldPartY, this.rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else {
                    if (Assets.PlayerBase) Assets.PlayerBase.draw(ctx, worldPartX, worldPartY, this.rotation, 0.5, 0.5);
                }

                // Draw turret
                // For remote players, we don't have their mouse position easily synced yet (unless we send 'aimAngle').
                // Ideally, we should receive 'aimAngle' in the update packet.
                // For now, let's just aim forward relative to the ship (this.rotation).

                const angle = this.rotation; // Default aim forward

                // TODO: Sync aim angle properly

                let offsetX = 0;
                let offsetY = 0;

                // Apply offsets
                const baseAngle = this.rotation + (partRef.rotation || 0) * (Math.PI / 2);
                if (def.turretDrawOffset) {
                    if (typeof def.turretDrawOffset === 'object') {
                        const ox = def.turretDrawOffset.x || 0;
                        const oy = def.turretDrawOffset.y || 0;
                        offsetX = Math.cos(baseAngle) * ox - Math.sin(baseAngle) * oy;
                        offsetY = Math.sin(baseAngle) * ox + Math.cos(baseAngle) * oy;
                    } else {
                        offsetX = Math.cos(angle) * def.turretDrawOffset;
                        offsetY = Math.sin(angle) * def.turretDrawOffset;
                    }
                }

                if (def.baseSprite && (def.baseSprite.anchorX !== 0.5 || def.baseSprite.anchorY !== 0.5)) {
                    const bpx = (def.baseSprite.anchorX - 0.5) * def.baseSprite.width * def.baseSprite.scale;
                    const bpy = (def.baseSprite.anchorY - 0.5) * def.baseSprite.height * def.baseSprite.scale;
                    offsetX += Math.cos(baseAngle) * bpx - Math.sin(baseAngle) * bpy;
                    offsetY += Math.sin(baseAngle) * bpx + Math.cos(baseAngle) * bpy;
                }

                def.sprite.draw(ctx, worldPartX + offsetX, worldPartY + offsetY, angle + (def.rotationOffset || 0), null, null, 'rgba(255,255,255,0.4)');

            } else {
                // Static Part
                def.sprite.draw(ctx, worldPartX, worldPartY, this.rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
            }

            // Core Effect
            if (def.id === 'core' && def.coreEffectSprite) {
                const spin = this.rotation + ((Date.now() % 10000) * 0.003);
                def.coreEffectSprite.draw(ctx, worldPartX, worldPartY, spin);
            }
        }

        ctx.restore();
    }
}
