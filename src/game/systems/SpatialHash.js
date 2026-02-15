export class SpatialHash {
    constructor(cellSize = 200) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    add(entity) {
        const r = entity.radius || 20; // Default radius fallback
        const minX = Math.floor((entity.x - r) / this.cellSize);
        const maxX = Math.floor((entity.x + r) / this.cellSize);
        const minY = Math.floor((entity.y - r) / this.cellSize);
        const maxY = Math.floor((entity.y + r) / this.cellSize);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const key = `${x},${y}`;
                let cell = this.grid.get(key);
                if (!cell) {
                    cell = [];
                    this.grid.set(key, cell);
                }
                cell.push(entity);
            }
        }
    }

    query(x, y, radius) {
        const minX = Math.floor((x - radius) / this.cellSize);
        const maxX = Math.floor((x + radius) / this.cellSize);
        const minY = Math.floor((y - radius) / this.cellSize);
        const maxY = Math.floor((y + radius) / this.cellSize);

        const result = new Set();

        for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
                const key = `${cx},${cy}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        result.add(cell[i]);
                    }
                }
            }
        }
        return result;
    }

    queryAABB(minX, minY, maxX, maxY) {
        const startX = Math.floor(minX / this.cellSize);
        const endX = Math.floor(maxX / this.cellSize);
        const startY = Math.floor(minY / this.cellSize);
        const endY = Math.floor(maxY / this.cellSize);

        const result = new Set();

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const key = `${x},${y}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        result.add(cell[i]);
                    }
                }
            }
        }
        return result;
    }

    clear() {
        this.grid.clear();
    }
}
