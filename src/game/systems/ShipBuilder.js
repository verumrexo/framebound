import { Assets } from '../../Assets.js';
import { PartsLibrary, UserPartsLibrary, TILE_SIZE } from '../parts/Part.js';
import { Ship } from '../entities/Ship.js';
import { Hangar } from './Hangar.js';

export class ShipBuilder {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.selectedPartId = 'hull';
        this.rotation = 0;
        this.rotateDebounce = false;
        this.draftShip = null;

        // Infinite inventory - one of each part
        this.inventory = {};
        for (const key of Object.keys(PartsLibrary)) {
            this.inventory[key] = 999;
        }
        for (const key of Object.keys(UserPartsLibrary)) {
            this.inventory[key] = 999;
        }

        // Create UI
        this.ui = document.createElement('div');
        this.ui.id = 'ship-builder-ui';
        this.ui.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            display: none;
            color: white;
            font-family: 'VT323', monospace;
            font-size: 20px;
            pointer-events: none;
        `;
        this.ui.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <!-- Left Side: Controls -->
                <div id="builder-controls" style="background: rgba(80,0,0,0.9); padding: 15px; border: 2px solid #f44; min-width: 220px; pointer-events: auto;">
                    <div style="color: #f44; font-size: 22px; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px solid #f44;">⚠ DEV TOOL</div>
                    <div style="color: #faa; margin-bottom: 10px;">Ship Builder</div>
                    <button id="builder-export" style="width: 100%; padding: 10px; background: #4a4; color: white; border: none; cursor: pointer; font-family: 'VT323', monospace; font-size: 18px; margin-bottom: 8px;">📋 EXPORT JSON</button>
                    <button id="builder-clear" style="width: 100%; padding: 10px; background: #a44; color: white; border: none; cursor: pointer; font-family: 'VT323', monospace; font-size: 18px;">🗑 CLEAR SHIP</button>
                    <div style="color: #888; font-size: 14px; margin-top: 10px;">
                        R: rotate<br>
                        left click: place<br>
                        right click: remove<br>
                        M: close
                    </div>
                </div>

                <!-- Right Side: Inventory -->
                <div style="background: rgba(0,0,0,0.9); padding: 15px; border: 2px solid #f44; min-width: 400px; max-width: 550px; pointer-events: auto; display: flex; flex-direction: column; max-height: calc(100vh - 40px);">
                    <div style="color: #f44; margin-bottom: 15px; font-size: 24px; border-bottom: 1px solid #f44; padding-bottom: 5px;">all parts (∞)</div>
                    <div id="builder-part-list" style="display: grid; grid-template-columns: repeat(auto-fill, 64px); grid-auto-rows: 64px; gap: 8px; overflow-y: auto; padding-right: 5px;">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.ui);

        // Track hover
        this.isHoveringUI = false;
        this.ui.onmouseenter = () => this.isHoveringUI = true;
        this.ui.onmouseleave = () => this.isHoveringUI = false;

        // Stop events from reaching game
        this.ui.addEventListener('mousedown', (e) => e.stopPropagation());
        this.ui.addEventListener('mouseup', (e) => e.stopPropagation());
        this.ui.addEventListener('click', (e) => e.stopPropagation());
        this.ui.addEventListener('contextmenu', (e) => e.stopPropagation());

        // Tooltip (reuse Hangar's style)
        this.tooltip = document.createElement('div');
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(0,0,0,0.95);
            border: 1px solid #f44;
            padding: 12px;
            color: white;
            font-family: 'VT323', monospace;
            pointer-events: none;
            display: none;
            z-index: 9999;
            min-width: 180px;
        `;
        document.body.appendChild(this.tooltip);

        window.addEventListener('mousemove', (e) => {
            if (!this.active || this.tooltip.style.display === 'none') return;
            this.tooltip.style.left = (e.clientX + 15) + 'px';
            this.tooltip.style.top = (e.clientY + 15) + 'px';
        });

