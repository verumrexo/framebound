import { Assets } from '../../Assets.js';
import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';
import { Ship } from '../../shared/entities/Ship.js';
import { Hangar } from './Hangar.js';
import { UI_FONTS } from '../ui/UiTheme.js';

export class ShipBuilder {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.selectedPartId = 'hull';
        this.rotation = 0;
        this.rotateDebounce = false;
        this.draftShip = null;
        this.turretEditorMode = false; // New toggle for turret editor

        // Infinite inventory - one of each part
        this.inventory = {};
        for (const key of Object.keys(PartsLibrary)) {
            this.inventory[key] = 999;
        }
        // Create UI
        this.ui = document.createElement('div');
        this.ui.id = 'ship-builder-ui';
        this.ui.style.display = 'none';
        this.ui.innerHTML = `
            <div class="workshop-layout">
                <section id="builder-controls" class="workshop-panel builder-controls">
                    <div class="ui-kicker">development frame tools</div>
                    <div class="workshop-title">builder</div>
                    <button id="builder-import" class="builder-action">import</button>
                    <button id="builder-export" class="builder-action">export</button>
                    <button id="builder-clear" class="builder-action">clear</button>
                    <button id="builder-turret-toggle" class="builder-action">turret mode</button>
                    <div class="ui-note">
                        r // rotate<br>
                        lmb // place<br>
                        rmb // remove<br>
                        m // close
                    </div>
                </section>

                <section class="workshop-panel workshop-inventory">
                    <div class="ui-kicker">unlimited development inventory</div>
                    <div class="workshop-title">parts library</div>
                    <div id="builder-part-list" class="workshop-list"></div>
                </section>
            </div>
        `;
        document.body.appendChild(this.ui);

        // Track hover
        this.isHoveringUI = false;
        this.ui.onmouseenter = () => this.isHoveringUI = true;
        this.ui.onmouseleave = () => this.isHoveringUI = false;

        this.ui.addEventListener('mousedown', (e) => e.stopPropagation());
        this.ui.addEventListener('mouseup', (e) => e.stopPropagation());
        this.ui.addEventListener('click', (e) => e.stopPropagation());
        this.ui.addEventListener('contextmenu', (e) => e.stopPropagation());
        // Tooltip (reuse Hangar's style)
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'workshop-tooltip';
        document.body.appendChild(this.tooltip);

        window.addEventListener('mousemove', (e) => {
            if (!this.active || this.tooltip.style.display === 'none') return;

            // Keep tooltip on screen
            const maxWidth = 150;
            const padding = 15;
            let x = e.clientX + padding;
            let y = e.clientY + padding;

            // If too close to right edge, show on left of cursor
            if (x + maxWidth > window.innerWidth) {
                x = e.clientX - maxWidth - padding;
            }

            // If too close to bottom, show above cursor
            if (y + 200 > window.innerHeight) {
                y = e.clientY - 200;
            }

            this.tooltip.style.left = Math.max(10, x) + 'px';
            this.tooltip.style.top = Math.max(10, y) + 'px';
            this.tooltip.style.maxWidth = maxWidth + 'px';
            this.tooltip.style.wordWrap = 'break-word';
        });

