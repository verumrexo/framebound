import { PartType, PartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { Assets } from '../../Assets.js';

export class ModuleHUD {
    constructor(game) {
        this.game = game;
        this.slotSize = 40;
        this.margin = 10;
        this.padding = 5;
    }

    draw(renderer) {
        if (!this.game.playerShip || this.game.isGameOver) return;
        if (this.game.hangar.active || this.game.shipBuilder.active) return;

        const ctx = renderer.ctx;
        const parts = Array.from(this.game.playerShip.parts.values());

        // Filter active modules
        const modules = [];
        const uniqueParts = new Set(parts); // De-duplicate references (parts map has multiple entries for same part)

        for (const part of uniqueParts) {
            const def = PartsLibrary[part.partId];
            if (!def) continue;

            // Include Weapons, Shields, and Boosters
            if (def.type === PartType.WEAPON ||
                def.type === PartType.SHIELD ||
                def.type === PartType.BOOSTER) {
                modules.push({ part, def });
            }
        }

        // Sort by Grid Position (Y then X) to keep order stable
        modules.sort((a, b) => {
            if (a.part.y !== b.part.y) return a.part.y - b.part.y;
            return a.part.x - b.part.x;
        });

        // Positioning
        const startX = 20;
        const startY = renderer.height - this.slotSize - 60; // Above bottom bar info

        ctx.save();
        ctx.font = "8px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Helper to format name with numbering
        const nameCounts = {};
        const getDisplayName = (def) => {
            const baseName = def.name.toUpperCase();
            if (!nameCounts[baseName]) nameCounts[baseName] = 0;
            nameCounts[baseName]++;
            // If total count > 1, append number?
            // We need to know total count first.
            // Let's just append number if we see it again, but that might jitter.
            // Better: Pre-count? No, just use index in list?
            // Simple: just "DART" is fine, but prompt asked for "BULLET 1".
            // Let's stick to simple names unless requested otherwise, or use index.
            // Actually prompt example "BULLET 1" implies numbering.
            return `${baseName} ${nameCounts[baseName]}`;
        };

        // Reset counts for this frame
        for (const key in nameCounts) delete nameCounts[key];

        for (let i = 0; i < modules.length; i++) {
            const { part, def } = modules[i];
            const x = startX + i * (this.slotSize + this.margin);
            const y = startY;

            // Determine State
            let cooldown = 0;
            let maxCooldown = 1;
            let isReady = true;

            if (def.type === PartType.WEAPON) {
                cooldown = part.cooldown || 0;
                maxCooldown = part.maxCooldown || (def.stats.cooldown || 1);
            } else if (def.type === PartType.SHIELD) {
                cooldown = part.shieldCooldown || 0;
                maxCooldown = part.maxShieldCooldown || (def.stats.shieldCooldown || 1);
            } else if (def.type === PartType.BOOSTER) {
                // Global Dash Cooldown
                cooldown = this.game.dashCooldown || 0;
                maxCooldown = this.game.dashTotalCooldown || this.game.dashMaxCooldown;
            }

            if (cooldown > 0) isReady = false;

            // Draw Slot Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(x, y, this.slotSize, this.slotSize);

            // Draw Border
            if (isReady) {
                ctx.strokeStyle = '#00FF00'; // Neon Green
                ctx.lineWidth = 2;
                // Add Glow
                ctx.shadowColor = '#00FF00';
                ctx.shadowBlur = 10;
            } else {
                ctx.strokeStyle = '#555555'; // Grey
                ctx.lineWidth = 1;
                ctx.shadowBlur = 0;
            }
            ctx.strokeRect(x, y, this.slotSize, this.slotSize);
            ctx.shadowBlur = 0; // Reset

            // Draw Icon
            // We need to draw the sprite centered.
            // Sprite.draw() usually takes x, y, rotation, scaleX, scaleY.
            // Part sprites are 8x8 usually, scaled to TILE_SIZE (28).
            // We want to fit it in 40x40.
            const iconScale = (this.slotSize - 8) / TILE_SIZE;

            // Save context for clipping/positioning
            ctx.save();
            const centerX = x + this.slotSize / 2;
            const centerY = y + this.slotSize / 2;

            // Draw Sprite
            // Note: PartsLibrary sprite might be a Sprite instance or Asset.
            // Most are Sprite instances.
            if (def.sprite) {
                // Rotation: 0 is Up. Parts are drawn Rotated in game.
                // In HUD, let's draw them upright (-PI/2 visually? or just 0?)
                // Parts are defined facing Right usually (0 deg).
                // Let's draw at -PI/2 (Up) for icons.
                def.sprite.draw(ctx, centerX, centerY, -Math.PI/2, iconScale, iconScale);
            }
            ctx.restore();

            // Draw Cooldown Overlay (Wipe)
            if (!isReady && maxCooldown > 0) {
                const pct = Math.max(0, Math.min(1, cooldown / maxCooldown));
                const h = this.slotSize * pct;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(x, y + (this.slotSize - h), this.slotSize, h);

                // Optional: Draw timer text if long?
                if (cooldown > 1.0) {
                    ctx.fillStyle = '#fff';
                    ctx.fillText(Math.ceil(cooldown), centerX, centerY - 4);
                }
            }

            // Draw Label
            const displayName = getDisplayName(def);
            ctx.fillStyle = isReady ? '#00FF00' : '#888888';
            ctx.fillText(displayName, x + this.slotSize / 2, y + this.slotSize + 4);
        }

        ctx.restore();
    }
}
