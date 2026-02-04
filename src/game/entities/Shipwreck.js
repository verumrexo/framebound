import { Ship } from './Ship.js';
import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { ItemPickup } from './ItemPickup.js';
import { Assets } from '../../Assets.js';

export class Shipwreck {
    constructor(x, y, level = 1, randomGen = null) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.random = randomGen || Math.random;
        this.rotation = this.random() * Math.PI * 2;
        this.isDead = false;

        // Use Ship class for layout management
        this.ship = new Ship();
        this.ship.parts.clear(); // Clear core

        // Generate random wreckage using Boss logic
        this.generate();

        this.itemsDropped = 0;
        this.maxItems = 2 + Math.floor(this.random() * 2); // 2 to 3 items max
    }

    generate() {
        // --- 1. Setup Boss-like Config ---
        const hullCount = 4 + (this.level * 2);
        const weaponCount = 2 + (this.level * 2);

        // --- 2. Categorize Parts (Copied from Boss.js) ---
        const p1x1_w = [], p1x1_h = [];
        const p1x2_w = [], p1x2_h = [];
        const p2x2_w = [], p2x2_h = [];
        const pBig = [];

        Object.keys(PartsLibrary).forEach(id => {
            if (id === 'core') return;
            const def = PartsLibrary[id];
            const w = def.width, h = def.height;
            const isWep = (def.type === 'weapon');
            const min = Math.min(w, h), max = Math.max(w, h);

            if (w === 1 && h === 1) {
                if (isWep) p1x1_w.push(id); else p1x1_h.push(id);
            } else if (min === 1 && max === 2) {
                if (isWep) p1x2_w.push(id); else p1x2_h.push(id);
            } else if (w === 2 && h === 2) {
                if (isWep) p2x2_w.push(id); else p2x2_h.push(id);
            } else {
                pBig.push(id);
            }
        });

        // --- 3. Build "Deck" & Limits ---
        const deck = [];
        let fillPool = [];

        const pushDeck = (list, count) => {
            for (let i = 0; i < count; i++) {
                if (list.length > 0) deck.push(list[Math.floor(this.random() * list.length)]);
            }
        };

        if (this.level === 1) {
            fillPool = [...p1x1_w, ...p1x1_h];
        } else if (this.level === 2) {
            pushDeck(p1x2_w, 2);
            fillPool = [...p1x1_w, ...p1x1_h, ...p1x2_h];
        } else if (this.level === 3) {
            pushDeck(p2x2_w, 2);
            pushDeck(p1x2_w, 2);
            fillPool = [...p1x1_w, ...p1x1_h, ...p1x2_h, ...p2x2_h];
        } else {
            pushDeck(p2x2_w, 2);
            pushDeck(p1x2_w, 2);
            fillPool = [...p1x1_w, ...p1x1_h, ...p1x2_w, ...p1x2_h, ...p2x2_w, ...p2x2_h, ...pBig];
        }

        // --- 4. Generation Loop ---
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const occupied = new Set(['0,0']);
        const availableSlots = new Set();
        directions.forEach(d => { if (d[0] >= 0) availableSlots.add(`${d[0]},${d[1]}`); });

        let partsToPlace = hullCount + weaponCount;

        const limits = { '1x2_hull': 2, '2x2_hull': 2 };
        const counts = { '1x2_hull': 0, '2x2_hull': 0 };

        let attempts = 0;
        const MAX_ATTEMPTS = 5000;
        const tempParts = [];

        // Add Core first
        tempParts.push({ x: 0, y: 0, partId: 'core', rotation: 0 });

        while (partsToPlace > 0 && availableSlots.size > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;

            let partId = null;
            let fromDeck = false;

            if (deck.length > 0) {
                partId = deck[0];
                fromDeck = true;
            } else {
                if (fillPool.length === 0) fillPool = [...p1x1_h];
                partId = fillPool[Math.floor(this.random() * fillPool.length)];
            }

            const def = PartsLibrary[partId];
            if (!def) continue;

            const wRaw = def.width, hRaw = def.height;
            const sizeKey = `${Math.min(wRaw, hRaw)}x${Math.max(wRaw, hRaw)}`;
            const typeKey = def.type === 'weapon' ? 'weap' : 'hull';
            const limitKey = `${sizeKey}_${typeKey}`;

            if (!fromDeck) {
                if (this.level < 4) {
                    if (counts[limitKey] >= limits[limitKey]) {
                        attempts--;
                        partId = this.random() < 0.5 ?
                            (p1x1_w.length ? p1x1_w[Math.floor(this.random() * p1x1_w.length)] : 'hull') :
                            (p1x1_h.length ? p1x1_h[Math.floor(this.random() * p1x1_h.length)] : 'hull');
                    }
                }
            }

            const slots = Array.from(availableSlots);
            const key = slots[Math.floor(this.random() * slots.length)];
            const [qx, qy] = key.split(',').map(Number);

            let rot = 3;
            if (qx !== 0) rot = Math.floor(this.random() * 4);
            const isRotated = (rot % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            let placed = false;
            let anchorX = qx, anchorY = qy;

            if (qx === 0) { // Spine
                if (w % 2 !== 0) {
                    const offset = (w - 1) / 2;
                    anchorX = qx - offset;
                    let clear = true;
                    const cells = [];
                    for (let ix = 0; ix < w; ix++) {
                        for (let iy = 0; iy < h; iy++) {
                            const cx = anchorX + ix, cy = anchorY + iy;
                            if (occupied.has(`${cx},${cy}`)) { clear = false; break; }
                            cells.push(`${cx},${cy}`);
                        }
                        if (!clear) break;
                    }

                    if (clear) {
                        tempParts.push({ x: anchorX, y: anchorY, partId, rotation: rot });
                        cells.forEach(k => occupied.add(k));
                        cells.forEach(k => {
                            const [cx, cy] = k.split(',').map(Number);
                            directions.forEach(d => {
                                const nx = cx + d[0], ny = cy + d[1];
                                if (nx >= 0 && !occupied.has(`${nx},${ny}`)) availableSlots.add(`${nx},${ny}`);
                            });
                        });
                        availableSlots.delete(key);
                        partsToPlace--;
                        placed = true;
                        if (fromDeck) deck.shift();
                        if (counts[limitKey] !== undefined) counts[limitKey]++;
                    }
                }
            } else { // Side
                let mainClear = true;
                const mainCells = [];
                for (let ix = 0; ix < w; ix++) {
                    for (let iy = 0; iy < h; iy++) {
                        const cx = anchorX + ix, cy = anchorY + iy;
                        if (occupied.has(`${cx},${cy}`)) { mainClear = false; break; }
                        mainCells.push(`${cx},${cy}`);
                    }
                    if (!mainClear) break;
                }

                const mirrorAnchorX = -(anchorX + w - 1);
                const mirrorAnchorY = anchorY;
                const mirrorRot = (rot === 0) ? 2 : ((rot === 2) ? 0 : rot);
                let mirrorClear = true;
                const mirrorCells = [];
                if (mainClear) {
                    for (let ix = 0; ix < w; ix++) {
                        for (let iy = 0; iy < h; iy++) {
                            const cx = mirrorAnchorX + ix, cy = mirrorAnchorY + iy;
                            if (occupied.has(`${cx},${cy}`)) { mirrorClear = false; break; }
                            mirrorCells.push(`${cx},${cy}`);
                        }
                        if (!mirrorClear) break;
                    }
                }

                if (mainClear && mirrorClear) {
                    tempParts.push({ x: anchorX, y: anchorY, partId, rotation: rot });
                    tempParts.push({ x: mirrorAnchorX, y: mirrorAnchorY, partId, rotation: mirrorRot });
                    [...mainCells, ...mirrorCells].forEach(k => occupied.add(k));
                    mainCells.forEach(k => {
                        const [cx, cy] = k.split(',').map(Number);
                        directions.forEach(d => {
                            const nx = cx + d[0], ny = cy + d[1];
                            if (nx >= 0 && !occupied.has(`${nx},${ny}`)) availableSlots.add(`${nx},${ny}`);
                        });
                    });
                    availableSlots.delete(key);
                    partsToPlace -= 2;
                    placed = true;
                    if (fromDeck) deck.shift();
                    if (counts[limitKey] !== undefined) counts[limitKey] += 2;
                }
            }
            if (!placed && w === 1 && h === 1) availableSlots.delete(key);
        }

        // --- 5. Apply Decay (Post-Process) ---
        let keptCount = 0;

        tempParts.forEach(p => {
            // Always keep core
            if (p.partId === 'core') {
                this.ship.addPart(p.x, p.y, p.partId, p.rotation);
                // Core HP
                const part = this.ship.getPart(p.x, p.y);
                if (part) { part.hp = 20; part.maxHp = 20; }
                keptCount++;
            } else {
                // Decay Chance: 15% chance to be missing to look like a wreck
                if (this.random() > 0.15) {
                    if (this.ship.addPart(p.x, p.y, p.partId, p.rotation)) {
                        const part = this.ship.getPart(p.x, p.y);
                        if (part) {
                            const d = PartsLibrary[p.partId];
                            part.maxHp = (d.stats.hp || 10) * 0.5; // Weak HP
                            part.hp = part.maxHp;
                        }
                        keptCount++;
                    }
                }
            }
        });

        // Ensure at least some wreck exists if decay was too aggressive
        if (keptCount < 2) {
            const fallback = ['hull', 'hull', 'hull'];
            fallback.forEach(id => {
                this.ship.addPart(Math.floor(this.random() * 3) - 1, Math.floor(this.random() * 3) - 1, id, 0);
            });
        }
    }

    takeDamage(amount, worldX, worldY, roomCleared = false) {
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
            // One-shot if room is cleared
            if (roomCleared) {
                part.hp = 0;
            } else {
                part.hp -= amount;
            }
            if (part.hp <= 0) {
                // Destroy part
                const partId = part.partId;

                // Use manual remove to allow destroying 0,0
                this._manualRemovePart(gx, gy);

                // Return drop info
                let dropItem = false;

                // 30% chance to drop, if under max limit
                if (this.random() < 0.3 && this.itemsDropped < this.maxItems) {
                    dropItem = true;
                    this.itemsDropped++;
                }

                return { destroyed: true, partId: partId, x: worldX, y: worldY, shouldDrop: dropItem, randomGen: this.random };
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

        const def = PartsLibrary[part.partId];
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
            const def = PartsLibrary[part.partId];
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
