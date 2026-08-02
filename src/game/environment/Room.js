import { Enemy } from '../../shared/entities/Enemy.js';
import { Boss } from '../../shared/entities/Boss.js';
import { Asteroid } from '../../shared/entities/Asteroid.js';
import { LootCrate } from '../../shared/entities/LootCrate.js';
import { Shipwreck } from '../../shared/entities/Shipwreck.js';
import { ShopItem } from '../../shared/entities/ShopItem.js';
import { TreasureChest } from '../../shared/entities/TreasureChest.js';
import { VaultChest } from '../../shared/entities/VaultChest.js';
import { PartsLibrary } from '../../shared/parts/Part.js';
import { RoomType } from './RoomType.js';

export class Room {
    constructor(gridX, gridY, widthUnits, heightUnits, randomGen = null) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.widthUnits = widthUnits; // 1 or 2
        this.heightUnits = heightUnits; // 1 or 2
        this.random = randomGen || Math.random;

        // World coordinates
        this.unitSize = 2000;
        this.x = gridX * this.unitSize;
        this.y = gridY * this.unitSize;
        this.width = widthUnits * this.unitSize;
        this.height = heightUnits * this.unitSize;

        this.enemies = []; // Stores generated enemy instances
        this.asteroids = [];
        this.lootCrates = [];
        this.shipwrecks = [];
        this.xpOrbs = [];
        this.goldOrbs = [];
        this.hpOrbs = [];
        this.itemPickups = [];
        this.locked = false;
        this.visited = false;
        this.cleared = false;
        this.waveTimer = null;

        // Shop room properties
        this.shopItems = null; // Will be generated on first visit
        this.treasureChests = null;
        this.vaultChests = null;
        this.shopUsed = false; // True after player buys something

