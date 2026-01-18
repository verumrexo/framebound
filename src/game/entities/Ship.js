import { PartsLibrary, UserPartsLibrary } from '../parts/Part.js';

export class Ship {
    constructor() {
        this.parts = new Map(); // key: "x,y", value: PartInstance
        this.stats = {
            totalHp: 0,
            totalMass: 0,
            thrust: 0,
            accelerantCount: 0,
            regen: 0,
            laserCount: 0,
            rocketCount: 0,
            velocityCount: 0,
            rocketBayCount: 0,
            boosterCount: 0
        };

        this.hp = 0;
        this.maxHp = 0;
        this.isDead = false;

        // Always start with a Core at 0,0
        this.addPart(0, 0, 'core');
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    canPlaceAt(x, y, partId, rotation = 0) {
        const def = PartsLibrary[partId] || UserPartsLibrary[partId];
        if (!def) return false;

        const isRotated = (rotation % 2 !== 0);
        const w = isRotated ? def.height : def.width;
        const h = isRotated ? def.width : def.height;

        let hasCollision = false;
        let hasAdjacency = false;

        // If ship is totally empty (shouldn't happen with core), allow anything
        if (this.parts.size === 0) return true;

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                const cx = x + i;
                const cy = y + j;

                // Collision Check
                if (this.parts.has(`${cx},${cy}`)) {
                    hasCollision = true;
                }

                // Adjacency Check (Up, Down, Left, Right)
                if (
                    this.parts.has(`${cx + 1},${cy}`) ||
                    this.parts.has(`${cx - 1},${cy}`) ||
                    this.parts.has(`${cx},${cy + 1}`) ||
                    this.parts.has(`${cx},${cy - 1}`)
                ) {
                    hasAdjacency = true;
                }
            }
        }

        return !hasCollision && hasAdjacency;
    }

    addPart(x, y, partId, rotation = 0) {
        // Core exception: Always allow (since it's the first part)
        const isCore = (x === 0 && y === 0);

        if (!isCore && !this.canPlaceAt(x, y, partId, rotation)) {
            return false;
        }

        const def = PartsLibrary[partId] || UserPartsLibrary[partId];
        const isRotated = (rotation % 2 !== 0);
        const w = isRotated ? def.height : def.width;
        const h = isRotated ? def.width : def.height;

        // Create Instance
        const partInstance = {
            x, y,
            partId: partId,
            rotation: rotation
        };

        // Occupy all cells
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                this.parts.set(`${x + i},${y + j}`, partInstance);
            }
        }

        this.recalculateStats();
        return true;
    }

    removePart(x, y) {
        if (x === 0 && y === 0) return; // Cannot remove core

        const key = `${x},${y}`;
        if (!this.parts.has(key)) return;

        const part = this.parts.get(key);
        const originX = part.x;
        const originY = part.y;

        const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];
        if (!def) {
            this.parts.delete(key);
            return;
        }

        const isRotated = ((part.rotation || 0) % 2 !== 0);
        const w = isRotated ? def.height : def.width;
        const h = isRotated ? def.width : def.height;

        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                this.parts.delete(`${originX + i},${originY + j}`);
            }
        }

        this.recalculateStats();
    }

    getPart(x, y) {
        return this.parts.get(`${x},${y}`);
    }

    getUniqueParts() {
        // Returns an iterator of unique part instances
        return new Set(this.parts.values());
    }

    clone() {
        // Create new ship
        const newShip = new Ship();
        // Clear default core (optional, but addPart handles collision if we overwrite)
        // Actually addPart collision check prevents overwriting 0,0 Core.
        // So we should clear parts first or just rely on addPart logic.
        newShip.parts.clear();

        this.getUniqueParts().forEach(p => {
            newShip.addPart(p.x, p.y, p.partId, p.rotation);
        });

        // Preserve HP and state
        newShip.hp = this.hp;
        newShip.isDead = this.isDead;

        return newShip;
    }

    recalculateStats() {
        this.stats.totalHp = 0;
        this.stats.totalMass = 0;
        this.stats.thrust = 0;
        this.stats.accelerantCount = 0;
        this.stats.regen = 1.0; // Base regeneration
        this.stats.laserCount = 0;
        this.stats.rocketCount = 0;
        this.stats.velocityCount = 0;
        this.stats.rocketBayCount = 0;
        this.stats.turnSpeed = 0; // Initialize turnSpeed

        for (const part of this.getUniqueParts()) {
            const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];
            if (def) {
                this.stats.totalHp += def.stats.hp || 0;
                this.stats.totalMass += def.stats.mass || 0;
                this.stats.turnSpeed += def.stats.turnSpeed || 0;

                // Explicit thrust stat (from any part type)
                if (def.stats.thrust) {
                    this.stats.thrust += def.stats.thrust;
                }

                // If it's a thruster, count each block (Legacy / Type-based)
                if (def.type === 'thruster') {
                    this.stats.thrust += (def.width * def.height);
                }

                if (def.type === 'accelerant') {
                    this.stats.accelerantCount += (def.width * def.height);
                }

                if (def.type === 'rocket_bay') {
                    this.stats.rocketBayCount += (def.width * def.height);
                }

                if (def.type === 'booster') {
                    this.stats.boosterCount += 1;
                }

                if (def.stats.regen) {
                    this.stats.regen += def.stats.regen;
                }

                if (def.type === 'weapon' && def.stats.weaponGroup) {
                    const groupKey = `${def.stats.weaponGroup}Count`;
                    this.stats[groupKey] += (def.width * def.height);
                }
            }
        }

        this.maxHp = this.stats.totalHp;
        if (this.hp === 0 && !this.isDead) {
            this.hp = this.maxHp;
        }
    }
}
