import { Room } from './Room.js';

export const RoomType = {
    NORMAL: 'normal',
    BOSS: 'boss',
    SHOP: 'shop',
    TREASURE: 'treasure',
    VAULT: 'vault'
};

// Simple seeded random number generator (mulberry32)
function seededRandom(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export class LevelGenerator {
    constructor() {
        this.rooms = [];
        this.grid = new Map(); // "x,y" -> Room
        this.seed = null;
        this.random = Math.random; // Default to Math.random
    }

    generate(count = 10, seed = null) {
        // Set up seed
        if (seed !== null) {
            this.seed = seed;
        } else {
            this.seed = Math.floor(Math.random() * 2147483647);
        }
        this.random = seededRandom(this.seed);
        console.log(`[LevelGenerator] Using seed: ${this.seed}`);

        // Reset
        this.rooms = [];
        this.grid.clear();

        // LINEAR LEVEL STRUCTURE:
        // Start -> 2-3 combat -> Shop/Treasure -> 2-3 combat -> Shop/Treasure -> 2-3 combat -> Boss

        // Define the room sequence
        const sequence = [];

        // Start room
        sequence.push({ type: 'start', size: { w: 1, h: 1 } });

        // First combat segment (2-3 rooms)
        const combatCount1 = 2 + Math.floor(this.random() * 2);
        for (let i = 0; i < combatCount1; i++) {
            sequence.push({ type: 'combat', size: this.getRandomSize() });
        }

        // First shop or treasure
        sequence.push({ type: this.random() > 0.5 ? 'shop' : 'treasure', size: { w: 1, h: 1 } });

        // Second combat segment (2-3 rooms)
        const combatCount2 = 2 + Math.floor(this.random() * 2);
        for (let i = 0; i < combatCount2; i++) {
            sequence.push({ type: 'combat', size: this.getRandomSize() });
        }

        // Second shop or treasure (opposite of first)
        const firstSpecial = sequence.find(s => s.type === 'shop' || s.type === 'treasure');
        sequence.push({ type: firstSpecial.type === 'shop' ? 'treasure' : 'shop', size: { w: 1, h: 1 } });

        // Third combat segment (2-3 rooms)
        const combatCount3 = 2 + Math.floor(this.random() * 2);
        for (let i = 0; i < combatCount3; i++) {
            sequence.push({ type: 'combat', size: this.getRandomSize() });
        }

        // Boss room at end
        sequence.push({ type: 'boss', size: { w: 1, h: 1 } });

        // Build the linear path
        let currentX = 0;
        let currentY = 0;
        let prevRoom = null;
        let hasVault = false;

        // Preferred directions: right, down, right, up (slight zigzag but mostly forward)
        const directions = ['right', 'down', 'right', 'up'];
        let dirIndex = 0;

        for (let i = 0; i < sequence.length; i++) {
            const spec = sequence[i];

            if (i === 0) {
                // Start room at origin
                const room = this.addRoom(0, 0, spec.size.w, spec.size.h);
                this.assignRoomType(room, spec.type);
                prevRoom = room;
                currentX = spec.size.w;
                currentY = 0;
            } else {
                // Find next position in the preferred direction
                let placed = false;
                let attempts = 0;

                while (!placed && attempts < 8) {
                    const dir = directions[dirIndex % directions.length];
                    let nx = currentX, ny = currentY;

                    if (dir === 'right') {
                        nx = prevRoom.gridX + prevRoom.widthUnits;
                        ny = prevRoom.gridY;
                    } else if (dir === 'left') {
                        nx = prevRoom.gridX - spec.size.w;
                        ny = prevRoom.gridY;
                    } else if (dir === 'down') {
                        nx = prevRoom.gridX;
                        ny = prevRoom.gridY + prevRoom.heightUnits;
                    } else if (dir === 'up') {
                        nx = prevRoom.gridX;
                        ny = prevRoom.gridY - spec.size.h;
                    }

                    if (this.isAreaFree(nx, ny, spec.size.w, spec.size.h)) {
                        const room = this.addRoom(nx, ny, spec.size.w, spec.size.h);
                        this.assignRoomType(room, spec.type);
                        prevRoom = room;
                        currentX = nx + spec.size.w;
                        currentY = ny;
                        placed = true;
                        dirIndex++; // Move to next preferred direction
                    } else {
                        dirIndex++; // Try next direction
                        attempts++;
                    }
                }

                // Fallback: find any free adjacent spot
                if (!placed) {
                    const fallbackDirs = [
                        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
                    ];
                    for (const fd of fallbackDirs) {
                        const nx = prevRoom.gridX + fd.dx * prevRoom.widthUnits;
                        const ny = prevRoom.gridY + fd.dy * prevRoom.heightUnits;
                        if (this.isAreaFree(nx, ny, spec.size.w, spec.size.h)) {
                            const room = this.addRoom(nx, ny, spec.size.w, spec.size.h);
                            this.assignRoomType(room, spec.type);
                            prevRoom = room;
                            placed = true;
                            break;
                        }
                    }
                }

                // Chance to add a "Side Room" (Vault) branching off a Combat room
                // Only add 1 vault max per level for now.
                if (spec.type === 'combat' && !hasVault && this.random() < 0.3) {
                    // Try to find a free adjacent single cell for the vault
                    const adjacent = [
                        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
                    ];

                    const startIdx = Math.floor(this.random() * 4);

                    for (let j = 0; j < 4; j++) {
                        const adj = adjacent[(startIdx + j) % 4];
                        let nx, ny;
                        if (adj.dx === 1) nx = prevRoom.gridX + prevRoom.widthUnits;
                        else if (adj.dx === -1) nx = prevRoom.gridX - 1;
                        else nx = prevRoom.gridX;

                        if (adj.dy === 1) ny = prevRoom.gridY + prevRoom.heightUnits;
                        else if (adj.dy === -1) ny = prevRoom.gridY - 1;
                        else ny = prevRoom.gridY;

                        if (this.isAreaFree(nx, ny, 1, 1)) {
                            const vault = this.addRoom(nx, ny, 1, 1);
                            this.assignRoomType(vault, 'vault');
                            hasVault = true;
                            break;
                        }
                    }
                }
            }
        }

        console.log(`[LevelGenerator] Created ${this.rooms.length} rooms in linear path`);
        return this.rooms;
    }

    getRandomSize() {
        const types = [
            { w: 1, h: 1 },
            { w: 1, h: 2 },
            { w: 2, h: 1 },
            { w: 2, h: 2 }
        ];
        return types[Math.floor(this.random() * types.length)];
    }

    assignRoomType(room, type) {
        if (type === 'start') {
            room.type = RoomType.NORMAL; // Start is normal but at 0,0
        } else if (type === 'combat') {
            room.type = RoomType.NORMAL;
        } else if (type === 'shop') {
            room.type = RoomType.SHOP;
        } else if (type === 'treasure') {
            room.type = RoomType.TREASURE;
        } else if (type === 'boss') {
            room.type = RoomType.BOSS;
        } else if (type === 'vault') {
            room.type = RoomType.VAULT;
        }
    }

    isAreaFree(gx, gy, w, h) {
        for (let x = gx; x < gx + w; x++) {
            for (let y = gy; y < gy + h; y++) {
                if (this.grid.has(`${x},${y} `)) return false;
            }
        }
        return true;
    }

    addRoom(gx, gy, w, h) {
        const room = new Room(gx, gy, w, h);
        room.type = RoomType.NORMAL;
        this.rooms.push(room);

        // Mark grid cells
        for (let x = gx; x < gx + w; x++) {
            for (let y = gy; y < gy + h; y++) {
                this.grid.set(`${x},${y} `, room);
            }
        }
        return room;
    }

    getRoom(gx, gy) {
        return this.grid.get(`${gx},${gy} `);
    }

    getRoomAtWorldPos(x, y) {
        const cellSize = 2000;
        const gx = Math.floor(x / cellSize);
        const gy = Math.floor(y / cellSize);
        return this.grid.get(`${gx},${gy} `);
    }
}
