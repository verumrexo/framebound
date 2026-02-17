import { Enemy } from './Enemy.js';
import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { Projectile } from './Projectile.js';

export class Boss extends Enemy {
    constructor(x, y, level, randomGen = null) {
        // Initialize as a 'boss' type enemy
        super(x, y, 'boss', level, randomGen);

        this.level = level || 1;
        if (isNaN(this.level)) this.level = 1;

        // random is inherited from Enemy! 🙄💅

        // Custom Boss Properties
        this.hullCount = 4 + (this.level * 2);
        this.weaponCount = 2 + (this.level * 2);

        // Clear default enemy parts and generate boss
        this.shipParts = [];
        this.shipParts.push({ x: 0, y: 0, partId: 'core', rotation: 0 });
        this.generate();

        // Recalculate stats based on new parts
        this.recalculateStats();

        // Boss Stats Override
        this.hp = this.stats.totalHp * 2;
        this.maxHp = this.hp;
        if (isNaN(this.maxHp)) this.maxHp = 1000;

        this.radius = Math.sqrt(this.shipParts.length) * TILE_SIZE;

        // AI Overrides
        this.engagementDist = 800;
        this.turnRate = 1.0; // Slower turn for massive boss
        this.speed = 60; // Slower movement
        this.detectionDist = 2000; // Always aware
        this.rotationOffset = Math.PI / 2; // Face forward along symmetry axis
    }

