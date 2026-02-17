// benchmarks/collision_benchmark.js

const TILE_SIZE = 28;

class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.isDead = false;
        this.id = Math.random().toString(36).substr(2, 9);
    }
}

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 20);
        this.type = 'striker';
        this.hp = 100;
        this.shipParts = [];
        for(let i=0; i<5; i++) {
            this.shipParts.push({x: i, y: 0});
        }
    }
    checkShieldHit(x, y) { return { hit: false }; }
    checkPartHit(x, y, r) {
        for(const part of this.shipParts) {
             const px = this.x + part.x * 10;
             const py = this.y + part.y * 10;
             const distSq = (px-x)**2 + (py-y)**2;
             if(distSq < (10+r)**2) return { hit: true };
        }
        const dx = this.x - x;
        const dy = this.y - y;
        return { hit: (dx*dx + dy*dy) < (this.radius+r)**2 };
    }
    takeDamage(dmg) {}
}

class Boss extends Entity {
    constructor(x, y) {
        super(x, y, 60);
        this.type = 'boss';
        this.hp = 1000;
        this.shipParts = [];
    }
    checkShieldHit(x, y) { return { hit: false }; }
    checkPartHit(x, y, r) {
        const dx = this.x - x;
        const dy = this.y - y;
        return { hit: (dx*dx + dy*dy) < (this.radius+r)**2 };
    }
    takeDamage(dmg) {}
}

class Projectile extends Entity {
    constructor(x, y, angle, type) {
        super(x, y, 4); // Radius 4
        this.angle = angle;
        this.type = type;
        this.damage = 10;
        this.owner = 'player';
        this.isBeam = (type === 'railgun');
        this.beamLength = this.isBeam ? 1000 : 0;
        this.targetHits = new Map();
    }
    update(dt) {
        this.x += Math.cos(this.angle) * 600 * dt;
        this.y += Math.sin(this.angle) * 600 * dt;
    }
}

class SpatialHash {
    constructor(cellSize = 200) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    add(entity) {
        const r = entity.radius || 20;
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

class Game {
    constructor() {
        this.enemies = [];
        this.bosses = [];
        this.projectiles = [];
        this.spatialHash = new SpatialHash(200);
    }

    updateProjectiles(dt) {
        // Rebuild
        this.spatialHash.clear();
        for (const enemy of this.enemies) this.spatialHash.add(enemy);
        for (const boss of this.bosses) this.spatialHash.add(boss);

        let checks = 0;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);

            let candidates;
            if (p.isBeam) {
                const bx = p.x + Math.cos(p.angle) * p.beamLength;
                const by = p.y + Math.sin(p.angle) * p.beamLength;
                const minX = Math.min(p.x, bx) - 50;
                const maxX = Math.max(p.x, bx) + 50;
                const minY = Math.min(p.y, by) - 50;
                const maxY = Math.max(p.y, by) + 50;
                candidates = this.spatialHash.queryAABB(minX, minY, maxX, maxY);
            } else {
                candidates = this.spatialHash.query(p.x, p.y, p.radius || 4);
            }

            if (p.owner === 'player') {
                if (!p.isVisualOnly) {
                    for(const entity of candidates) {
                        checks++; // Count candidate checks
                        if (entity instanceof Enemy) {
                            if (entity.isDead) continue;
                            const enemy = entity;
                            if (!p.isBeam) {
                                const hitResult = enemy.checkPartHit(p.x, p.y, p.radius || 4);
                                if (hitResult.hit) {
                                    enemy.takeDamage(p.damage);
                                    p.isDead = true;
                                }
                            }
                        } else if (entity instanceof Boss) {
                            // In this simple benchmark, Boss extends Enemy so it's caught above?
                            // No, in my benchmark Boss extends Entity.
                            // Ah wait, in Game.js Boss extends Enemy.
                            // In benchmark I defined Boss extends Entity.
                            // So I need to check both if they are distinct classes.
                            if (entity.isDead) continue;
                            const boss = entity;
                            if (!p.isBeam) {
                                const hitResult = boss.checkPartHit(p.x, p.y, p.radius || 4);
                                if (hitResult.hit) {
                                    boss.takeDamage(p.damage);
                                    p.isDead = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        return checks;
    }
}

function runBenchmark() {
    const game = new Game();
    const WORLD_SIZE = 4000;

    for(let i=0; i<2000; i++) {
        game.enemies.push(new Enemy(Math.random()*WORLD_SIZE, Math.random()*WORLD_SIZE));
    }
    for(let i=0; i<10; i++) {
        game.bosses.push(new Boss(Math.random()*WORLD_SIZE, Math.random()*WORLD_SIZE));
    }
    for(let i=0; i<1000; i++) {
        game.projectiles.push(new Projectile(Math.random()*WORLD_SIZE, Math.random()*WORLD_SIZE, Math.random()*Math.PI*2, 'bullet'));
    }

    console.log(`Setup: ${game.enemies.length} Enemies, ${game.bosses.length} Bosses, ${game.projectiles.length} Projectiles`);

    // Warmup
    for(let i=0; i<10; i++) game.updateProjectiles(0.016);

    const iterations = 100;
    const start = performance.now();
    let totalChecks = 0;

    for(let i=0; i<iterations; i++) {
        for(const p of game.projectiles) p.isDead = false;
        totalChecks += game.updateProjectiles(0.016);
    }

    const end = performance.now();
    const duration = end - start;
    const fps = (iterations / duration) * 1000;

    console.log(`Benchmark Result (Spatial Hash):`);
    console.log(`Time: ${duration.toFixed(2)}ms for ${iterations} frames`);
    console.log(`Avg Frame Time: ${(duration/iterations).toFixed(3)}ms`);
    console.log(`Estimated FPS: ${fps.toFixed(1)}`);
    console.log(`Total Candidate Checks: ${totalChecks}`);
}

runBenchmark();