        // Connections (doors) - to be set by generator
        this.connections = {
            top: false,
            bottom: false,
            left: false,
            right: false
        };
    }

    // Check if a point is inside this room
    contains(x, y) {
        return x >= this.x && x < this.x + this.width &&
            y >= this.y && y < this.y + this.height;
    }

    onEnter(game) {
        this.activate(game);

        if (!this.visited) {
            this.visited = true;

            // Shop rooms: no enemies, just generate shop items
            if (this.type === RoomType.SHOP) {
                this.generateShopItems(game);
                this.cleared = true; // No combat needed
                return;
            }

            // Treasure rooms: no enemies, spawn treasure chests
            if (this.type === RoomType.TREASURE) {
                this.spawnTreasureChests(game);
                this.cleared = true; // No combat needed
                return;
            }

            // Vault rooms: spawn vault chests (Gold/HP options)
            if (this.type === RoomType.VAULT) {
                this.spawnVaultChests(game);
                this.cleared = true; // Initially cleared until chest is triggered
                return;
            }

            // Spawn Enemies if not start room (0,0)
            if (this.gridX !== 0 || this.gridY !== 0) {
                const asteroidCount = this.spawnAsteroids(game);
                this.spawnLootCrates(game, asteroidCount);
                this.spawnShipwrecks(game);
                this.spawnEnemies(game);
                this.locked = true;
                this.cleared = false;
            } else {
                this.cleared = true;
                this.locked = false; // Start room is never locked
            }
        }
    }

    activate(game) {
        game.asteroids = this.asteroids;
        game.lootCrates = this.lootCrates;
        game.shipwrecks = this.shipwrecks;
        game.xpOrbs = this.xpOrbs;
        game.goldOrbs = this.goldOrbs;
        game.hpOrbs = this.hpOrbs;
        game.itemPickups = this.itemPickups;
        game.shopItems = this.shopItems || [];
        game.treasureChests = this.treasureChests || [];
        game.vaultChests = this.vaultChests || [];
    }

    deactivate(game) {
        this.asteroids = [...(game.asteroids || [])];
        this.lootCrates = [...(game.lootCrates || [])];
        this.shipwrecks = [...(game.shipwrecks || [])];
        this.xpOrbs = [...(game.xpOrbs || [])];
        this.goldOrbs = [...(game.goldOrbs || [])];
        this.hpOrbs = [...(game.hpOrbs || [])];
        this.itemPickups = [...(game.itemPickups || [])];
        this.shopItems = [...(game.shopItems || [])];
        this.treasureChests = [...(game.treasureChests || [])];
        this.vaultChests = [...(game.vaultChests || [])];
    }

    generateShopItems(game) {
        if (this.shopItems) return; // Already generated

        const allParts = [];
        for (const id of Object.keys(PartsLibrary)) {
            if (id !== 'core') {
                allParts.push({ id, def: PartsLibrary[id] });
            }
        }

        // Shuffle and pick 3 random parts
        for (let i = allParts.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [allParts[i], allParts[j]] = [allParts[j], allParts[i]];
        }

        const selectedParts = allParts.slice(0, 3);

        const itemDatas = [
            {
                type: 'heal',
                name: 'Repair Kit',
                description: 'Restore 50 HP',
                price: 30
            },
            ...selectedParts.map(part => ({
                type: 'part',
                name: part.def.name || part.id,
                partId: part.id,
                description: part.def.type || 'Part',
                price: Math.floor(
                    (part.def.stats?.hp || 10) * 2 +
                    (part.def.stats?.mass || 1) * 5
                )
            }))
        ];

        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const spacing = 120;
        const startX =
            centerX - ((itemDatas.length - 1) * spacing) / 2;

        this.shopItems = [];
        game.shopItems = this.shopItems;
        for (let i = 0; i < itemDatas.length; i++) {
            const item = new ShopItem(
                startX + i * spacing,
                centerY,
                itemDatas[i]
            );
            this.shopItems.push(item);
        }
    }

    spawnTreasureChests(game) {
        if (this.treasureChests) return; // Already spawned

        const chestCount = 1 + Math.floor(this.random() * 2);
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const spacing = 150;
        const startX = centerX - ((chestCount - 1) * spacing) / 2;

        this.treasureChests = [];
        game.treasureChests = this.treasureChests;
        for (let i = 0; i < chestCount; i++) {
            const chest = new TreasureChest(
                startX + i * spacing,
                centerY,
                this.random
            );
            this.treasureChests.push(chest);
        }
    }

    spawnVaultChests(game) {
        if (this.vaultChests) return;

        const floor = game.floor || 1;
        // Cost Scaling: 1.5x per floor
        // Floor 1: 100
        // Floor 2: 150
        // Floor 3: 225
        const costMultiplier = Math.pow(1.5, floor - 1);

        const goldCost = Math.floor(100 * costMultiplier);
        const hpCost = Math.floor(50 * costMultiplier);

        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const spacing = 200;

        this.vaultChests = [];
        game.vaultChests = this.vaultChests;

        const goldChest = new VaultChest(
            centerX - spacing / 2,
            centerY,
            'gold',
            goldCost,
            this.random
        );
        this.vaultChests.push(goldChest);

        const hpChest = new VaultChest(
            centerX + spacing / 2,
            centerY,
            'hp',
            hpCost,
            this.random
        );
        this.vaultChests.push(hpChest);
    }

    startAmbush(game) {
        if (this.ambushStarted) return;
        this.ambushStarted = true;
        this.locked = true;
        this.cleared = false;
        this.waveCount = 0;
        this.maxWaves = 3;
        this.spawnWave(game);

        // Lock chests
        if (this.vaultChests) {
            this.vaultChests.forEach(c => {
                c.ambushActive = true;
                c.locked = true;
            });
        }

        game.showNotification("AMBUSH TRIGGERED! SURVIVE!", '#ff0000');
    }

    spawnWave(game) {
        this.waveWaiting = false;
        this.waveCount++;
        game.showNotification(`WAVE ${this.waveCount}/${this.maxWaves}`, '#ff8800');

        const floor = game.floor || 1;

        // Spawn 3-5 enemies around the player
        const count = 3 + this.waveCount; // Harder each wave
        for (let i = 0; i < count; i++) {
            const angle = this.random() * Math.PI * 2;
            const dist = 400 + this.random() * 200;
            const ex = game.x + Math.cos(angle) * dist;
            const ey = game.y + Math.sin(angle) * dist;

            // Constrain to room
            const roomX = Math.max(this.x + 50, Math.min(this.x + this.width - 50, ex));
            const roomY = Math.max(this.y + 50, Math.min(this.y + this.height - 50, ey));

            let type = 'basic';
            const r = this.random();

            if (floor >= 5) {
                if (r < 0.1) type = 'hive_carrier';
                else if (r < 0.2) type = 'rocketeer';
                else if (r < 0.4) type = 'sniper';
                else if (r < 0.6) type = 'circler';
                else if (r < 0.9) type = 'striker';
                else type = 'basic';
            } else if (floor >= 4) {
                if (r < 0.1) type = 'rocketeer';
                else if (r < 0.3) type = 'sniper';
                else if (r < 0.5) type = 'circler';
                else if (r < 0.8) type = 'striker';
                else type = 'basic';
            } else if (floor >= 3) {
                if (r < 0.2) type = 'sniper';
                else if (r < 0.4) type = 'circler';
                else if (r < 0.7) type = 'striker';
                else type = 'basic';
            } else if (floor >= 2) {
                if (r < 0.2) type = 'circler';
                else if (r < 0.6) type = 'striker';
                else type = 'basic';
            } else {
                if (r < 0.5) type = 'striker';
                else type = 'basic';
            }

            // Deterministic ID for ambush: rX_rY_ambush_W_I
            const enemyId = `e_${this.gridX}_${this.gridY}_amb_${this.waveCount}_${i}`;
            const enemy = new Enemy(roomX, roomY, type, floor, this.random, enemyId);
            // Buff enemies in vault
            enemy.maxHp *= 1.5;
            enemy.hp = enemy.maxHp;

            this.enemies.push(enemy);
            game.enemies.push(enemy);
        }
    }

    checkAmbushStatus(game) {
        if (!this.ambushStarted || this.waveWaiting) return;

        // Check if current wave is cleared
        this.enemies = this.enemies.filter(e => !e.isDead);

        if (this.enemies.length === 0) {
            if (this.waveCount < this.maxWaves) {
                this.waveWaiting = true;
                this.waveTimer = setTimeout(() => {
                    this.waveTimer = null;
                    this.spawnWave(game);
                }, 1000);
            } else {
                // Ambush Cleared!
                this.ambushStarted = false;
                this.cleared = true;
                this.locked = false;
                game.showNotification("VAULT UNLOCKED! CLAIM YOUR REWARD!", '#00ff00');

                // Unlock chests
                if (this.vaultChests) {
                    this.vaultChests.forEach(c => {
                        c.ambushActive = false;
                        c.locked = false;
                    });
                }
            }
        }
    }

    cancelPendingEvents() {
        if (this.waveTimer !== null) {
            clearTimeout(this.waveTimer);
            this.waveTimer = null;
        }
        this.waveWaiting = false;
    }

    spawnAsteroids(game) {
        // Random count 5-30
        let count = 5 + Math.floor(this.random() * 25);
        if (count > 30) count = 30;

        for (let i = 0; i < count; i++) {
            const pad = 100;
            const ax = this.x + pad + this.random() * (this.width - pad * 2);
            const ay = this.y + pad + this.random() * (this.height - pad * 2);

            // Determine Size
            const rSize = this.random();
            let size = 'medium';
            if (rSize < 0.3) size = 'small';
            if (rSize > 0.8) size = 'large';

            // Determine Type
            const rType = this.random();
            let type = 'rock';
            if (rType < 0.15) type = 'crystal_blue'; // 15% Blue
            else if (rType < 0.20) type = 'crystal_gold'; // 5% Gold (15-20)

            const asteroid = new Asteroid(ax, ay, size, type, this.random);
            game.asteroids.push(asteroid);
        }
        return count;
    }

    spawnLootCrates(game, asteroidCount) {
        // Max 40 total entities (asteroids + crates), max 30 crates
        const remainingBudget = 40 - asteroidCount;
        let maxCrates = 30;
        if (maxCrates > remainingBudget) maxCrates = remainingBudget;
        if (maxCrates < 0) maxCrates = 0;

        // Random count 2 to maxCrates
        let count = 2;
        if (maxCrates > 2) {
            count = 2 + Math.floor(this.random() * (maxCrates - 2));
        } else {
            count = maxCrates;
        }

        for (let i = 0; i < count; i++) {
            const pad = 150;
            const cx = this.x + pad + this.random() * (this.width - pad * 2);
            const cy = this.y + pad + this.random() * (this.height - pad * 2);

            // Random Size
            const sizes = ['1x1', '1x2', '2x2'];
            const size = sizes[Math.floor(this.random() * sizes.length)];

            game.lootCrates.push(new LootCrate(cx, cy, size, this.random));
        }
    }

    spawnShipwrecks(game) {
        // Very rare per room, aim for 2-3 per floor (approx 15 rooms)
        // Chance ~ 15-20% per room
        if (this.random() < 0.2) {
            const pad = 200;
            const wx = this.x + pad + this.random() * (this.width - pad * 2);
            const wy = this.y + pad + this.random() * (this.height - pad * 2);

            game.shipwrecks.push(new Shipwreck(wx, wy, game.floor || 1, this.random));
        }
    }

    spawnEnemies(game) {
        if (this.type === RoomType.BOSS) {
            console.log("Spawning BOSS!");
            // Center of room
            const bx = this.x + this.width / 2;
            const by = this.y + this.height / 2;
            const boss = new Boss(bx, by, game.floor || 1, this.random);
            boss.game = game;
            game.bosses.push(boss);
            game.showNotification("WARNING: BOSS DETECTED", '#ff0000');
            return;
        }

        const floor = game.floor || 1;

        // Density based on room size
        const count = 3 + Math.floor(this.random() * 4) * (this.widthUnits * this.heightUnits);
        const is2x2Room = this.widthUnits === 2 && this.heightUnits === 2;

        for (let i = 0; i < count; i++) {
            // Random position within room, padded from walls
            const pad = 200;
            const ex = this.x + pad + this.random() * (this.width - pad * 2);
            const ey = this.y + pad + this.random() * (this.height - pad * 2);

            let type = 'basic';
            const r = this.random();

            // Floor-restricted spawns: sniper 3+, circler 2+, rocketeer 4+
            if (r < 0.2 && floor >= 3) {
                // 20% chance for Sniper (floor 3+)
                type = 'sniper';
            } else if (r < 0.35 && floor >= 2) {
                // 15% chance for Circler (floor 2+)
                type = 'circler';
            } else if (is2x2Room && floor >= 4) {
                // Rocketeer in 2x2 rooms (floor 4+)
                if (i === 0) {
                    type = 'rocketeer';
                } else {
                    // Mix of striker and basic for others
                    type = this.random() < 0.3 ? 'striker' : 'basic';
                }
            } else if (is2x2Room) {
                // Before floor 4, 2x2 rooms get strikers instead
                type = this.random() < 0.3 ? 'striker' : 'basic';
            } else {
                // Smaller rooms
                const r2 = this.random();
                if (r2 < 0.1 && floor >= 4) {
                    type = 'rocketeer';
                } else if (r2 < 0.4) {
                    type = 'striker';
                }
            }

            // Deterministic ID: rX_rY_I
            const enemyId = `e_${this.gridX}_${this.gridY}_${i}`;
            const enemy = new Enemy(ex, ey, type, floor, this.random, enemyId);
            game.enemies.push(enemy);
            this.enemies.push(enemy);
        }
    }

    update(game) {
        if (this.locked) {
            if (this.type === RoomType.BOSS) {
                // Check if any bosses are alive
                // We rely on game.bosses being filtered or checking for death
                const aliveBosses = game.bosses.filter(b => !b.isDead).length;
                if (aliveBosses === 0) {
                    this.unlock(game);
                }
            } else {
                // Signal all room enemies to target the player
                for (const enemy of this.enemies) {
                    if (!enemy.isDead) {
                        enemy.spotted = true;
                    }
                }

                if (this.type === RoomType.VAULT) {
                    this.checkAmbushStatus(game);
                } else {
                    // Check if all room enemies are dead
                    const aliveCount = this.enemies.filter(e => !e.isDead).length;
                    if (aliveCount === 0) {
                        this.unlock(game);
                    }
                }
            }
        }
    }

    unlock(game) {
        this.locked = false;
        this.cleared = true;

        // Magnet all XP orbs in this room to the player
        if (game.xpOrbs) {
            for (const orb of game.xpOrbs) {
                if (this.contains(orb.x, orb.y)) {
                    orb.forced = true;
                }
            }
        }
        if (game.goldOrbs) {
            for (const orb of game.goldOrbs) {
                if (this.contains(orb.x, orb.y)) {
                    orb.forced = true;
                }
            }
        }

        // --- NEW: Set Asteroids & Boxes to 1hp for easy cleanup ---
        if (game.asteroids) {
            for (const asteroid of game.asteroids) {
                if (this.contains(asteroid.x, asteroid.y) && !asteroid.isBroken) {
                    asteroid.hp = 1;
                }
            }
        }
        if (game.lootCrates) {
            for (const crate of game.lootCrates) {
                if (this.contains(crate.x, crate.y) && !crate.isOpened) {
                    crate.hp = 1;
                }
            }
        }

        // Room Clear Bonus: +100 Points
        game.score = (game.score || 0) + 100;
        game.showNotification('ROOM CLEARED! +100', '#ffff00');

        // Auto-save after granting the clear reward so the checkpoint cannot
        // remember a cleared room while dropping its score.
        if (game.autoSave && game.playerShip) {
            game.autoSave();
        }
    }

    draw(renderer, camera) {
        // Draw Room Floor/Grid Background for this room specifically? 
        // Or just draw debug bounds for now.

        // Draw Wall Bounds (Debug Red if locked, Green if clear)
        let color = this.locked ? '#ff0000' : '#444444';

        // Boss Room Branding
        if (this.type === RoomType.BOSS) {
            color = this.locked ? '#ff0000' : '#aa00ff'; // Red if locked, Purple if clear

            // Draw a subtle floor tint or border glow for Boss Room?
            // Let's just make the borders thick and purple-ish
            if (!this.locked) {
                renderer.ctx.fillStyle = 'rgba(100, 0, 200, 0.1)';
                renderer.ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }

        const lw = 4;

        // Top
        renderer.drawLine(this.x, this.y, this.x + this.width, this.y, color, lw);
        // Bottom
        renderer.drawLine(this.x, this.y + this.height, this.x + this.width, this.y + this.height, color, lw);
        // Left
        renderer.drawLine(this.x, this.y, this.x, this.y + this.height, color, lw);
        // Right
        renderer.drawLine(this.x + this.width, this.y, this.x + this.width, this.y + this.height, color, lw);

        // Draw Doors?
    }
}