    generate() {
        // --- 1. Categorize Parts ---
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

        // Blacklist Sniper on Floors 1-2
        if (this.level < 3) {
            const sniperId = 'custom_1768857172136';
            const idx = p1x2_w.indexOf(sniperId);
            if (idx > -1) p1x2_w.splice(idx, 1);
        }

        // --- 2. Build "Deck" (Mandatory Parts) & Limits ---
        const deck = []; // List of part IDs to force-place first
        let fillPool = []; // List of part IDs to use for filling rest

        // Helper to add N random items from list to deck
        const pushDeck = (list, count) => {
            for (let i = 0; i < count; i++) {
                if (list.length > 0) deck.push(list[Math.floor(this.random() * list.length)]);
            }
        };

        // Floor Rules
        if (this.level === 1) {
            // F1: 1x1 Only
            fillPool = [...p1x1_w, ...p1x1_h];
        } else if (this.level === 2) {
            // F2: Must have 2x [1x2 Weap]. Can have 2x [1x2 Hull]. No 2x2.
            pushDeck(p1x2_w, 2);
            // "Can have" means they are in the pool, but maybe we limit them?
            // User: "CAN have 2 medium hulls... every other part should be 1x1" -> Strict limit logic needed?
            // Implementation: Put all allowed parts in pool, check limits during pick.
            fillPool = [...p1x1_w, ...p1x1_h, ...p1x2_h]; // Note: p1x2_w NOT in pool, only deck? Or allows more? 
            // "ONLY 2 1x2 weapons" -> So don't add to pool.
        } else if (this.level === 3) {
            // F3: Must 2x [2x2 Weap], 2x [1x2 Weap]. Can [2x2 Hull], [1x2 Hull].
            pushDeck(p2x2_w, 2); // Priority (Big first)
            pushDeck(p1x2_w, 2);

            fillPool = [...p1x1_w, ...p1x1_h, ...p1x2_h, ...p2x2_h];
        } else {
            // F4+: Like F3, but random allowed
            pushDeck(p2x2_w, 2);
            pushDeck(p1x2_w, 2);
            // All parts allowed in pool
            fillPool = [...p1x1_w, ...p1x1_h, ...p1x2_w, ...p1x2_h, ...p2x2_w, ...p2x2_h, ...pBig];
        }

        // --- 3. Generation Loop ---
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const occupied = new Set(['0,0']);
        const availableSlots = new Set();
        directions.forEach(d => { if (d[0] >= 0) availableSlots.add(`${d[0]},${d[1]}`); });

        let partsToPlace = this.hullCount + this.weaponCount;

        // Limits state
        const limits = {
            '1x2_hull': 2,
            '2x2_hull': 2
        };
        const counts = {
            '1x2_hull': 0,
            '2x2_hull': 0
        };

        let attempts = 0;
        const MAX_ATTEMPTS = 500;

        while (partsToPlace > 0 && availableSlots.size > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;

            let partId = null;
            let fromDeck = false;

            // Strategy: Try Deck First
            if (deck.length > 0) {
                partId = deck[0]; // Peek
                fromDeck = true;
            } else {
                // Random Fill
                if (fillPool.length === 0) fillPool = [...p1x1_h]; // Fallback safety
                partId = fillPool[Math.floor(this.random() * fillPool.length)];
            }

            const def = PartsLibrary[partId];
            const wRaw = def.width, hRaw = def.height;
            const sizeKey = `${Math.min(wRaw, hRaw)}x${Math.max(wRaw, hRaw)}`;
            const typeKey = def.type === 'weapon' ? 'weap' : 'hull';
            const limitKey = `${sizeKey}_${typeKey}`; // e.g. "1x2_hull"

            // Check Limits (Skip check for Deck items - they represent the mandate)
            if (!fromDeck) {
                if (this.level < 4) { // Limits apply F1-F3
                    if (counts[limitKey] >= limits[limitKey]) {
                        // Limit reached, try again (should filter pool really, but retry works with attempts)
                        attempts--; // Don't burn attempt on limit check logic if mostly valid
                        // Actually, just pick a 1x1 part instead to ensure progress
                        partId = this.random() < 0.5 ?
                            (p1x1_w.length ? p1x1_w[Math.floor(this.random() * p1x1_w.length)] : 'hull') :
                            (p1x1_h.length ? p1x1_h[Math.floor(this.random() * p1x1_h.length)] : 'hull');
                    }
                }
            }

            // Pick a Slot
            const slots = Array.from(availableSlots);
            // Optimization: If placing Big part, maybe prioritize slots further out?
            // Current: Uniform random slot.
            const key = slots[Math.floor(this.random() * slots.length)];
            const [qx, qy] = key.split(',').map(Number);

            // Rotation Logic
            let rot = 3;
            if (qx !== 0) rot = Math.floor(this.random() * 4);
            const isRotated = (rot % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            // Placement Check
            let placed = false;
            let anchorX = qx, anchorY = qy;

            if (qx === 0) { // Spine
                if (w % 2 !== 0) { // Must be odd width to center
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
                        this.shipParts.push({ x: anchorX, y: anchorY, partId, rotation: rot });
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

                        // Update State
                        if (fromDeck) deck.shift(); // Remove from deck
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

                // Mirror
                const mirrorAnchorX = -(anchorX + w - 1);
                const mirrorAnchorY = anchorY;
                const mirrorRot = (rot === 0) ? 2 : ((rot === 2) ? 0 : rot);
                let mirrorClear = true;
                const mirrorCells = [];
                if (mainClear) {
                    for (let ix = 0; ix < w; ix++) {
                        for (let iy = 0; iy < h; iy++) {
                            const cx = mirrorAnchorX + ix, cy = mirrorAnchorY + iy; // mirrorAnchorY usually same
                            if (occupied.has(`${cx},${cy}`)) { mirrorClear = false; break; }
                            mirrorCells.push(`${cx},${cy}`);
                        }
                        if (!mirrorClear) break;
                    }
                }

                if (mainClear && mirrorClear) {
                    this.shipParts.push({ x: anchorX, y: anchorY, partId, rotation: rot });
                    this.shipParts.push({ x: mirrorAnchorX, y: anchorY, partId, rotation: mirrorRot }); // Corrected mirrorAnchorY usage

                    [...mainCells, ...mirrorCells].forEach(k => occupied.add(k));

                    // Grow from Main side
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
                    if (counts[limitKey] !== undefined) counts[limitKey] += 2; // Count both
                }
            }

            if (!placed) {
                // If deck placement failed, we MUST make space.
                // Place a 1x1 Hull filler to expand the boundary?
                if (fromDeck) {
                    // Temporarily skip Deck, try placing a 1x1 hull to open slots
                    // But don't remove from deck
                    const fillerId = p1x1_h.length ? p1x1_h[Math.floor(this.random() * p1x1_h.length)] : 'hull';
                    // We'll let the next loop iteration handle it by effectively 'ignoring' the deck for one turn?
                    // OR: Recursively force a 1x1 placement now?
                    // Simpler: Just allow the loop to retry.
                    // If we consistently fail to place a Big part (Deck), maybe the slots are bad.
                    // If we fail specifically, availableSlots.delete(key) happens below for 1x1.
                    // For Big parts, maybe we keep the key?
                }

                if (w === 1 && h === 1) {
                    availableSlots.delete(key); // 1x1 failed -> Slot useless
                }
            }
        }

        this.initializeWeapons();
    }

    // Helper to calc stats from parts
    recalculateStats() {
        this.stats = { totalHp: 0 };
        for (const p of this.shipParts) {
            const def = PartsLibrary[p.partId];
            if (def) {
                this.stats.totalHp += def.stats.hp || 10;
            }
        }
    }

    initializeWeapons() {
        this.weaponCooldowns = [];
        this.activeBursts = [];
        for (const part of this.shipParts) {
            const def = PartsLibrary[part.partId];
            if (def && def.type === 'weapon') {
                this.weaponCooldowns.push({
                    part: part,
                    def: def,
                    cooldown: this.random() * (def.stats.cooldown || 2),
                    chargeTimer: 0,
                    lockedAngle: null
                });
            }
        }
    }

    // Override Update to add any Boss-Specific Logic (e.g. phases)
    update(dt, playerX, playerY, projectiles, ...args) {
        // Standard Enemy behavior (Movement, Shooting)
        super.update(dt, playerX, playerY, projectiles, ...args);

        // Add minimal wobble for "alive" feel
        this.rotation += Math.sin(Date.now() * 0.001) * 0.001;
    }

    // Override Draw to add HP Bar
}