        // Setup buttons after DOM is available
        setTimeout(() => this.setupButtons(), 100);
    }

    setupButtons() {
        const exportBtn = document.getElementById('builder-export');
        const clearBtn = document.getElementById('builder-clear');

        if (exportBtn) {
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                this.exportJSON();
            };
        }

        if (clearBtn) {
            clearBtn.onclick = (e) => {
                e.stopPropagation();
                this.clearShip();
            };
        }
    }

    exportJSON() {
        if (!this.draftShip) return;

        const rawParts = [...this.draftShip.getUniqueParts()];
        if (rawParts.length === 0) {
            this.game.showNotification('no parts to export!', '#f44');
            return;
        }

        // Calculate bounding box to find center
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const part of rawParts) {
            const def = PartsLibrary[part.partId] || UserPartsLibrary[part.partId];
            const isRotated = ((part.rotation || 0) % 2 !== 0);
            const w = isRotated ? (def?.height || 1) : (def?.width || 1);
            const h = isRotated ? (def?.width || 1) : (def?.height || 1);

            minX = Math.min(minX, part.x);
            maxX = Math.max(maxX, part.x + w);
            minY = Math.min(minY, part.y);
            maxY = Math.max(maxY, part.y + h);
        }

        // Center offset (round to nearest integer)
        const centerX = Math.round((minX + maxX) / 2);
        const centerY = Math.round((minY + maxY) / 2);

        // Build centered parts array
        const parts = [];
        for (const part of rawParts) {
            parts.push({
                x: part.x - centerX,
                y: part.y - centerY,
                partId: part.partId,
                rotation: part.rotation || 0
            });
        }

        const json = JSON.stringify({ parts }, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            this.game.showNotification('centered ship json copied!', '#4f4');
        }).catch(() => {
            console.log('Ship JSON:', json);
            this.game.showNotification('check console for json', '#ff4');
        });
    }

    clearShip() {
        this.draftShip = new Ship();
        this.draftShip.parts = new Map();
        this.draftShip.maxHp = 0;
        this.draftShip.hp = 0;
        this.updateUI();
    }

    updateUI() {
        const list = this.ui.querySelector('#builder-part-list');
        if (!list) return;
        list.innerHTML = '';

        // Show one of each part type
        const allParts = { ...PartsLibrary, ...UserPartsLibrary };

        Object.keys(allParts).forEach(key => {
            const def = allParts[key];
            if (!def) return;

            const itemWrapper = document.createElement('div');
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
                border: ${this.selectedPartId === key ? '2px solid #f44' : '1px solid #444'};
            `;

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
                Hangar.updateTooltip(this.tooltip, def);
            };
            itemWrapper.onmouseleave = () => {
                this.tooltip.style.display = 'none';
            };

            list.appendChild(itemWrapper);
        });
    }

    toggle() {
        this.active = !this.active;
        this.ui.style.display = this.active ? 'block' : 'none';

        if (this.active) {
            this.game.paused = true;
            this.draftShip = new Ship();
            this.draftShip.parts = new Map(); // Start completely empty (no core), correct type
            this.draftShip.maxHp = 0; // Reset stats
            this.draftShip.hp = 0;
            this.rotation = 0;
            this.updateUI();
            this.setupButtons();
        } else {
            this.game.paused = false;
            this.draftShip = null;
        }
    }

    update(dt) {
        if (!this.active) return;

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

        // Draw Modal Background (same as Hangar)
        renderer.ctx.fillStyle = 'rgba(40,0,0,0.95)';
        renderer.ctx.fillRect(0, 0, renderer.width, renderer.height);

        const centerX = renderer.width / 2;
        const centerY = renderer.height / 2;

        renderer.ctx.save();
        renderer.ctx.translate(centerX, centerY);

        // Draw Grid
        const CELL_STRIDE = TILE_SIZE;
        const gridSize = 10;
        renderer.ctx.strokeStyle = '#ff4444';  // Bright red
        renderer.ctx.lineWidth = 2;
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

        // Draw Direction Arrow (pointing RIGHT = front)
        renderer.ctx.beginPath();
        renderer.ctx.strokeStyle = '#ffff00';
        renderer.ctx.lineWidth = 3;
        renderer.ctx.moveTo(100, 0);
        renderer.ctx.lineTo(200, 0);
        renderer.ctx.lineTo(175, -15);
        renderer.ctx.moveTo(200, 0);
        renderer.ctx.lineTo(175, 15);
        renderer.ctx.stroke();
        renderer.ctx.fillStyle = '#ffff00';
        renderer.ctx.font = "16px 'VT323'";
        renderer.ctx.textAlign = 'left';
        renderer.ctx.fillText('FRONT', 210, 5);

        // Draw Ship Parts
        for (const partRef of this.draftShip.getUniqueParts()) {
            const def = PartsLibrary[partRef.partId] || UserPartsLibrary[partRef.partId];
            if (def) {
                const isRotated = ((partRef.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;
                const drawX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
                const drawY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

                if (def.type === 'weapon') {
                    if (def.baseSprite) {
                        def.baseSprite.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2));
                    } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                        Assets.LongHull.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2));
                    } else {
                        Assets.PlayerBase.draw(renderer.ctx, drawX, drawY, 0);
                    }
                }

                const angle = (partRef.rotation || 0) * (Math.PI / 2);
                const offset = def.turretDrawOffset || 0;
                const turretX = drawX + Math.cos(angle) * offset;
                const turretY = drawY + Math.sin(angle) * offset;
                def.sprite.draw(renderer.ctx, turretX, turretY, angle + (def.rotationOffset || 0));
            }
        }

        // Ghost Preview
        const mouse = this.game.input.getMousePos();
        const localX = mouse.x - centerX;
        const localY = mouse.y - centerY;

        const partDef = PartsLibrary[this.selectedPartId] || UserPartsLibrary[this.selectedPartId];
        if (partDef) {
            const isRotated = (this.rotation % 2 !== 0);
            const w = isRotated ? partDef.height : partDef.width;
            const h = isRotated ? partDef.width : partDef.height;

            const gx = Math.round(localX / CELL_STRIDE - (w - 1) / 2);
            const gy = Math.round(localY / CELL_STRIDE - (h - 1) / 2);

            const isValid = this.draftShip.canPlaceAt(gx, gy, this.selectedPartId, this.rotation);

            renderer.ctx.save();
            renderer.ctx.globalAlpha = isValid ? 0.6 : 0.3;

            const ghostX = (gx + (w - 1) / 2) * CELL_STRIDE;
            const ghostY = (gy + (h - 1) / 2) * CELL_STRIDE;

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
            partDef.sprite.draw(renderer.ctx, ghostX + Math.cos(angle) * offset, ghostY + Math.sin(angle) * offset, angle + (partDef.rotationOffset || 0));

            if (!isValid) {
                const halfW = (w * CELL_STRIDE) / 2;
                const halfH = (h * CELL_STRIDE) / 2;
                renderer.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                renderer.ctx.fillRect(ghostX - halfW, ghostY - halfH, w * CELL_STRIDE, h * CELL_STRIDE);
            }

            renderer.ctx.restore();

            // Input Handling
            if (this.game.input.isMouseDown() && !this.isHoveringUI) {
                const currentGridKey = `${gx},${gy}`;
                if (isValid && this.lastPlacedGrid !== currentGridKey) {
                    if (this.draftShip.addPart(gx, gy, this.selectedPartId, this.rotation)) {
                        this.lastPlacedGrid = currentGridKey;
                    }
                }
            } else if (this.game.input.isRightMouseDown() && !this.isHoveringUI) {
                const rGx = Math.round(localX / CELL_STRIDE);
                const rGy = Math.round(localY / CELL_STRIDE);
                const currentGridKey = `${rGx},${rGy}`;
                if (this.lastPlacedGrid !== currentGridKey) {
                    const existing = this.draftShip.getPart(rGx, rGy);
                    if (existing && existing.partId !== 'core') {
                        this.draftShip.removePart(rGx, rGy);
                        this.lastPlacedGrid = currentGridKey;
                    }
                }
            } else {
                this.lastPlacedGrid = null;
            }
        }

        renderer.ctx.restore();

        // Title
        renderer.ctx.fillStyle = "#f44";
        renderer.ctx.font = "bold 28px 'VT323'";
        renderer.ctx.fillText("⚠ SHIP BUILDER - DEV TOOL ⚠", 20, renderer.height - 20);
    }
}
