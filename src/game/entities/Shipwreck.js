import { Ship } from './Ship.js';
import { PartsLibrary, UserPartsLibrary } from '../parts/Part.js';
import { TILE_SIZE } from '../parts/PartDefinitions.js';
import { ItemPickup } from './ItemPickup.js';
import { Assets } from '../../Assets.js';

export class Shipwreck {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.rotation = Math.random() * Math.PI * 2;
        this.isDead = false;

        // Use Ship class for layout management
        this.ship = new Ship();
        this.ship.parts.clear(); // Clear core

        // Generate random wreckage
        this.generate();

        this.itemsDropped = 0;
        this.maxItems = 2 + Math.floor(Math.random() * 2); // 2 to 3 items max
    }

    generate() {
        // Start with a center block (Hull or Structural)
        this.ship.addPart(0, 0, 'hull');

        const partTypes = ['hull', 'structure_bar', 'gun_basic', 'thruster', 'scattr', 'lps', 'rocketle', 'minigun'];
        const count = 5 + Math.floor(Math.random() * 8);

        // Random walk generation
        const openList = [{ x: 0, y: 0 }];
        const placed = new Set(['0,0']);

        // Safety break
        let attempts = 0;
        let placedCount = 0;

        while (placedCount < count && attempts < 100) {
            attempts++;
            if (openList.length === 0) break;

            // Pick random existing spot
            const rIdx = Math.floor(Math.random() * openList.length);
            const spot = openList[rIdx];

            // Try neighbors
            const neighbors = [
                { x: spot.x + 1, y: spot.y },
                { x: spot.x - 1, y: spot.y },
                { x: spot.x, y: spot.y + 1 },
                { x: spot.x, y: spot.y - 1 }
            ];

            const target = neighbors[Math.floor(Math.random() * neighbors.length)];
            const key = `${target.x},${target.y}`;

            if (!placed.has(key)) {
                const type = partTypes[Math.floor(Math.random() * partTypes.length)];
                // Random rotation
                const rot = Math.floor(Math.random() * 4);

                if (this.ship.addPart(target.x, target.y, type, rot)) {
                    placed.add(key);
                    openList.push(target);
                    placedCount++;

                    // Add HP to the part instance
                    const part = this.ship.getPart(target.x, target.y);
                    if (part) {
                        const def = PartsLibrary[type] || UserPartsLibrary[type];
                        part.maxHp = (def.stats.hp || 10) * 0.5; // Wrecks are weak
                        part.hp = part.maxHp;
                    }
                }
            }
        }

        // Ensure 0,0 part has HP too if missed
        const core = this.ship.getPart(0, 0);
        if (core && !core.hp) {
            core.hp = 20;
            core.maxHp = 20;
        }
    }

    takeDamage(amount, worldX, worldY) {
        // Find which part was hit
        // Transform world to local
        const dx = worldX - this.x;
        const dy = worldY - this.y;

        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);

        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        const gx = Math.round(localX / TILE_SIZE);
        const gy = Math.round(localY / TILE_SIZE);

        const part = this.ship.getPart(gx, gy);
        if (part) {
            part.hp -= amount;
            if (part.hp <= 0) {
                // Destroy part
                const partId = part.partId;

                // Use manual remove to allow destroying 0,0
                this._manualRemovePart(gx, gy);

                // Return drop info
                let dropItem = false;

                // 30% chance to drop, if under max limit
                if (Math.random() < 0.3 && this.itemsDropped < this.maxItems) {
                    dropItem = true;
                    this.itemsDropped++;
                }

                return { destroyed: true, partId: partId, x: worldX, y: worldY, shouldDrop: dropItem };
            }
            return { destroyed: false };
        }
        return false; // Missed parts
    }

    _manualRemovePart(x, y) {
        const key = `${x},${y}`;
        if (!this.ship.parts.has(key)) return;

        const part = this.ship.parts.get(key);
        const originX = part.x;
        const originY = part.y;

        const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];
        if (!def) {
            this.ship.parts.delete(key);
            return;
        }

        const isRotated = ((part.rotation || 0) % 2 !== 0);
        const w = isRotated ? def.height : def.width;
        const h = isRotated ? def.width : def.height;

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                this.ship.parts.delete(`${originX + i},${originY + j}`);
            }
        }
    }

    draw(renderer) {
        const ctx = renderer.ctx;
        const CELL = TILE_SIZE;

        // Draw parts tinted red
        for (const part of this.ship.getUniqueParts()) {
            const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];
            if (!def) continue;

            const isRotated = ((part.rotation || 0) % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            const localCX = (part.x + (w - 1) / 2) * CELL;
            const localCY = (part.y + (h - 1) / 2) * CELL;

            const worldPartX = this.x + (localCX * Math.cos(this.rotation) - localCY * Math.sin(this.rotation));
            const worldPartY = this.y + (localCX * Math.sin(this.rotation) + localCY * Math.cos(this.rotation));

            ctx.save();
            ctx.translate(worldPartX, worldPartY);
            ctx.rotate(this.rotation + (part.rotation || 0) * (Math.PI / 2));

            if (def.baseSprite) def.baseSprite.draw(ctx, 0, 0, 0);
            else if (def.sprite) def.sprite.draw(ctx, 0, 0, 0);

            // Tint
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(100, 0, 0, 0.6)'; // Dark Red tint

            // Use actual dimensions in local space (unrotated since context is already rotated)
            const sw = def.width * CELL;
            const sh = def.height * CELL;
            ctx.fillRect(-sw / 2, -sh / 2, sw, sh);

            ctx.restore();
        }

        // Check if empty
        if (this.ship.getUniqueParts().size === 0) {
            this.isDead = true;
        }
    }
}
