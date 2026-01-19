import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { Asteroid } from '../entities/Asteroid.js';
import { LootCrate } from '../entities/LootCrate.js';
import { Shipwreck } from '../entities/Shipwreck.js';
import { RoomType } from './LevelGenerator.js';

export class Room {
    constructor(gridX, gridY, widthUnits, heightUnits) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.widthUnits = widthUnits; // 1 or 2
        this.heightUnits = heightUnits; // 1 or 2

        // World coordinates
        this.unitSize = 2000;
        this.x = gridX * this.unitSize;
        this.y = gridY * this.unitSize;
        this.width = widthUnits * this.unitSize;
        this.height = heightUnits * this.unitSize;

        this.enemies = []; // Stores generated enemy instances
        this.locked = false;
        this.visited = false;
        this.cleared = false;

        // Shop room properties
        this.shopItems = null; // Will be generated on first visit
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
            }
        }
    }

    generateShopItems(game) {
        if (this.shopItems) return; // Already generated

        // Import ShopItem and parts synchronously
        import('../entities/ShopItem.js').then(({ ShopItem }) => {
            import('../parts/Part.js').then(({ PartsLibrary: PL, UserPartsLibrary: UPL }) => {
                const allParts = [];
                for (const id of Object.keys(PL)) {
                    if (id !== 'core') allParts.push({ id, def: PL[id] });
                }
                for (const id of Object.keys(UPL)) {
                    allParts.push({ id, def: UPL[id] });
                }

                // Shuffle and pick 3 random parts
                for (let i = allParts.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allParts[i], allParts[j]] = [allParts[j], allParts[i]];
                }

                const selectedParts = allParts.slice(0, 3);

                // Create item data
                const itemDatas = [
                    // Heal option
                    {
                        type: 'heal',
                        name: 'Repair Kit',
                        description: 'Restore 50 HP',
                        price: 30
                    },
                    // 3 random parts
                    ...selectedParts.map(p => ({
                        type: 'part',
                        name: p.def.name || p.id,
                        partId: p.id,
                        description: p.def.type || 'Part',
                        price: Math.floor((p.def.stats?.hp || 10) * 2 + (p.def.stats?.mass || 1) * 5)
                    }))
                ];

                // Position items in a row in the center of the room
                const centerX = this.x + this.width / 2;
                const centerY = this.y + this.height / 2;
                const spacing = 120;
                const startX = centerX - ((itemDatas.length - 1) * spacing) / 2;

                this.shopItems = [];
                for (let i = 0; i < itemDatas.length; i++) {
                    const item = new ShopItem(startX + i * spacing, centerY, itemDatas[i]);
                    this.shopItems.push(item);
                    game.shopItems.push(item); // Add to game's global list for rendering
                }
            });
        });
    }

    spawnTreasureChests(game) {
        if (this.treasureChests) return; // Already spawned

        import('../entities/TreasureChest.js').then(({ TreasureChest }) => {
            // Spawn 1-2 chests
            const chestCount = 1 + Math.floor(Math.random() * 2);
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const spacing = 150;
            const startX = centerX - ((chestCount - 1) * spacing) / 2;

            this.treasureChests = [];
            for (let i = 0; i < chestCount; i++) {
                const chest = new TreasureChest(startX + i * spacing, centerY);
                this.treasureChests.push(chest);
                game.treasureChests.push(chest);
            }
        });
    }

    spawnVaultChests(game) {
        if (this.vaultChests) return;

        import('../entities/VaultChest.js').then(({ VaultChest }) => {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const spacing = 200;

            this.vaultChests = [];

            // Chest 1: Gold Cost (High Gold)
            const goldChest = new VaultChest(centerX - spacing / 2, centerY, 'gold', 100);
            this.vaultChests.push(goldChest);
            game.vaultChests = game.vaultChests || [];
            game.vaultChests.push(goldChest);

            // Chest 2: HP Cost (High HP)
            const hpChest = new VaultChest(centerX + spacing / 2, centerY, 'hp', 50);
            this.vaultChests.push(hpChest);
            game.vaultChests.push(hpChest);
        });
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

        // Spawn 3-5 enemies around the player
        const count = 3 + this.waveCount; // Harder each wave
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 400 + Math.random() * 200;
            const ex = game.x + Math.cos(angle) * dist;
            const ey = game.y + Math.sin(angle) * dist;

            // Constrain to room
            const roomX = Math.max(this.x + 50, Math.min(this.x + this.width - 50, ex));
            const roomY = Math.max(this.y + 50, Math.min(this.y + this.height - 50, ey));

            const type = Math.random() > 0.6 ? 'striker' : 'drone';
            const enemy = new Enemy(roomX, roomY, type);
            // Buff enemies in vault?
            enemy.hp *= 1.5;

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
                setTimeout(() => this.spawnWave(game), 1000); // Delay next wave
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

    spawnAsteroids(game) {
        // Random count 5-30
        let count = 5 + Math.floor(Math.random() * 25);
        if (count > 30) count = 30;

        for (let i = 0; i < count; i++) {
            const pad = 100;
            const ax = this.x + pad + Math.random() * (this.width - pad * 2);
            const ay = this.y + pad + Math.random() * (this.height - pad * 2);

            // Determine Size
            const rSize = Math.random();
            let size = 'medium';
            if (rSize < 0.3) size = 'small';
            if (rSize > 0.8) size = 'large';

            // Determine Type
            const rType = Math.random();
            let type = 'rock';
            if (rType < 0.15) type = 'crystal_blue'; // 15% Blue
            else if (rType < 0.20) type = 'crystal_gold'; // 5% Gold (15-20)

            const asteroid = new Asteroid(ax, ay, size, type);
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
            count = 2 + Math.floor(Math.random() * (maxCrates - 2));
        } else {
            count = maxCrates;
        }

        for (let i = 0; i < count; i++) {
            const pad = 150;
            const cx = this.x + pad + Math.random() * (this.width - pad * 2);
            const cy = this.y + pad + Math.random() * (this.height - pad * 2);

            // Random Size
            const sizes = ['1x1', '1x2', '2x2'];
            const size = sizes[Math.floor(Math.random() * sizes.length)];

            game.lootCrates.push(new LootCrate(cx, cy, size));
        }
    }

    spawnShipwrecks(game) {
        // Very rare per room, aim for 2-3 per floor (approx 15 rooms)
        // Chance ~ 15-20% per room
        if (Math.random() < 0.2) {
            const pad = 200;
            const wx = this.x + pad + Math.random() * (this.width - pad * 2);
            const wy = this.y + pad + Math.random() * (this.height - pad * 2);

            game.shipwrecks.push(new Shipwreck(wx, wy));
        }
    }

    spawnEnemies(game) {
        if (this.type === RoomType.BOSS) {
            console.log("Spawning BOSS!");
            // Center of room
            const bx = this.x + this.width / 2;
            const by = this.y + this.height / 2;
            const boss = new Boss(bx, by, game.level);
            game.bosses.push(boss);
            game.showNotification("WARNING: BOSS DETECTED", '#ff0000');
            return;
        }

        // Density based on room size
        const count = 3 + Math.floor(Math.random() * 4) * (this.widthUnits * this.heightUnits);

        for (let i = 0; i < count; i++) {
            // Random position within room, padded from walls
            const pad = 200;
            const ex = this.x + pad + Math.random() * (this.width - pad * 2);
            const ey = this.y + pad + Math.random() * (this.height - pad * 2);

            // 30% chance for a striker
            const type = Math.random() < 0.3 ? 'striker' : 'basic';

            const enemy = new Enemy(ex, ey, type);
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

        // Auto-save on room clear (safer checkpoint than room enter)
        if (game.autoSave && game.playerShip) {
            game.autoSave();
        }

        // Room Clear Bonus: +100 Points
        game.score = (game.score || 0) + 100;
        game.showNotification('ROOM CLEARED! +100', '#ffff00');
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
