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
        this.keypadActive = false;
        this.keypadEntry = "";
        this.correctCode = "2519";
        // Persistent auth via localStorage
        this.authenticated = localStorage.getItem('fb_dev_auth') === 'true';
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

        // Buttons Container (Grid for side-by-side buttons)
        const container = document.createElement('div');
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gap = '8px';
        this.ui.appendChild(container);

        // --- GRAPHICS SETTINGS ---
        const graphicsHeader = document.createElement('div');
        graphicsHeader.innerText = 'graphics';
        graphicsHeader.style.color = '#00ffff';
        graphicsHeader.style.borderBottom = '1px solid #00ffff';
        graphicsHeader.style.marginBottom = '5px';
        graphicsHeader.style.marginTop = '10px';
        graphicsHeader.style.gridColumn = 'span 2';
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
            // row.style.gridColumn = 'span 2'; // Remove span
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
            div.style.gridColumn = 'span 2';
            container.appendChild(div);
        };

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
            btn.style.fontSize = '12px';
            btn.style.textAlign = 'center';

            btn.onmouseover = () => btn.style.background = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.3)`;
            btn.onmouseout = () => btn.style.background = 'rgba(0, 50, 0, 0.5)';

            btn.onclick = (e) => {
                e.stopPropagation();
                if (requiresPlacement) {
                    this.startPlacement(action);
                } else {
                    action(btn); // Pass button ref to action for state-based buttons
                }
            };
            container.appendChild(btn);
            return btn;
        };

        // 1. Anti-Aliasing (Smoothing)
        createToggle('anti-aliasing', () => this.game.renderer.smoothingEnabled, (v) => this.game.renderer.setSmoothing(v));

        // 2. CSS Pixelation
        createToggle('css pixelation', () => this.game.renderer.pixelatedCSS !== false, (v) => this.game.renderer.setPixelation(v));

        // 3. Resolution Scale
        createSlider('resolution scale', '0.1', '1.0', '0.05',
            () => this.game.renderer.resolutionScale,
            (v) => this.game.renderer.setResolutionScale(v)
        );

        // 5. Grid Opacity
        createSlider('grid opacity', '0', '0.5', '0.05',
            () => this.game.graphics.gridOpacity,
            (v) => this.game.graphics.gridOpacity = v
        );

        // 6. Show Hitboxes (Debug)
        this.showHitboxes = false;
        createToggle('show hitboxes', () => this.showHitboxes, (v) => this.showHitboxes = v);

        // 7. Freeze Enemies (Debug)
        this.freezeEnemies = false;
        createToggle('freeze enemies', () => this.freezeEnemies, (v) => this.freezeEnemies = v);

        // 8. Damage Numbers
        createToggle('show dmg numbers', () => this.game.showDamageNumbers, (v) => this.game.showDamageNumbers = v);

        // 9. Damage Mode
        const modeBtn = createBtn(`dmg mode: ${this.game.damageNumberMode}`, (btn) => {
            const current = this.game.damageNumberMode;
            this.game.damageNumberMode = (current === 'singular' ? 'additive' : 'singular');
            btn.innerText = `dmg mode: ${this.game.damageNumberMode}`;
        }, '#00ffff', false);

        // (God mode moved to button section)

        // --- SPAWNER HEADER ---
        const spawnHeader = document.createElement('div');
        spawnHeader.innerText = 'spawners';
        spawnHeader.style.color = '#00ff00';
        spawnHeader.style.borderBottom = '1px solid #00ff00';
        spawnHeader.style.marginBottom = '5px';
        spawnHeader.style.marginTop = '10px';
        spawnHeader.style.gridColumn = 'span 2';
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
        sliderContainer.style.gridColumn = 'span 2';
        container.appendChild(sliderContainer);



        // --- SPAWNERS (Click -> Placment Mode) ---
        createBtn('✨ spawn xp orb', (x, y) => this.spawnXP(x, y));
        createBtn('💰 spawn gold orb', (x, y) => this.spawnGold(x, y), '#ffd700');
        createBtn('🗿 spawn asteroid', (x, y) => this.spawnAsteroid(x, y), '#aaa');
        createBtn('📦 spawn loot crate', (x, y) => this.spawnCrate(x, y), '#88aaff');
        createBtn('🎁 spawn chest', (x, y) => this.spawnChest(x, y), '#ffaa44');
        createBtn('🎯 spawn dummy', (x, y) => this.spawnDummy(x, y), '#ffaa00');

        // Enemy Types
        createBtn('👾 enemy: basic', (x, y) => this.spawnEnemy(x, y, 'basic'), '#ff4444');
        createBtn('⚡ enemy: striker', (x, y) => this.spawnEnemy(x, y, 'striker'), '#ff6666');
        createBtn('🚀 enemy: rocketeer', (x, y) => this.spawnEnemy(x, y, 'rocketeer'), '#ff8844');
        createBtn('🎯 enemy: sniper', (x, y) => this.spawnEnemy(x, y, 'sniper'), '#ffaa44');
        createBtn('🌀 enemy: circler', (x, y) => this.spawnEnemy(x, y, 'circler'), '#ff44ff');
        createBtn('🐝 enemy: hive carrier', (x, y) => this.spawnEnemy(x, y, 'hive_carrier'), '#ff00ff');

        createBtn('👹 spawn boss', (x, y) => this.spawnBoss(x, y), '#ff00ff');

        // --- UTILITY ---
        createBtn('☢️ nuke room', () => this.nuke(), '#ff0000', false);
        createBtn('⏩ next floor', () => this.game.nextLevel(), '#aa00ff', false);
        createBtn('🔼 force level up', () => {
            this.game.levelUpManager.triggerLevelUp('mythic');
            this.toggle(); // Close menu to see screen
        }, '#00ff88', false);

        const godBtn = createBtn('😇 god mode: off', (btn) => {
            if (!this.game.playerShip) return;
            this.game.playerShip.godMode = !this.game.playerShip.godMode;
            const active = this.game.playerShip.godMode;
            btn.innerText = `😇 god mode: ${active ? 'on' : 'off'}`;
            btn.style.background = active ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 50, 0, 0.5)';
            btn.style.borderColor = active ? '#00ffff' : '#00ff00';
            btn.style.color = active ? '#00ffff' : '#00ff00';
        }, '#00ff00', false);

        createBtn('🔓 unlock parts', () => this.unlockAllParts(), '#00ffff', false);

        // --- EDITORS ---
        createBtn('🛠️ ship editor', () => this.openShipEditor(), '#00ffff', false);
        createBtn('📐 designer', () => this.openDesigner(), '#ff00ff', false);
        createBtn('🚫 disable devtools', () => this.logout(), '#ff4444', false);

        document.body.appendChild(this.ui);

        // Prevent events passing through main UI (except L key for toggle)
        ['mousedown', 'mouseup', 'click', 'contextmenu'].forEach(evt => {
            this.ui.addEventListener(evt, (e) => e.stopPropagation());
        });
        ['keydown', 'keyup'].forEach(evt => {
            this.ui.addEventListener(evt, (e) => {
                if (e.code !== 'KeyL') e.stopPropagation(); // Allow L to toggle
            });
        });

        // Create Keypad UI
        this.keypadUI = document.createElement('div');
        this.keypadUI.style.cssText = `
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 10, 0, 0.95);
            border: 2px solid #00ff00;
            padding: 30px;
            color: #00ff00;
            font-family: 'Press Start 2P', monospace;
            z-index: 10001;
            display: none;
            flex-direction: column;
            align-items: center;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.3);
            text-transform: lowercase;
        `;
        document.body.appendChild(this.keypadUI);

        // Prevent events passing through keypad
        ['mousedown', 'mouseup', 'click', 'contextmenu', 'keydown', 'keyup'].forEach(evt => {
            this.keypadUI.addEventListener(evt, (e) => e.stopPropagation());
        });

        // Global Click Listener for Placement
        window.addEventListener('mousedown', (e) => this.handleGlobalClick(e), true);
    }

    toggle() {
        if (this.active) {
            // Close devtools
            this.active = false;
            this.ui.style.display = 'none';
            this.placementMode = false;
            this.pendingSpawnAction = null;
            document.body.style.cursor = 'default';
        } else if (this.keypadActive) {
            // Close keypad if it's open
            this.hideKeypad();
        } else if (this.authenticated) {
            // Already authenticated this session, skip keypad
            this.active = true;
            this.ui.style.display = 'block';
        } else {
            // Not authenticated, show keypad
            this.showKeypad();
        }
    }

    showKeypad() {
        if (this.keypadActive) return;
        this.keypadActive = true;
        this.keypadEntry = "";
        this.renderKeypad();
    }

    hideKeypad() {
        this.keypadActive = false;
        this.keypadUI.style.display = 'none';
    }

    renderKeypad() {
        this.keypadUI.style.display = 'flex';
        this.keypadUI.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 14px; color: #00ff00;">terminal access locked</div>
            <div style="background: #002200; border: 1px solid #00ff00; padding: 15px; width: 200px; text-align: center; font-size: 24px; margin-bottom: 25px; min-height: 24px;">
                ${this.keypadEntry.split('').map(() => '*').join('')}${'_'.repeat(4 - this.keypadEntry.length)}
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                ${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'X'].map(key => `
                    <button class="keypad-btn" style="
                        background: rgba(0, 50, 0, 0.5);
                        border: 1px solid #00ff00;
                        color: #00ff00;
                        padding: 15px;
                        font-family: 'Press Start 2P';
                        font-size: 14px;
                        cursor: pointer;
                        width: 60px;
                        text-align: center;
                    " onclick="window.game.devTools.handleKeypadInput('${key}')">${key}</button>
                `).join('')}
            </div>
            <button style="margin-top: 30px; background: none; border: none; color: #888; font-family: 'Press Start 2P'; font-size: 8px; cursor: pointer;" onclick="window.game.devTools.hideKeypad()">[abort_connection]</button>
        `;

        // Tool injection for the global window.game ref
        if (!window.game) window.game = this.game;
    }

    handleKeypadInput(key) {
        if (key === 'C') {
            this.keypadEntry = "";
        } else if (key === 'X') {
            this.hideKeypad();
            return;
        } else if (this.keypadEntry.length < 4) {
            this.keypadEntry += key;
        }

        this.renderKeypad();

        if (this.keypadEntry.length === 4) {
            if (this.keypadEntry === this.correctCode) {
                this.game.showNotification("access granted", "#00ff00");
                this.hideKeypad();
                this.authenticated = true;
                localStorage.setItem('fb_dev_auth', 'true'); // Persistent auth
                this.active = true;
                this.ui.style.display = 'block';
            } else {
                this.game.showNotification("access denied", "#ff0000");
                this.keypadEntry = "";
                setTimeout(() => this.renderKeypad(), 300);
            }
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

    spawnEnemy(x, y, type = 'basic') {
        this.game.enemies.push(new Enemy(x, y, type));
        this.game.showNotification(`spawned ${type} enemy`, "#ff4444");
    }

    spawnBoss(x, y) {
        const boss = new Boss(x, y, this.game.floor || 1);
        boss.game = this.game;
        this.game.bosses.push(boss);
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
        for (const id of Object.keys(PartsLibrary)) {
            if (id !== 'core') {
                this.game.hangar.inventory[id] = (this.game.hangar.inventory[id] || 0) + 1;
            }
        }
        this.game.hangar.updateUI();
        this.game.showNotification("all parts unlocked", "#00ffff");
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
    logout() {
        localStorage.removeItem('fb_dev_auth');
        this.authenticated = false;
        this.active = false;
        this.ui.style.display = 'none';
        this.game.showNotification("dev mode disabled - scores re-enabled", "#00ff00");
    }
}
