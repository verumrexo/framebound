import { Enemy } from './Enemy.js';
import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { Projectile } from './Projectile.js';

export class Boss extends Enemy {
    constructor(x, y, level) {
        // Initialize as a 'boss' type enemy
        super(x, y, 'boss', level);

        this.level = level || 1;
        if (isNaN(this.level)) this.level = 1;

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
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const occupied = new Set(['0,0']);
        const availableSlots = new Set();

        // Initial slots around core (filtered to x >= 0 for symmetry)
        directions.forEach(d => {
            if (d[0] >= 0) availableSlots.add(`${d[0]},${d[1]}`);
        });

        // Use the entire parts library (excluding core)
        const allPartIds = Object.keys(PartsLibrary).filter(id => id !== 'core');

        // Total approximate parts (hulls + weapons)
        let partsToPlace = this.hullCount + this.weaponCount;
        let attempts = 0;
        const MAX_ATTEMPTS = 500;

        while (partsToPlace > 0 && availableSlots.size > 0 && attempts < MAX_ATTEMPTS) {
            attempts++;
            const slots = Array.from(availableSlots);
            const key = slots[Math.floor(Math.random() * slots.length)];
            const [qx, qy] = key.split(',').map(Number);

            // Try to place a random part here
            const partId = allPartIds[Math.floor(Math.random() * allPartIds.length)];
            const def = PartsLibrary[partId];

            // Randomize rotation for side parts, force UP (3) for spine to maintain core orientation
            let rot = 3;
            if (qx !== 0) {
                rot = Math.floor(Math.random() * 4);
            }

            // Determine dimensions based on rotation
            // Rotation 1 & 3 (Down/Up) -> Swap Width/Height
            const isRotated = (rot % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            // Placement Logic
            let placed = false;
            let anchorX = qx;
            let anchorY = qy;

            // Spine (x=0) Constraints: Must be centered, must be odd width (1, 3, etc.)
            if (qx === 0) {
                // If even width, we can't center it on integer grid logic without half-steps.
                // For simplicity, enforce width=1 on the spine, or strictly odd widths.
                // Check if w is odd
                if (w % 2 !== 0) {
                    // Center the part horizontally
                    const offset = (w - 1) / 2;
                    anchorX = qx - offset; // Shift left so qx is the center

                    // Check bounds & occupied for Main Part
                    let clear = true;
                    const cellsToFill = [];

                    for (let ix = 0; ix < w; ix++) {
                        for (let iy = 0; iy < h; iy++) {
                            const cx = anchorX + ix;
                            const cy = anchorY + iy;
                            if (occupied.has(`${cx},${cy}`)) {
                                clear = false;
                                break;
                            }
                            cellsToFill.push(`${cx},${cy}`);
                        }
                        if (!clear) break;
                    }

                    if (clear) {
                        // Place Central Part
                        this.shipParts.push({ x: anchorX, y: anchorY, partId, rotation: rot });
                        cellsToFill.forEach(k => occupied.add(k));

                        // Add new available slots around this block
                        cellsToFill.forEach(k => {
                            const [cx, cy] = k.split(',').map(Number);
                            directions.forEach(d => {
                                const nx = cx + d[0];
                                const ny = cy + d[1];
                                if (nx >= 0 && !occupied.has(`${nx},${ny}`)) {
                                    availableSlots.add(`${nx},${ny}`);
                                }
                            });
                        });

                        // Remove used key
                        availableSlots.delete(key);
                        partsToPlace--;
                        placed = true;
                    }
                }
            } else {
                // Side Placement (x > 0)
                // Anchor is qx, qy (top-left of part)
                // We MUST ensure the part stays strictly in x > 0 space to avoid spine collision?
                // Actually, if anchorX >= 1, and width >= 1, min X is 1. Safe.

                // Check Main Part
                let mainClear = true;
                const mainCells = [];
                for (let ix = 0; ix < w; ix++) {
                    for (let iy = 0; iy < h; iy++) {
                        const cx = anchorX + ix;
                        const cy = anchorY + iy;
                        if (occupied.has(`${cx},${cy}`)) {
                            mainClear = false; break;
                        }
                        mainCells.push(`${cx},${cy}`);
                    }
                    if (!mainClear) break;
                }

                // Check Mirror Part
                // Mirror Anchor: If main is at x_min...x_max, mirror is at -x_max...-x_min
                // x_max = anchorX + w - 1
                // mirror_x_min = -(anchorX + w - 1)
                const mirrorAnchorX = -(anchorX + w - 1);
                const mirrorAnchorY = anchorY;

                // Calculate Symmetric Rotation for Mirror
                // 0 (Right) <-> 2 (Left)
                // 1 (Down)  <-> 1 (Down)
                // 3 (Up)    <-> 3 (Up)
                const mirrorRot = (rot === 0) ? 2 : ((rot === 2) ? 0 : rot);

                let mirrorClear = true;
                const mirrorCells = [];
                if (mainClear) {
                    for (let ix = 0; ix < w; ix++) {
                        for (let iy = 0; iy < h; iy++) {
                            const cx = mirrorAnchorX + ix;
                            const cy = mirrorAnchorY + iy;
                            if (occupied.has(`${cx},${cy}`)) {
                                mirrorClear = false; break;
                            }
                            mirrorCells.push(`${cx},${cy}`);
                        }
                        if (!mirrorClear) break;
                    }
                }

                if (mainClear && mirrorClear) {
                    // Place Both (Symmetrically Rotated)
                    this.shipParts.push({ x: anchorX, y: anchorY, partId, rotation: rot });
                    this.shipParts.push({ x: mirrorAnchorX, y: mirrorAnchorY, partId, rotation: mirrorRot });

                    mainCells.forEach(k => occupied.add(k));
                    mirrorCells.forEach(k => occupied.add(k));

                    // Expand from main side only (keep generator focused on positive x)
                    mainCells.forEach(k => {
                        const [cx, cy] = k.split(',').map(Number);
                        directions.forEach(d => {
                            const nx = cx + d[0];
                            const ny = cy + d[1];
                            if (nx >= 0 && !occupied.has(`${nx},${ny}`)) {
                                availableSlots.add(`${nx},${ny}`);
                            }
                        });
                    });

                    availableSlots.delete(key);
                    partsToPlace -= 2;
                    placed = true;
                }
            }

            // If we failed to place, remove the key to prevent infinite retries on bad slots?
            // Or just keep it? Better to remove if it's truly blocked, but hard to know if ALL parts fail.
            // For now, if we fail, we just loop again. Random limits apply.
            if (!placed) {
                // If 1x1 part failed, the slot is likely garbage.
                if (w === 1 && h === 1) {
                    availableSlots.delete(key);
                }
            }
        }

        // Initialize weapons for the Enemy class to use
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
                    cooldown: Math.random() * (def.stats.cooldown || 2)
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
    draw(renderer) {
        // Standard Enemy Draw (Parts, Effects, and Standard HP Bar)
        super.draw(renderer);
    }
}
