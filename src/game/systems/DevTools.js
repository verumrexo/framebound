import { Asteroid } from '../entities/Asteroid.js';
import { LootCrate } from '../entities/LootCrate.js';
import { XPOrb } from '../entities/XPOrb.js';
import { GoldOrb } from '../entities/GoldOrb.js';
import { TrainingDummy } from '../entities/TrainingDummy.js';
import { Boss } from '../entities/Boss.js';
import { Enemy } from '../entities/Enemy.js';
import { TreasureChest } from '../entities/TreasureChest.js';
import { PartsLibrary } from '../parts/Part.js';

export class DevTools {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.spawnAmount = 1;
        this.pendingSpawnAction = null; // Function to execute on map click
        this.placementMode = false;

        // Create UI
        this.ui = document.createElement('div');
        this.ui.style.position = 'absolute';
        this.ui.style.top = '100px';
        this.ui.style.left = '20px';
        this.ui.style.padding = '15px';
        this.ui.style.background = 'rgba(0, 0, 0, 0.9)';
        this.ui.style.border = '2px solid #00ff00';
        this.ui.style.display = 'none';
        this.ui.style.color = '#00ff00';
        this.ui.style.fontFamily = "'VT323', monospace";
        this.ui.style.minWidth = '220px';
        this.ui.style.zIndex = '9999';
        this.ui.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.2)';

        // Header
        const header = document.createElement('div');
        header.innerText = 'DEV TOOLS [L]';
        header.style.fontSize = '24px';
        header.style.marginBottom = '10px';
        header.style.textAlign = 'center';
        header.style.borderBottom = '1px solid #00ff00';
        header.style.paddingBottom = '5px';
        this.ui.appendChild(header);

        // Buttons Container
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        this.ui.appendChild(container);

        // --- QUANTITY SLIDER ---
        const sliderContainer = document.createElement('div');
        sliderContainer.style.marginBottom = '10px';
        sliderContainer.style.background = 'rgba(0,50,0,0.5)';
        sliderContainer.style.padding = '5px';

        const sliderLabel = document.createElement('div');
        sliderLabel.innerText = `Spawn Amount: ${this.spawnAmount}`;
        sliderLabel.style.marginBottom = '4px';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '50';
        slider.value = '1';
        slider.style.width = '100%';
        slider.oninput = (e) => {
            this.spawnAmount = parseInt(e.target.value);
            sliderLabel.innerText = `Spawn Amount: ${this.spawnAmount}`;
        };

        sliderContainer.appendChild(sliderLabel);
        sliderContainer.appendChild(slider);
        container.appendChild(sliderContainer);


        // Helper to create buttons
        const createBtn = (text, action, color = '#00ff00', requiresPlacement = true) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.style.background = 'rgba(0, 50, 0, 0.5)';
            btn.style.color = color;
            btn.style.border = `1px solid ${color}`;
            btn.style.padding = '8px';
            btn.style.cursor = 'pointer';
            btn.style.fontFamily = "'VT323', monospace";
            btn.style.fontSize = '18px';
            btn.style.textAlign = 'left';

            btn.onmouseover = () => btn.style.background = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.3)`;
            btn.onmouseout = () => btn.style.background = 'rgba(0, 50, 0, 0.5)';

            btn.onclick = (e) => {
                e.stopPropagation();
                if (requiresPlacement) {
                    this.startPlacement(action);
                } else {
                    action();
                }
            };
            container.appendChild(btn);
        };

        // --- SPAWNERS (Click -> Placment Mode) ---
        createBtn('✨ Spawn XP Orb', (x, y) => this.spawnXP(x, y));
        createBtn('💰 Spawn Gold Orb', (x, y) => this.spawnGold(x, y), '#ffd700');
        createBtn('🗿 Spawn Asteroid', (x, y) => this.spawnAsteroid(x, y), '#aaa');
        createBtn('📦 Spawn Loot Crate', (x, y) => this.spawnCrate(x, y), '#88aaff');
        createBtn('🎁 Spawn Chest', (x, y) => this.spawnChest(x, y), '#ffaa44');
        createBtn('🎯 Spawn Dummy', (x, y) => this.spawnDummy(x, y), '#ffaa00');
        createBtn('👾 Spawn Enemy', (x, y) => this.spawnEnemy(x, y), '#ff4444');
        createBtn('👹 Spawn Boss', (x, y) => this.spawnBoss(x, y), '#ff00ff');

        // --- UTILITY ---
        createBtn('☢️ NUKE ROOM', () => this.nuke(), '#ff0000', false);
        createBtn('🔓 Unlock All Parts', () => this.unlockAllParts(), '#00ffff', false);

        // --- EDITORS ---
        createBtn('🛠️ Ship Editor', () => this.openShipEditor(), '#00ffff', false);
        createBtn('📐 Part Designer', () => this.openDesigner(), '#ff00ff', false);

        document.body.appendChild(this.ui);

        // Prevent events passing through
        ['mousedown', 'mouseup', 'click', 'contextmenu', 'keydown', 'keyup'].forEach(evt => {
            this.ui.addEventListener(evt, (e) => e.stopPropagation());
        });

        // Global Click Listener for Placement
        window.addEventListener('mousedown', (e) => this.handleGlobalClick(e), true);
    }

    toggle() {
        this.active = !this.active;
        this.ui.style.display = this.active ? 'block' : 'none';

        // Cancel placement if closing
        if (!this.active) {
            this.placementMode = false;
            this.pendingSpawnAction = null;
            document.body.style.cursor = 'default';
        }
    }

    startPlacement(actionCallback) {
        this.pendingSpawnAction = actionCallback;
        this.placementMode = true;

        // Hide menu manually to avoid triggering the cancel logic in toggle()
        this.active = false;
        this.ui.style.display = 'none';

        document.body.style.cursor = 'crosshair';
        this.game.showNotification("Click to Spawn...", "#ffffff");
    }

    handleGlobalClick(e) {
        if (!this.placementMode || !this.pendingSpawnAction) return;

        // Allow left click
        if (e.button === 0) {
            e.stopPropagation(); // Stop game from processing click (shooting)

            // Get World Coords
            const rect = this.game.renderer.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const zoom = this.game.camera.zoom || 1;
            const worldX = (mouseX / zoom) + this.game.camera.x;
            const worldY = (mouseY / zoom) + this.game.camera.y;

            // Spawn Logic
            const amount = this.spawnAmount;
            console.log(`[DevTools] Spawning ${amount} items at ${worldX}, ${worldY}`);

            for (let i = 0; i < amount; i++) {
                // Add slight jitter for multiple spawns
                const ox = (amount > 1) ? worldX + (Math.random() - 0.5) * 100 : worldX;
                const oy = (amount > 1) ? worldY + (Math.random() - 0.5) * 100 : worldY;
                this.pendingSpawnAction(ox, oy);
            }

            // Reset cursor but STAY in placement mode? Or exit?
            // "let me click spawn and then click where to spawn" - typically implies one-off action.
            // Let's exit placement mode after one click for safety/simplicity, unless Shif-Click?
            // For now, exit.
            this.placementMode = false;
            this.pendingSpawnAction = null;
            document.body.style.cursor = 'default';
            // Optional: Re-open menu? Maybe annoying.
        } else if (e.button === 2) {
            // Right click cancel
            this.placementMode = false;
            this.pendingSpawnAction = null;
            document.body.style.cursor = 'default';
            this.toggle(); // Re-open menu
        }
    }

    spawnXP(x, y) {
        this.game.xpOrbs.push(new XPOrb(x, y, 10));
        this.game.showNotification("Spawned XP", "#00ff00");
    }

    spawnGold(x, y) {
        this.game.goldOrbs.push(new GoldOrb(x, y, 1));
        this.game.showNotification("Spawned Gold", "#ffd700");
    }

    spawnAsteroid(x, y) {
        const rType = Math.random();
        let type = 'rock';
        if (rType < 0.3) type = 'crystal_blue';
        else if (rType < 0.6) type = 'crystal_gold';
        this.game.asteroids.push(new Asteroid(x, y, 'medium', type));
        this.game.showNotification(`Spawned ${type} Asteroid`, "#aaa");
    }

    spawnCrate(x, y) {
        const sizes = ['1x1', '1x2', '2x2'];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        this.game.lootCrates.push(new LootCrate(x, y, size));
        this.game.showNotification(`Spawned ${size} Crate`, "#88aaff");
    }

    spawnChest(x, y) {
        this.game.treasureChests.push(new TreasureChest(x, y));
        this.game.showNotification("Spawned Treasure Chest", "#ffaa44");
    }

    spawnDummy(x, y) {
        this.game.enemies.push(new TrainingDummy(x, y));
        this.game.showNotification("Spawned Training Dummy", "#ffaa00");
    }

    spawnEnemy(x, y) {
        this.game.enemies.push(new Enemy(x, y, 'basic')); // Default to basic
        this.game.showNotification("Spawned Enemy", "#ff4444");
    }

    spawnBoss(x, y) {
        this.game.bosses.push(new Boss(x, y, 1)); // Level 1 Boss
        this.game.showNotification("Spawned BOSS", "#ff00ff");
    }

    nuke() {
        console.log('[Dev] NUKE TRIGGERED');
        let count = 0;
        this.game.enemies.forEach(e => { if (e.takeDamage) { e.takeDamage(99999); count++; } });
        this.game.bosses.forEach(b => { if (b.takeDamage) { b.takeDamage(99999); count++; } });
        this.game.showNotification(`NUKE: Eliminated ${count} entities`, '#ff0000');
        this.game.audio.play('enemy_death1', { volume: 1.0 });
    }

    unlockAllParts() {
        // Toggle Infinite Mode (Flag in Hangar)
        this.game.hangar.hasInfiniteParts = !this.game.hangar.hasInfiniteParts;
        const state = this.game.hangar.hasInfiniteParts ? "ENABLED" : "DISABLED";

        let count = 0;
        // Ensure we have at least 1 of everything if enabling
        if (this.game.hangar.hasInfiniteParts) {
            Object.keys(PartsLibrary).forEach(key => {
                if (key !== 'core') {
                    if (!this.game.hangar.inventory[key] || this.game.hangar.inventory[key] < 1) {
                        this.game.hangar.inventory[key] = 1;
                        count++;
                    }
                }
            });
        }

        this.game.hangar.updateUI(); // Refresh UI logic
        this.game.showNotification(`Infinite Parts: ${state} (Added ${count} missing)`, "#00ffff");
    }

    openShipEditor() {
        if (!this.game.hangar.active && !this.game.designer.active) {
            this.game.shipBuilder.toggle();
            this.toggle(); // Close menu
        }
    }

    openDesigner() {
        if (!this.game.hangar.active) {
            this.game.designer.open(null);
            this.toggle(); // Close menu
        } else {
            this.game.designer.open(null);
            this.toggle();
        }
    }
}
