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
        this.ui.style.fontFamily = "'Press Start 2P', monospace";
        this.ui.style.minWidth = '220px';
        this.ui.style.maxHeight = '80vh';
        this.ui.style.overflowY = 'auto';
        this.ui.style.scrollbarWidth = 'thin';
        this.ui.style.scrollbarColor = '#00ff00 #002200';
        this.ui.style.zIndex = '9999';
        this.ui.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.2)';

        // Custom Scrollbar Styling
        const style = document.createElement('style');
        style.textContent = `
            #devtools-ui::-webkit-scrollbar { width: 8px; }
            #devtools-ui::-webkit-scrollbar-track { background: #002200; }
            #devtools-ui::-webkit-scrollbar-thumb { background: #00ff00; border-radius: 4px; }
            #devtools-ui::-webkit-scrollbar-thumb:hover { background: #44ff44; }
        `;
        this.ui.id = 'devtools-ui'; // ID for styling
        this.ui.appendChild(style);

        // Header
        const header = document.createElement('div');
        header.innerText = 'dev tools [l]';
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

        this.ui.appendChild(container);

        // --- GRAPHICS SETTINGS ---
        const graphicsHeader = document.createElement('div');
        graphicsHeader.innerText = 'graphics';
        graphicsHeader.style.color = '#00ffff';
        graphicsHeader.style.borderBottom = '1px solid #00ffff';
        graphicsHeader.style.marginBottom = '5px';
        graphicsHeader.style.marginTop = '10px';
        container.appendChild(graphicsHeader);

        // Helper for Toggles
        const createToggle = (label, getVal, setVal) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.fontSize = '12px';
            row.style.marginBottom = '5px';

            const txt = document.createElement('span');
            txt.innerText = label;

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = getVal();
            chk.style.cursor = 'pointer';
            chk.onchange = (e) => setVal(e.target.checked);

            row.appendChild(txt);
            row.appendChild(chk);
            container.appendChild(row);
        };

        // Helper for Sliders (Mini)
        const createSlider = (label, min, max, step, getVal, setVal) => {
            const div = document.createElement('div');
            div.style.marginBottom = '5px';
            const labelEl = document.createElement('div');
            labelEl.innerText = `${label}: ${getVal()}`;
            labelEl.style.fontSize = '12px';

            const inp = document.createElement('input');
            inp.type = 'range';
            inp.min = min; inp.max = max; inp.step = step;
            inp.value = getVal();
            inp.style.width = '100%';
            inp.style.height = '10px';
            inp.oninput = (e) => {
                const v = parseFloat(e.target.value);
                setVal(v);
                labelEl.innerText = `${label}: ${v}`;
            };

            div.appendChild(labelEl);
            div.appendChild(inp);
            container.appendChild(div);
        };

        // 1. Anti-Aliasing (Smoothing)
        createToggle('anti-aliasing', () => this.game.renderer.smoothingEnabled, (v) => this.game.renderer.setSmoothing(v));

        // 2. CSS Pixelation
        createToggle('css pixelation', () => this.game.renderer.pixelatedCSS !== false, (v) => this.game.renderer.setPixelation(v));

        // 3. Scanlines
        createToggle('scanlines', () => document.getElementById('scanlines').style.display === 'block', (v) => {
            document.getElementById('scanlines').style.display = v ? 'block' : 'none';
        });

        // 4. Vignette
        createToggle('vignette', () => document.getElementById('vignette').style.display === 'block', (v) => {
            document.getElementById('vignette').style.display = v ? 'block' : 'none';
        });

        // 5. Grid Opacity
        createSlider('grid opacity', '0', '0.5', '0.05',
            () => this.game.graphics.gridOpacity,
            (v) => this.game.graphics.gridOpacity = v
        );

        // --- SPAWNER HEADER ---
        const spawnHeader = document.createElement('div');
        spawnHeader.innerText = 'spawners';
        spawnHeader.style.color = '#00ff00';
        spawnHeader.style.borderBottom = '1px solid #00ff00';
        spawnHeader.style.marginBottom = '5px';
        spawnHeader.style.marginTop = '10px';
        container.appendChild(spawnHeader);


        const sliderContainer = document.createElement('div');
        sliderContainer.style.marginBottom = '10px';
        sliderContainer.style.background = 'rgba(0,50,0,0.5)';
        sliderContainer.style.padding = '5px';
        container.appendChild(sliderContainer);

        const sliderLabel = document.createElement('div');
        sliderLabel.innerText = `spawn amount: ${this.spawnAmount}`;
        sliderLabel.style.marginBottom = '4px';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '50';
        slider.value = '1';
        slider.style.width = '100%';
        slider.oninput = (e) => {
            this.spawnAmount = parseInt(e.target.value);
            sliderLabel.innerText = `spawn amount: ${this.spawnAmount}`;
        };

        sliderContainer.appendChild(sliderLabel);
        sliderContainer.appendChild(slider);

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
            btn.style.fontFamily = "'Press Start 2P', monospace";
            btn.style.fontSize = '16px';
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
        createBtn('✨ spawn xp orb', (x, y) => this.spawnXP(x, y));
        createBtn('💰 spawn gold orb', (x, y) => this.spawnGold(x, y), '#ffd700');
        createBtn('🗿 spawn asteroid', (x, y) => this.spawnAsteroid(x, y), '#aaa');
        createBtn('📦 spawn loot crate', (x, y) => this.spawnCrate(x, y), '#88aaff');
        createBtn('🎁 spawn chest', (x, y) => this.spawnChest(x, y), '#ffaa44');
        createBtn('🎯 spawn dummy', (x, y) => this.spawnDummy(x, y), '#ffaa00');
        createBtn('👾 spawn enemy', (x, y) => this.spawnEnemy(x, y), '#ff4444');
        createBtn('👹 spawn boss', (x, y) => this.spawnBoss(x, y), '#ff00ff');

        // --- UTILITY ---
        createBtn('☢️ nuke room', () => this.nuke(), '#ff0000', false);
        createBtn('🔓 unlock all parts', () => this.unlockAllParts(), '#00ffff', false);

        // --- EDITORS ---
        createBtn('🛠️ ship editor', () => this.openShipEditor(), '#00ffff', false);
        createBtn('📐 part designer', () => this.openDesigner(), '#ff00ff', false);

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
        this.game.showNotification("click to spawn...", "#ffffff");
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
        this.game.showNotification("spawned xp", "#00ff00");
    }

    spawnGold(x, y) {
        this.game.goldOrbs.push(new GoldOrb(x, y, 1));
        this.game.showNotification("spawned gold", "#ffd700");
    }

    spawnAsteroid(x, y) {
        const rType = Math.random();
        let type = 'rock';
        if (rType < 0.3) type = 'crystal_blue';
        else if (rType < 0.6) type = 'crystal_gold';
        this.game.asteroids.push(new Asteroid(x, y, 'medium', type));
        this.game.showNotification(`spawned ${type} asteroid`, "#aaa");
    }

    spawnCrate(x, y) {
        const sizes = ['1x1', '1x2', '2x2'];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        this.game.lootCrates.push(new LootCrate(x, y, size));
        this.game.showNotification(`spawned ${size} crate`, "#88aaff");
    }

    spawnChest(x, y) {
        this.game.treasureChests.push(new TreasureChest(x, y));
        this.game.showNotification("spawned treasure chest", "#ffaa44");
    }

    spawnDummy(x, y) {
        this.game.enemies.push(new TrainingDummy(x, y));
        this.game.showNotification("spawned training dummy", "#ffaa00");
    }

    spawnEnemy(x, y) {
        this.game.enemies.push(new Enemy(x, y, 'basic')); // Default to basic
        this.game.showNotification("spawned enemy", "#ff4444");
    }

    spawnBoss(x, y) {
        this.game.bosses.push(new Boss(x, y, 1)); // Level 1 Boss
        this.game.showNotification("spawned boss", "#ff00ff");
    }

    nuke() {
        console.log('[Dev] NUKE TRIGGERED');
        let count = 0;
        this.game.enemies.forEach(e => { if (e.takeDamage) { e.takeDamage(99999); count++; } });
        this.game.bosses.forEach(b => { if (b.takeDamage) { b.takeDamage(99999); count++; } });
        this.game.showNotification(`nuke: eliminated ${count} entities`, '#ff0000');
        this.game.audio.play('enemy_death1', { volume: 1.0 });
    }

    unlockAllParts() {
        // Toggle Infinite Mode (Flag in Hangar)
        this.game.hangar.hasInfiniteParts = !this.game.hangar.hasInfiniteParts;
        const state = this.game.hangar.hasInfiniteParts ? "enabled" : "disabled";

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
        this.game.showNotification(`infinite parts: ${state} (added ${count} missing)`, "#00ffff");
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