        this.setupButtons();
    }

    setupButtons() {
        const importBtn = this.ui.querySelector('#builder-import');
        const exportBtn = this.ui.querySelector('#builder-export');
        const clearBtn = this.ui.querySelector('#builder-clear');
        const turretToggle = this.ui.querySelector('#builder-turret-toggle');

        if (importBtn) {
            importBtn.onclick = (e) => {
                e.stopPropagation();
                this.importJSON();
            };
        }

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

        if (turretToggle) {
            turretToggle.onclick = (e) => {
                e.stopPropagation();
                this.turretEditorMode = !this.turretEditorMode;
                this.syncTurretToggle();
                this.game.showNotification(
                    this.turretEditorMode ? 'turret editor enabled' : 'turret editor disabled',
                    this.turretEditorMode ? '#4f4' : '#fa4'
                );
            };
        }
    }

    syncTurretToggle() {
        const turretToggle = this.ui?.querySelector?.('#builder-turret-toggle');
        if (!turretToggle) return;

        turretToggle.textContent = this.turretEditorMode
            ? 'turret mode // active'
            : 'turret mode // off';
        turretToggle.className = this.turretEditorMode
            ? 'builder-action is-selected'
            : 'builder-action';
    }

    placeAtGhost() {
        if (!this.ghostGrid) return;
        const { x, y } = this.ghostGrid;

        // Check validity again just in case
        if (this.draftShip.canPlaceAt(x, y, this.selectedPartId, this.rotation)) {
            this.draftShip.addPart(x, y, this.selectedPartId, this.rotation);
            this.game.audio.play('click_short');
            // No lastPlacedGrid check needed for button tapping
        } else {
            const conflict = this.draftShip.getUniqueGroupConflict?.(this.selectedPartId);
            this.game.showNotification(
                conflict?.uniqueGroup === 'doctrine'
                    ? `${conflict.name.toLowerCase()} already controls this ship`
                    : "can't place here!",
                '#ff4444'
            );
        }
    }

    removeAtGhost() {
        if (!this.ghostGrid) return;
        const { x, y } = this.ghostGrid;
        const existing = this.draftShip.getPart(x, y);
        if (existing && existing.partId !== 'core') {
            this.draftShip.removePart(x, y);
            this.game.audio.play('click_short');
        }
    }

    importJSON() {
        const json = prompt('Paste ship JSON:');
        if (!json) return;

        try {
            const data = JSON.parse(json);
            if (!data.parts || !Array.isArray(data.parts)) {
                this.game.showNotification('invalid json format!', '#ff4444');
                return;
            }

            // Clear current ship
            this.clearShip();

            // Import all parts
            let importedCount = 0;
            for (const part of data.parts) {
                if (part.partId && typeof part.x === 'number' && typeof part.y === 'number') {
                    const rotation = part.rotation || 0;
                    if (this.draftShip.addPart(part.x, part.y, part.partId, rotation)) {
                        importedCount++;
                    }
                }
            }

            this.game.showNotification(`imported ${importedCount} parts!`, '#4f4');
        } catch (err) {
            console.error('Import error:', err);
            this.game.showNotification('failed to parse json!', '#ff4444');
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
            const def = PartsLibrary[part.partId];
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
        const allParts = PartsLibrary;

        Object.keys(allParts).forEach(key => {
            const def = allParts[key];
            if (!def) return;

            const itemWrapper = document.createElement('div');
            const spanW = def.width || 1;
            const spanH = def.height || 1;
            itemWrapper.className = [
                'builder-inventory-item',
                this.selectedPartId === key ? 'is-selected' : ''
            ].filter(Boolean).join(' ');
            itemWrapper.style.gridColumn = `span ${spanW}`;
            itemWrapper.style.gridRow = `span ${spanH}`;
            itemWrapper.style.width = `${spanW * 64}px`;
            itemWrapper.style.height = `${spanH * 64}px`;

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
                Hangar.updateTooltip(this.tooltip, def, this.draftShip);
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

    resetRunState() {
        this.active = false;
        this.ui.style.display = 'none';
        this.tooltip.style.display = 'none';
        this.isHoveringUI = false;
        this.selectedPartId = 'hull';
        this.rotation = 0;
        this.rotateDebounce = false;
        this.lastPlacedGrid = null;
        this.ghostGrid = null;
        this.draftShip = null;
        this.turretEditorMode = false;
        this.syncTurretToggle();
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

        // Draw Modal Background
        renderer.ctx.fillStyle = 'rgba(10,10,20,0.97)';
        renderer.ctx.fillRect(0, 0, renderer.width, renderer.height);

        const centerX = renderer.width / 2;
        const centerY = renderer.height / 2;

        renderer.ctx.save();
        renderer.ctx.translate(centerX, centerY);

        // Adjust offset if in turret editor mode (show two grids side by side)
        const gridOffset = this.turretEditorMode ? -200 : 0;
        const secondGridOffset = this.turretEditorMode ? 200 : 0;

        // Draw Grid(s)
        const CELL_STRIDE = TILE_SIZE;
        const gridSize = 10;

        const drawGrid = (offsetX, label) => {
            renderer.ctx.save();
            renderer.ctx.translate(offsetX, 0);

            // Draw label for grid
            if (label) {
                renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                renderer.ctx.fillRect(-CELL_STRIDE * 5, -CELL_STRIDE * 6 - 40, CELL_STRIDE * 10, 35);
                renderer.ctx.fillStyle = '#89a889';
                renderer.ctx.font = UI_FONTS.label;
                renderer.ctx.textAlign = 'center';
                renderer.ctx.fillText(label, 0, -CELL_STRIDE * 6 - 15);
            }

            // Draw subtle grid lines
            renderer.ctx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
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

            // Draw center crosshair
            renderer.ctx.strokeStyle = 'rgba(150, 150, 200, 0.5)';
            renderer.ctx.lineWidth = 2;
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(-20, 0);
            renderer.ctx.lineTo(20, 0);
            renderer.ctx.moveTo(0, -20);
            renderer.ctx.lineTo(0, 20);
            renderer.ctx.stroke();

            renderer.ctx.restore();
        };

        // Draw grid(s)
        if (this.turretEditorMode) {
            drawGrid(gridOffset, 'base hull');
            drawGrid(secondGridOffset, 'turret');
        } else {
            drawGrid(0, null);

            // Draw Prominent Front Direction Indicator (only in normal mode)
            const arrowX = 120;
            const arrowY = 0;
            const arrowSize = 60;

            // Draw arrow background
            renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            renderer.ctx.fillRect(arrowX - 10, arrowY - 30, arrowSize + 80, 60);

            // Draw animated arrow (pulse effect based on time)
            const pulseScale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
            renderer.ctx.save();
            renderer.ctx.translate(arrowX + arrowSize / 2, arrowY);
            renderer.ctx.scale(pulseScale, pulseScale);

            renderer.ctx.strokeStyle = '#ffaa00';
            renderer.ctx.fillStyle = '#ffaa00';
            renderer.ctx.lineWidth = 4;
            renderer.ctx.lineCap = 'round';
            renderer.ctx.lineJoin = 'round';

            renderer.ctx.beginPath();
            renderer.ctx.moveTo(-arrowSize / 2, 0);
            renderer.ctx.lineTo(arrowSize / 2 - 15, 0);
            renderer.ctx.stroke();

            // Arrow head
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(arrowSize / 2, 0);
            renderer.ctx.lineTo(arrowSize / 2 - 20, -12);
            renderer.ctx.lineTo(arrowSize / 2 - 20, 12);
            renderer.ctx.closePath();
            renderer.ctx.fill();

            renderer.ctx.restore();

            // Draw label with background
            renderer.ctx.fillStyle = '#ffaa00';
            renderer.ctx.font = UI_FONTS.label;
            renderer.ctx.textAlign = 'left';
            renderer.ctx.fillText('front', arrowX + arrowSize + 20, arrowY + 5);
        }

        // Draw Ship Parts
        for (const partRef of this.draftShip.getUniqueParts()) {
            const def = PartsLibrary[partRef.partId];
            if (def) {
                const isRotated = ((partRef.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;
                const drawX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
                const drawY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

                if (def.baseSprite) {
                    def.baseSprite.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                    Assets.LongHull.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else {
                    Assets.PlayerBase.draw(renderer.ctx, drawX, drawY, 0, 0.5, 0.5);
                }

                const angle = (partRef.rotation || 0) * (Math.PI / 2);
                const offset = def.turretDrawOffset || 0;
                const turretX = drawX + Math.cos(angle) * offset;
                const turretY = drawY + Math.sin(angle) * offset;
                def.sprite.draw(renderer.ctx, turretX, turretY, angle + (def.rotationOffset || 0), null, null);
            }
        }

        // Ghost Preview
        const mouse = this.game.input.getMousePos();
        const localX = mouse.x - centerX;
        const localY = mouse.y - centerY;

        const partDef = PartsLibrary[this.selectedPartId];
        if (partDef) {
            const isRotated = (this.rotation % 2 !== 0);
            const w = isRotated ? partDef.height : partDef.width;
            const h = isRotated ? partDef.width : partDef.height;

            const gx = Math.round(localX / CELL_STRIDE - (w - 1) / 2);
            const gy = Math.round(localY / CELL_STRIDE - (h - 1) / 2);

            // Store for Button Actions
            this.ghostGrid = { x: gx, y: gy };

            const isValid = this.draftShip.canPlaceAt(gx, gy, this.selectedPartId, this.rotation);

            renderer.ctx.save();
            renderer.ctx.globalAlpha = isValid ? 0.6 : 0.3;

            const ghostX = (gx + (w - 1) / 2) * CELL_STRIDE;
            const ghostY = (gy + (h - 1) / 2) * CELL_STRIDE;

            if (partDef.type === 'weapon') {
                if (partDef.baseSprite) {
                    partDef.baseSprite.draw(renderer.ctx, ghostX, ghostY, this.rotation * (Math.PI / 2), 0.5, 0.5);
                } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                    Assets.LongHull.draw(renderer.ctx, ghostX, ghostY, this.rotation * (Math.PI / 2), 0.5, 0.5);
                } else {
                    Assets.PlayerBase.draw(renderer.ctx, ghostX, ghostY, 0, 0.5, 0.5);
                }
            }

            const angle = this.rotation * (Math.PI / 2);
            const offset = partDef.turretDrawOffset || 0;
            partDef.sprite.draw(renderer.ctx, ghostX + Math.cos(angle) * offset, ghostY + Math.sin(angle) * offset, angle + (partDef.rotationOffset || 0), null, null);

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

    }
}
