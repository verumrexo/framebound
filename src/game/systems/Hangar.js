import { Assets } from '../../Assets.js';
import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';

export class Hangar {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.selectedPartId = 'hull';
        this.rotation = 0;
        this.rotateDebounce = false;
        this.draftShip = null; // The temporary ship we edit

        this.hasInfiniteParts = false;
        this.inventory = {};


        // Create UI
        this.ui = document.createElement('div');
        this.ui.style.position = 'absolute';
        this.ui.style.top = '10px';
        this.ui.style.left = '10px';
        this.ui.style.right = '10px';
        this.ui.style.display = 'none';
        this.ui.style.color = 'white';
        this.ui.style.fontFamily = "'Press Start 2P', monospace";
        this.ui.style.fontSize = "16px";
        this.ui.style.pointerEvents = 'none'; // Allow clicking through the gap
        this.ui.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <!-- Left Side: Stats -->
                <div id="stats-panel" style="background: rgba(0,0,0,0.8); padding: 15px; border: 1px solid rgba(0,255,0,0.2); min-width: 220px; pointer-events: auto;">
                    <div style="color: #0f0; font-size: 22px; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px solid #0f0;">vessel status</div>
                    <div id="stat-content" style="display: flex; flex-direction: column; gap: 6px;"></div>
                </div>

                <!-- Right Side: Inventory -->
                <div style="background: rgba(0,0,0,0.8); padding: 15px; border: 1px solid #0f0; min-width: 400px; max-width: 550px; pointer-events: auto; display: flex; flex-direction: column; max-height: calc(100vh - 40px);">
                    <div style="color:white; font-family:'Press Start 2P', monospace; margin-bottom:15px; font-size: 20px; border-bottom: 1px solid #0f0; padding-bottom: 5px;">ship configuration</div>
                    <div id="part-list" style="display:grid; grid-template-columns: repeat(auto-fill, 64px); grid-auto-rows: 64px; gap:8px; margin-bottom: 15px; overflow-y: auto; padding-right: 5px; scrollbar-width: thin; scrollbar-color: #0f0 #222;">
                        <style>
                            #part-list::-webkit-scrollbar { width: 6px; }
                            #part-list::-webkit-scrollbar-track { background: #111; }
                            #part-list::-webkit-scrollbar-thumb { background: #0f0; border-radius: 3px; }
                        </style>
                    </div>
                    <div id="utility-btns"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.ui);

        // Track hover to prevent click-through
        this.isHoveringUI = false;
        this.ui.onmouseenter = () => this.isHoveringUI = true;
        this.ui.onmouseleave = () => this.isHoveringUI = false;

        // CRITICAL: Stop mouse events from reaching the game canvas/input system
        this.ui.addEventListener('mousedown', (e) => e.stopPropagation());
        this.ui.addEventListener('mouseup', (e) => e.stopPropagation());
        this.ui.addEventListener('click', (e) => e.stopPropagation());
        this.ui.addEventListener('contextmenu', (e) => e.stopPropagation());

        this.ui.addEventListener('contextmenu', (e) => e.stopPropagation());

        // Tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'hangar-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(0,0,0,0.95);
            border: 1px solid #0f0;
            padding: 12px;
            color: white;
            font-family: 'Press Start 2P', monospace;
            pointer-events: none;
            display: none;
            z-index: 9999;
            min-width: 180px;
            box-shadow: 0 0 15px rgba(0,255,0,0.2);
            text-transform: lowercase;
        `;
        document.body.appendChild(this.tooltip);

        window.addEventListener('mousemove', (e) => {
            if (!this.active || this.tooltip.style.display === 'none') return;
            this.tooltip.style.left = (e.clientX + 15) + 'px';
            this.tooltip.style.top = (e.clientY + 15) + 'px';
        });

        // Instructions
        const instructionsDiv = document.createElement('div');
        instructionsDiv.style.cssText = 'font-size: 16px; color: #aaa; margin-top:10px;';
        instructionsDiv.innerHTML = `
            left click: place<br>
            right click: remove<br>
            tab: save & close
        `;
        this.ui.appendChild(instructionsDiv);

        this.updateUI();
    }

    updateUI() {
        const list = this.ui.querySelector('#part-list');
        list.innerHTML = '';

        Object.keys(this.inventory).forEach(key => {
            const count = this.inventory[key];
            const def = PartsLibrary[key];
            if (!def) return;

            // Loop to show EVERY physical item
            // If count is 0 but it's selected, show 1 'ghost' item
            const displayCount = (count === 0 && this.selectedPartId === key) ? 1 : count;

            for (let i = 0; i < displayCount; i++) {
                const isGhost = (count === 0);
                const itemWrapper = document.createElement('div');
                itemWrapper.className = 'inventory-item';
                const spanW = def.width || 1;
                const spanH = def.height || 1;
                itemWrapper.style.cssText = `
                    grid-column: span ${spanW};
                    grid-row: span ${spanH};
                    width: ${64 * spanW}px;
                    height: ${64 * spanH}px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    opacity: ${isGhost ? '0.3' : '1.0'};
                `;

                // Selection marker
                if (this.selectedPartId === key) {
                    const marker = document.createElement('div');
                    marker.style.cssText = `
                        position: absolute;
                        top: 4px;
                        left: 4px;
                        width: 4px;
                        height: 4px;
                        background: #0f0;
                        box-shadow: 0 0 5px #0f0;
                    `;
                    itemWrapper.appendChild(marker);
                }

                const canvas = document.createElement('canvas');
                const sprite = def.baseSprite || def.sprite;
                canvas.width = sprite.width * sprite.scale;
                canvas.height = sprite.height * sprite.scale;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                sprite.draw(ctx, canvas.width / 2, canvas.height / 2, 0);
                if (def.baseSprite && def.drawTurretInInventory) {
                    def.sprite.draw(ctx, canvas.width / 2, canvas.height / 2, 0);
                }

                itemWrapper.appendChild(canvas);

                itemWrapper.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedPartId = key;
                    this.updateUI();
                };

                itemWrapper.onmouseenter = () => {
                    this.tooltip.style.display = 'block';
                    this.updateTooltip(def);
                    if (isGhost) {
                        this.tooltip.innerHTML += `<div style="color:#f44; margin-top:5px; font-weight:bold;">out of stock</div>`;
                    }
                };
                itemWrapper.onmouseleave = () => {
                    this.tooltip.style.display = 'none';
                };

                list.appendChild(itemWrapper);
            }
        });

        const utility = this.ui.querySelector('#utility-btns');
        utility.innerHTML = '';

        const designBtn = document.createElement('button');
        designBtn.innerText = "+ create new part";
        designBtn.style.width = '100%';
        designBtn.style.padding = '8px';
        designBtn.style.background = '#44f';
        designBtn.style.color = 'white';
        designBtn.style.border = 'none';
        designBtn.style.cursor = 'pointer';
        designBtn.style.fontFamily = "'Press Start 2P', monospace";
        designBtn.style.fontSize = "16px";
        designBtn.onclick = (e) => {
            e.stopPropagation();
            this.game.designer.open(null);
        };
        utility.appendChild(designBtn);
        this.updateStatsUI();
    }

    updateTooltip(def) {
        Hangar.updateTooltip(this.tooltip, def);
    }

    static updateTooltip(tooltipEl, def) {
        let statsHtml = '';
        if (def.stats) {
            if (def.stats.hp) statsHtml += `<div style="color:#ff4444">integrity: +${def.stats.hp}</div>`;
            if (def.stats.mass) statsHtml += `<div style="color:#888">mass: ${def.stats.mass}t</div>`;
            if (def.stats.damage) statsHtml += `<div style="color:#ffaa44">damage: ${def.stats.damage}</div>`;
            if (def.stats.cooldown) statsHtml += `<div style="color:#aaa">cooldown: ${def.stats.cooldown}s</div>`;
            if (def.stats.chargeTime) statsHtml += `<div style="color:#aaa">charge: ${def.stats.chargeTime}s</div>`;
            if (def.stats.regen) statsHtml += `<div style="color:#44ff44">regen: +${def.stats.regen}/s</div>`;
            if (def.stats.thrust || def.type === 'thruster') statsHtml += `<div style="color:#00ffff">thrust: +${def.width * def.height}</div>`;
            if (def.type === 'accelerant') statsHtml += `<div style="color:#ffaa44">laser fire rate: +5%</div>`;
            if (def.type === 'rocket_bay') statsHtml += `<div style="color:#ffaa44">rocket payload: +1</div>`;
            if (def.type === 'booster') statsHtml += `<div style="color:#00ffff">enables dash system</div>`;
        }

        let rarityColor = '#0f0'; // Common
        if (def && def.rarity === 'rare') rarityColor = '#0088ff';
        if (def && def.rarity === 'epic') rarityColor = '#aa00ff';

        tooltipEl.innerHTML = `
            <div style="font-size: 16px; color: ${rarityColor}; margin-bottom: 5px; border-bottom: 1px solid rgba(0,255,0,0.3); text-transform: uppercase;">
                ${def.name}
            </div>
            <div style="font-size: 8px; color: ${rarityColor}; margin-bottom: 8px; font-weight: bold;">
                [${def.rarity || 'common'}]
            </div>
            <div style="font-size: 8px; color: #888; margin-bottom: 8px;">class: ${def.type} ${def.stats.weaponGroup ? `[${def.stats.weaponGroup}]` : ''} (${def.width}x${def.height})</div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
                ${statsHtml}
            </div>
        `;
    }

    updateStatsUI() {
        const statPanel = this.ui.querySelector('#stat-content');
        if (!statPanel || !this.draftShip) return;

        const stats = this.draftShip.stats;
        const levelBonus = 1 + (this.game.level - 1) * 0.01;
        const totalFRBonus = Math.round(((1 + (stats.accelerantCount || 0) * 0.05) * levelBonus - 1) * 100);

        const rows = [
            { label: 'integrity', value: `${stats.totalHp} hp`, color: '#ff4444' },
            { label: 'mass', value: `${stats.totalMass.toFixed(1)} t`, color: '#aaa' },
            { label: 'regen', value: `${((stats.regen || 0) * levelBonus).toFixed(1)} /s`, color: '#44ff44' },
            { label: 'max speed', value: `${Math.floor(800 * (1 + (stats.thrust * 0.05)) * levelBonus)} km/h`, color: '#00ffff' },
            { label: 'laser fire rate', value: `+${totalFRBonus}%`, color: '#ffaa44' },
            { label: 'rockets count', value: stats.rocketCount, color: '#ffaa44' },
            { label: 'rocket payload', value: `+${stats.rocketBayCount || 0}`, color: '#ffaa44' },
            { label: 'dash boosters', value: stats.boosterCount || 0, color: '#00ffff' },
            { label: 'velocity count', value: stats.velocityCount, color: '#ffaa44' }
        ];

        statPanel.innerHTML = rows.map(r => `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted rgba(255,255,255,0.1); padding: 2px 0;">
                <span style="color: #888;">${r.label}:</span>
                <span style="color: ${r.color}; text-align: right;">${r.value}</span>
            </div>
        `).join('');
    }

    toggle() {
        this.active = !this.active;
        this.ui.style.display = this.active ? 'block' : 'none';

        if (this.active) {
            // OPENING: Pause game and Clone Ship
            this.game.paused = true;
            this.draftShip = this.game.playerShip.clone();
            // Reset rotation to 0 for editing comfort
            this.rotation = 0;
            this.updateUI();
        } else {
            // CLOSING: Resume game and Apply Changes
            this.game.paused = false;
            // Apply draft to real ship
            if (this.draftShip) {
                this.game.playerShip = this.draftShip;
                this.draftShip = null;
            }
        }
    }

    update(dt) {
        if (!this.active) return;

        // Hangar Input Logic is simpler now: No global rotation to worry about relative to screen
        // We render the ship at the center of the screen

        if (this.game.input.isKeyDown('KeyR')) {
            if (!this.rotateDebounce) {
                this.rotation = (this.rotation + 1) % 4;
                this.rotateDebounce = true;
            }
        } else {
            this.rotateDebounce = false;
        }
    }

    draw(renderer) {
        if (!this.active || !this.draftShip) return;

        // Draw Modal Background
        renderer.drawRect(0, 0, renderer.width, renderer.height, 'rgba(0,0,0,0.85)');

        // Editor Center
        const centerX = renderer.width / 2;
        const centerY = renderer.height / 2;

        renderer.ctx.save();
        renderer.ctx.translate(centerX, centerY);

        // Draw Grid centered at 0,0 (which is now screen center)
        const CELL_STRIDE = TILE_SIZE;
        const gridSize = 15;
        renderer.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        renderer.ctx.lineWidth = 1;
        renderer.ctx.beginPath();
        for (let x = -gridSize; x <= gridSize; x++) {
            renderer.ctx.moveTo(x * CELL_STRIDE - CELL_STRIDE / 2, -gridSize * CELL_STRIDE - CELL_STRIDE / 2);
            renderer.ctx.lineTo(x * CELL_STRIDE - CELL_STRIDE / 2, gridSize * CELL_STRIDE + CELL_STRIDE / 2);
        }
        for (let y = -gridSize; y <= gridSize; y++) {
            renderer.ctx.moveTo(-gridSize * CELL_STRIDE - CELL_STRIDE / 2, y * CELL_STRIDE - CELL_STRIDE / 2);
            renderer.ctx.lineTo(gridSize * CELL_STRIDE + CELL_STRIDE / 2, y * CELL_STRIDE - CELL_STRIDE / 2);
        }
        renderer.ctx.stroke();

        // Draw DRAFT SHIP parts
        // Note: Sprite.draw expects world coordinates.
        // Since we translated to center, drawing at (part.x * STRIDE) works as local coord.

        for (const partRef of this.draftShip.getUniqueParts()) {
            const def = PartsLibrary[partRef.partId];
            if (def) {
                const isRotated = ((partRef.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;

                // Center of the cell(s)
                const drawX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
                const drawY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

                // Draw base block for weapons
                if (def.type === 'weapon') {
                    if (def.baseSprite) {
                        def.baseSprite.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2));
                    } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                        Assets.LongHull.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2));
                    } else {
                        Assets.PlayerBase.draw(renderer.ctx, drawX, drawY, 0);
                    }
                }

                const angle = (partRef.rotation || 0) * (Math.PI / 2); // Static for draft? 
                // Actually, turrets in draft are static.
                const offset = def.turretDrawOffset || 0;
                const turretX = drawX + Math.cos(angle) * offset;
                const turretY = drawY + Math.sin(angle) * offset;

                def.sprite.draw(renderer.ctx, turretX, turretY, angle + (def.rotationOffset || 0));
            }
        }

        // Mouse Interaction
        const mouse = this.game.input.getMousePos();
        // Mouse is screen relative. Center is at centerX, centerY.
        const localX = mouse.x - centerX;
        const localY = mouse.y - centerY;

        // Determine tool dimensions
        const partDef = PartsLibrary[this.selectedPartId];
        if (partDef) {
            const isRotated = (this.rotation % 2 !== 0);
            const w = isRotated ? partDef.height : partDef.width;
            const h = isRotated ? partDef.width : partDef.height;

            const halfW = (w * CELL_STRIDE) / 2;
            const halfH = (h * CELL_STRIDE) / 2;

            const gx = Math.round(localX / CELL_STRIDE - (w - 1) / 2);
            const gy = Math.round(localY / CELL_STRIDE - (h - 1) / 2);

            const isValid = this.draftShip.canPlaceAt(gx, gy, this.selectedPartId, this.rotation);

            // Draw Ghost
            renderer.ctx.save();
            renderer.ctx.globalAlpha = 0.6;

            // If invalid, we could tint it red. For now, let's just use low alpha or draw a red overlay.
            if (!isValid) {
                renderer.ctx.globalAlpha = 0.3;
            }

            const ghostX = (gx + (w - 1) / 2) * CELL_STRIDE;
            const ghostY = (gy + (h - 1) / 2) * CELL_STRIDE;

            // Draw base block for weapon ghost
            if (partDef.type === 'weapon') {
                if (partDef.baseSprite) {
                    partDef.baseSprite.draw(renderer.ctx, ghostX, ghostY, this.rotation * (Math.PI / 2));
                } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                    Assets.LongHull.draw(renderer.ctx, ghostX, ghostY, this.rotation * (Math.PI / 2));
                } else {
                    Assets.PlayerBase.draw(renderer.ctx, ghostX, ghostY, 0);
                }
            }

            const angle = this.rotation * (Math.PI / 2);
            const offset = partDef.turretDrawOffset || 0;
            const turretX = ghostX + Math.cos(angle) * offset;
            const turretY = ghostY + Math.sin(angle) * offset;

            partDef.sprite.draw(renderer.ctx, turretX, turretY, angle + (partDef.rotationOffset || 0));

            if (!isValid) {
                renderer.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                renderer.ctx.fillRect(ghostX - halfW, ghostY - halfH, w * CELL_STRIDE, h * CELL_STRIDE);
            }

            renderer.ctx.restore();

            // Logic
            // Input Handling with Drag-Paint Support
            if (this.game.input.isMouseDown()) {
                if (!this.isHoveringUI) {
                    // Left Place
                    // Reset 'lastPlaced' if we released mouse (handled by logic below mostly, 
                    // but we need to track if we moved to a new cell)

                    const currentGridKey = `${gx},${gy}`;

                    // Logic: Attempt place if:
                    // 1. We have inventory
                    // 2. Position is valid
                    // 3. We haven't just placed at this EXACT coordinate in this drag sequence
                    //    (Prevents rapid-fire waste or re-calculations on same spot)

                    if (this.inventory[this.selectedPartId] > 0 && isValid) {
                        // Check if we already placed here this click-hold
                        if (this.lastPlacedGrid !== currentGridKey) {
                            if (this.draftShip.addPart(gx, gy, this.selectedPartId, this.rotation)) {
                                // Only decrement if NOT in infinite mode
                                if (!this.hasInfiniteParts) {
                                    this.inventory[this.selectedPartId]--;
                                }
                                this.updateUI();
                                this.lastPlacedGrid = currentGridKey; // Mark this cell as handled
                            }
                        }
                    }
                }
            } else if (this.game.input.isRightMouseDown()) {
                if (!this.isHoveringUI) {
                    // Right Remove
                    const rGx = Math.round(localX / CELL_STRIDE);
                    const rGy = Math.round(localY / CELL_STRIDE);
                    const currentGridKey = `${rGx},${rGy}`;

                    if (this.lastPlacedGrid !== currentGridKey) {
                        const existing = this.draftShip.getPart(rGx, rGy);
                        if (existing && existing.partId !== 'core') {
                            this.draftShip.removePart(rGx, rGy);
                            this.inventory[existing.partId] = (this.inventory[existing.partId] || 0) + 1;
                            this.updateUI();
                            this.lastPlacedGrid = currentGridKey;
                        }
                    }
                }
            } else {
                // Mouse Released
                this.lastPlacedGrid = null;
            }
        }

        renderer.ctx.restore();

        // UI Overlay for "DRAFT MODE"
        renderer.ctx.fillStyle = "yellow";
        renderer.ctx.font = "16px 'Press Start 2P'";
        renderer.ctx.fillText("hangar mode - editing draft", 20, renderer.height - 20);
    }
}
