
import { Assets, AssetsData } from '../../Assets.js';
import { PartsLibrary, PartDef, PartType, TILE_SIZE } from '../../shared/parts/Part.js';
import { Sprite } from '../../engine/Sprite.js';
import { parsePartStatsLiteral } from '../dev/PartStatsParser.js';

export class Designer {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.gridData = [];
        this.turretGridData = []; // Separate grid for turret
        this.turretMode = false; // Toggle for turret editor
        this.currentSize = [1, 1]; // Width, Height in tiles

        // UI Container
        this.ui = document.createElement('div');
        Object.assign(this.ui.style, {
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            display: 'none', background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            border: '3px solid #4a9eff', padding: '25px', borderRadius: '8px',
            textAlign: 'center', boxShadow: '0 0 30px rgba(74, 158, 255, 0.4)', zIndex: 1000,
            fontFamily: "'Press Start 2P', monospace", fontSize: "18px"
        });

        this.ui.innerHTML = `
            <h3 style="color:#4a9eff; margin-top:0; text-shadow: 0 0 10px rgba(74, 158, 255, 0.5);">⚙ part designer</h3>
            
            <div style="margin-bottom:15px; display:flex; gap:10px; justify-content:center; align-items:center;">
                <input type="text" id="design-name" placeholder="part name" value="my part" 
                    style="background:#0f3460; border:2px solid #4a9eff; color:#fff; padding:8px; font-family:inherit; font-size:14px; border-radius:4px;">
                
                <select id="design-size" style="background:#0f3460; border:2px solid #4a9eff; color:#fff; padding:8px; font-family:inherit; font-size:14px; border-radius:4px;">
                    <option value="1x1">1x1 (standard)</option>
                    <option value="1x2">1x2 (vertical)</option>
                    <option value="2x2">2x2 (large)</option>
                    <option value="2x4">2x4 (legendary)</option>
                </select>

                <select id="turret-facing" style="background:#0f3460; border:2px solid #ff9944; color:#fff; padding:8px; font-family:inherit; font-size:14px; border-radius:4px; display:none;">
                    <option value="0">Face: Right (0°)</option>
                    <option value="1.5708">Face: Down (90°)</option>
                    <option value="3.1416">Face: Left (180°)</option>
                    <option value="4.7124">Face: Up (270°)</option>
                </select>
            </div>
            
            <div style="margin-bottom:15px; display:flex; gap:20px; justify-content:center;">
                <label style="color:#aabbff; font-size:14px; cursor:pointer; user-select:none;">
                    <input type="checkbox" id="turret-mode" style="margin-right:8px; cursor:pointer;">
                    🔧 turret editor (base + turret)
                </label>
                <label style="color:#ff77ff; font-size:14px; cursor:pointer; user-select:none;">
                    <input type="checkbox" id="pivot-mode" style="margin-right:8px; cursor:pointer;">
                    📍 set rotation point
                </label>
                <label style="color:#ffaa00; font-size:14px; cursor:pointer; user-select:none;">
                    <input type="checkbox" id="barrel-mode" style="margin-right:8px; cursor:pointer;">
                    🔫 set barrel
                </label>
            </div>

            <div id="canvas-container" style="position:relative; display:flex; gap:20px; justify-content:center;">
                <div style="position:relative;">
                    <div id="base-label" style="color:#4a9eff; font-size:12px; margin-bottom:5px; display:none;">BASE/HULL</div>
                    <canvas id="designerCanvas" style="border:2px solid #4a9eff; image-rendering: pixelated; cursor: crosshair; display:block; background:#000; border-radius:4px; box-shadow: 0 0 15px rgba(74, 158, 255, 0.3);"></canvas>
                </div>
                <div id="turret-canvas-wrapper" style="position:relative; display:none;">
                    <div style="color:#ff9944; font-size:12px; margin-bottom:5px;">TURRET</div>
                    <canvas id="turretCanvas" style="border:2px solid #ff9944; image-rendering: pixelated; cursor: crosshair; display:block; background:#000; border-radius:4px; box-shadow: 0 0 15px rgba(255, 153, 68, 0.3);"></canvas>
                </div>
            </div>

            <div style="margin-top:15px;">
                <button id="btn-save" style="padding: 10px 20px; cursor: pointer; background:linear-gradient(135deg, #28a745, #20c997); color:white; border:none; font-family:inherit; font-size: 16px; border-radius:4px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: transform 0.1s;">💾 save new</button>
                <button id="btn-import" style="padding: 10px 20px; cursor: pointer; background:linear-gradient(135deg, #4a9eff, #007bff); color:white; border:none; font-family:inherit; font-size: 16px; border-radius:4px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: transform 0.1s;">📂 import</button>
                <button id="btn-cancel" style="padding: 10px 20px; cursor: pointer; background:linear-gradient(135deg, #dc3545, #c82333); color:white; border:none; font-family:inherit; font-size: 16px; border-radius:4px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: transform 0.1s;">✖ cancel</button>
            </div>
            <div style="color:#8899bb; font-size: 14px; margin-top:10px;">left-click: paint | right-click: erase | <span id="facing-indicator" style="color:#ffaa00;">→ front</span></div>
        `;
        document.body.appendChild(this.ui);

        this.canvas = this.ui.querySelector('#designerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.turretCanvas = this.ui.querySelector('#turretCanvas');
        this.turretCtx = this.turretCanvas.getContext('2d');
        this.nameInput = this.ui.querySelector('#design-name');
        this.sizeSelect = this.ui.querySelector('#design-size');
        this.turretModeCheckbox = this.ui.querySelector('#turret-mode');
        this.pivotModeCheckbox = this.ui.querySelector('#pivot-mode');
        this.barrelModeCheckbox = this.ui.querySelector('#barrel-mode');
        this.facingSelect = this.ui.querySelector('#turret-facing');

        // Events
        this.ui.querySelector('#btn-save').onclick = () => this.save();
        this.ui.querySelector('#btn-import').onclick = () => this.importCode();
        this.ui.querySelector('#btn-cancel').onclick = () => this.close();
        this.sizeSelect.onchange = () => this.resizeGrid();
        this.turretModeCheckbox.onchange = () => this.toggleTurretMode();
        this.pivotModeCheckbox.onchange = () => { this.pivotMode = this.pivotModeCheckbox.checked; this.barrelMode = false; this.barrelModeCheckbox.checked = false; };
        this.barrelModeCheckbox.onchange = () => { this.barrelMode = this.barrelModeCheckbox.checked; this.pivotMode = false; this.pivotModeCheckbox.checked = false; };
        this.facingSelect.onchange = () => this.drawGrid(); // Update arrows

        // Painting
        let isDrawing = false;
        this.pivotMode = false;
        this.barrelMode = false;
        this.basePivot = null; // {x, y}
        this.turretPivot = null; // {x, y}
        this.barrelPos = null; // {x, y} - barrel spawn point on turret

        const handleInput = (e, canvas, gridData, isTurret) => {
            const rect = canvas.getBoundingClientRect();
            const scale = 32;

            if (this.pivotMode) {
                // Pivot Mode: Allow selecting intersections (0.5 coordinates)
                if (e.type === 'mousedown') {
                    // Get raw local coordinate
                    const rawX = (e.clientX - rect.left) / scale;
                    const rawY = (e.clientY - rect.top) / scale;

                    // Snap to nearest 0.5
                    const snapX = Math.round(rawX * 2) / 2;
                    const snapY = Math.round(rawY * 2) / 2;

                    if (isTurret) this.turretPivot = { x: snapX, y: snapY };
                    else this.basePivot = { x: snapX, y: snapY };
                    this.drawGrid();
                }
            } else if (this.barrelMode && isTurret) {
                // Barrel Mode: Set barrel position on turret canvas only
                if (e.type === 'mousedown') {
                    const rawX = (e.clientX - rect.left) / scale;
                    const rawY = (e.clientY - rect.top) / scale;

                    // Snap to nearest 0.5
                    const snapX = Math.round(rawX * 2) / 2;
                    const snapY = Math.round(rawY * 2) / 2;

                    this.barrelPos = { x: snapX, y: snapY };
                    this.drawGrid();
                }
            } else {
                // Paint Mode: Grid Cells (Integer coordinates)
                const x = Math.floor((e.clientX - rect.left) / scale);
                const y = Math.floor((e.clientY - rect.top) / scale);

                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    if (e.buttons === 1 || e.buttons === 2) { // Allow right click drag too
                        const val = e.buttons === 1 ? 1 : 0;
                        gridData[y * this.gridWidth + x] = val;
                        this.drawGrid();
                    }
                }
            }
        };

        this.canvas.onmousedown = (e) => { isDrawing = true; handleInput(e, this.canvas, this.gridData, false); };
        this.canvas.onmousemove = (e) => { if (isDrawing && !this.pivotMode) handleInput(e, this.canvas, this.gridData, false); };
        this.canvas.oncontextmenu = (e) => e.preventDefault();

        this.turretCanvas.onmousedown = (e) => { isDrawing = true; handleInput(e, this.turretCanvas, this.turretGridData, true); };
        this.turretCanvas.onmousemove = (e) => { if (isDrawing && !this.pivotMode) handleInput(e, this.turretCanvas, this.turretGridData, true); };
        this.turretCanvas.oncontextmenu = (e) => e.preventDefault();

        window.addEventListener('mouseup', () => { isDrawing = false; });

    }

    open(basePartId) {
        // Reset to default new state or load existing if we support editing later
        this.active = true;
        this.ui.style.display = 'block';
        this.resizeGrid();
        this.game.input.active = false;
    }

    toggleTurretMode() {
        this.turretMode = this.turretModeCheckbox.checked;
        const turretWrapper = this.ui.querySelector('#turret-canvas-wrapper');
        const baseLabel = this.ui.querySelector('#base-label');
        const facingContainer = this.ui.querySelector('#turret-facing');
        const indic = this.ui.querySelector('#facing-indicator');

        if (this.turretMode) {
            turretWrapper.style.display = 'block';
            baseLabel.style.display = 'block';
            facingContainer.style.display = 'block';
            indic.style.display = 'inline';
        } else {
            turretWrapper.style.display = 'none';
            baseLabel.style.display = 'none';
            facingContainer.style.display = 'none';
            indic.style.display = 'none';
        }
    }

    resizeGrid() {
        const val = this.sizeSelect.value;
        if (val === '1x1') {
            this.currentSize = [1, 1];
            this.gridWidth = 8;
            this.gridHeight = 8;
        } else if (val === '1x2') {
            this.currentSize = [1, 2];
            this.gridWidth = 8;
            this.gridHeight = 15; // 8*2 - 1 = 15
        } else if (val === '2x2') {
            this.currentSize = [2, 2];
            this.gridWidth = 15; // 8*2 - 1 = 15
            this.gridHeight = 15;
        } else if (val === '2x4') {
            this.currentSize = [2, 4];
            this.gridWidth = 15; // 8*2 - 1 = 15
            this.gridHeight = 29; // 8*4 - 3 = 29
        }

        // Reset data
        this.gridData = new Array(this.gridWidth * this.gridHeight).fill(0);
        this.turretGridData = new Array(this.gridWidth * this.gridHeight).fill(0);
        this.basePivot = null;
        this.turretPivot = null;
        this.barrelPos = null;

        // Resize both canvases (scale 32x)
        this.canvas.width = this.gridWidth * 32;
        this.canvas.height = this.gridHeight * 32;
        this.canvas.style.width = (this.gridWidth * 32) + 'px';
        this.canvas.style.height = (this.gridHeight * 32) + 'px';

        this.turretCanvas.width = this.gridWidth * 32;
        this.turretCanvas.height = this.gridHeight * 32;
        this.turretCanvas.style.width = (this.gridWidth * 32) + 'px';
        this.turretCanvas.style.height = (this.gridHeight * 32) + 'px';

        this.drawGrid();
    }

    close() {
        this.active = false;
        this.ui.style.display = 'none';
        this.game.input.active = true;
    }

    importCode() {
        const code = prompt("paste part code here:");
        if (!code) return;

        try {
            // 1. Extract Sprite Data
            // Searching for `new Sprite([0, 1, ...]`
            const spriteRegex = /new Sprite\(\[([0-9,\s]+)\]/g;
            const matches = [...code.matchAll(spriteRegex)];

            if (matches.length === 0) {
                alert("no sprite data found in code.");
                return;
            }

            // Determine if Turret Mode (2 sprites) or Hull Mode (1 sprite)
            let isTurretPart = matches.length >= 2;
            let turretData = [];
            let baseData = [];

            if (isTurretPart) {
                // First match is Turret (ts), Second is Base (bs/baseSprite) typically
                // Based on generation order:
                // const ts = new Sprite(turret...)
                // const bs = new Sprite(base...)
                turretData = matches[0][1].split(',').map(Number);
                baseData = matches[1][1].split(',').map(Number);
            } else {
                // Just hull
                baseData = matches[0][1].split(',').map(Number);
            }

            // 2. Extract Dimensions
            const dimMatch = code.match(/, ([0-9]+), ([0-9]+)\)/); // width, height from PartDef
            // Fallback: Infer from array length assuming square-ish or standard size
            // Actually, PartDef line has `, width, height`.
            // Let's rely on user selecting size manually OR try to detect grid size.

            // Auto-detect size from array length?
            // 64 -> 8x8
            // 120 -> 8x15? (8*15=120)
            // 225 -> 15x15
            // 435 -> 15x29 (15*29=435)

            const len = isTurretPart ? turretData.length : baseData.length;
            let size = '1x1';
            let gw = 8, gh = 8;

            if (len === 64) { size = '1x1'; gw = 8; gh = 8; }
            else if (len === 120) { size = '1x2'; gw = 8; gh = 15; }
            else if (len === 225) { size = '2x2'; gw = 15; gh = 15; }
            else if (len === 435) { size = '2x4'; gw = 15; gh = 29; }
            else {
                alert(`unknown grid size (length ${len}). select size manually before importing.`);
                // We'll proceed with current size if it matches length
                gw = this.gridWidth;
                gh = this.gridHeight;
            }

            // Set UI
            this.sizeSelect.value = size;
            this.currentSize = size.split('x').map(Number);
            this.gridWidth = gw;
            this.gridHeight = gh;

            // Resize (clears data)
            this.resizeGrid();

            // Restore Data
            if (isTurretPart) {
                this.turretGridData = turretData;
                this.gridData = baseData;
                this.turretModeCheckbox.checked = true;
            } else {
                this.gridData = baseData;
                this.turretModeCheckbox.checked = false;
            }
            this.toggleTurretMode();

            // 3. Extract Rotation Offset
            const rotMatch = code.match(/rotationOffset\s*=\s*([0-9.-]+)/);
            if (rotMatch) {
                const rot = parseFloat(rotMatch[1]);
                // Snap to nearest option
                let bestVal = "0";
                let minDiff = 999;
                [0, 1.5708, 3.1416, 4.7124].forEach(v => {
                    const diff = Math.abs(v - rot);
                    if (diff < minDiff) { minDiff = diff; bestVal = v.toString(); }
                });
                this.facingSelect.value = bestVal;
            } else {
                this.facingSelect.value = "0";
            }

            // 4. Extract Anchors (Pivots)
            // Looking for `undefined, ax, ay` pattern in Sprite constructor
            // code: new Sprite(..., undefined, undefined, 0.5, 0.5)
            const anchorRegex = /undefined,\s*undefined,\s*([0-9.]+),\s*([0-9.]+)/g;
            const anchorMatches = [...code.matchAll(anchorRegex)];

            if (anchorMatches.length > 0) {
                // If turret part: First match is Turret, Second is Base
                if (isTurretPart) {
                    if (anchorMatches[0]) {
                        const ax = parseFloat(anchorMatches[0][1]);
                        const ay = parseFloat(anchorMatches[0][2]);
                        this.turretPivot = { x: ax * this.gridWidth, y: ay * this.gridHeight }; // Convert back to px
                    }
                    if (anchorMatches[1]) {
                        const ax = parseFloat(anchorMatches[1][1]);
                        const ay = parseFloat(anchorMatches[1][2]);
                        this.basePivot = { x: ax * this.gridWidth, y: ay * this.gridHeight };
                    }
                } else {
                    // Hull part (only 1 sprite usually, but could have anchor)
                    if (anchorMatches[0]) {
                        const ax = parseFloat(anchorMatches[0][1]);
                        const ay = parseFloat(anchorMatches[0][2]);
                        this.basePivot = { x: ax * this.gridWidth, y: ay * this.gridHeight }; // Not standard for Hull but possible
                    }
                }
            }

            // 5. Extract Stats Object
            // Match the object passed to PartDef: PartDef(..., { key: val, ... }, ...)
            // We look for the starting `{` after the Sprite argument(s).
            // A safer bet is to look for the `new PartDef` line and parse args.
            // But regex for balanced braces is hard.
            // We'll search for the first `{` that contains familiar keys like "hp", "mass" or just after the sprite matches.

            // Regex to find the stats block:  , { ... },
            // It usually appears before width/height arguments at the end of PartDef.
            // Let's try to match the substring between the last Sprite closing `)` and the size args `, w, h`.

            const statsMatch = code.match(/PartDef\([^{]+(\{[\s\S]+?\})\s*,/);
            if (statsMatch) {
                const parsedStats = parsePartStatsLiteral(statsMatch[1]);
                if (parsedStats) {
                    this.importedStats = parsedStats;
                    console.log("Imported Stats:", this.importedStats);
                } else {
                    console.warn("Failed to parse stats object from code");
                    this.importedStats = null;
                }
            } else {
                this.importedStats = null;
            }

            // 6. Extract Barrel Offset
            // Check barrelPosition in stats first (new format)
            if (this.importedStats && this.importedStats.barrelPosition) {
                const bx = this.importedStats.barrelPosition.x;
                const by = this.importedStats.barrelPosition.y;
                const centerX = this.gridWidth / 2;
                const centerY = this.gridHeight / 2;
                this.barrelPos = {
                    x: centerX + bx / 4,
                    y: centerY + by / 4
                };
            } else {
                // Fallback to legacy format (turretDrawOffset)
                const barrelMatch = code.match(/turretDrawOffset\s*=\s*\{\s*x:\s*([0-9.-]+)\s*,\s*y:\s*([0-9.-]+)\s*\}/);
                if (barrelMatch) {
                    const bx = parseFloat(barrelMatch[1]);
                    const by = parseFloat(barrelMatch[2]);
                    // Convert from offset to grid position
                    const centerX = this.gridWidth / 2;
                    const centerY = this.gridHeight / 2;
                    this.barrelPos = {
                        x: centerX + bx / 4, // Divide by pixel size (4)
                        y: centerY + by / 4
                    };
                } else {
                    this.barrelPos = null;
                }
            }

            // Draw
            this.drawGrid();
            alert("imported successfully!");

        } catch (e) {
            console.error(e);
            alert("failed to parse code. check console.");
        }
    }

    save() {
        const name = this.nameInput.value;
        const id = 'custom_' + Date.now();
        const width = this.currentSize[0];
        const height = this.currentSize[1];
        const rotOffset = parseFloat(this.facingSelect.value) || 0;

        // Re-encode grid to arrays
        if (!window.AssetsData) window.AssetsData = {};
        AssetsData[id] = [...this.turretGridData];
        AssetsData[id + '_base'] = [...this.gridData];

        let code = '';

        // Construct Stat String
        let statsObj = { hp: 20 * width * height, mass: 2 * width * height };
        // Merge imported stats if they exist, but recalculate hp/mass if size changed?
        // User probably keeps custom stats (damage etc).
        if (this.importedStats) {
            statsObj = { ...statsObj, ...this.importedStats };
        }

        // Format stats nicely
        const statsStr = JSON.stringify(statsObj).replace(/"([^"]+)":/g, '$1:'); // Remove quotes from keys for JS style

        if (this.turretMode) {
            // Save with both baseSprite and turret sprite (for weapons)
            // AssetsData[id + '_base'] = [...this.gridData]; // Moved above
            // AssetsData[id] = [...this.turretGridData]; // Moved above

            const baseSprite = new Sprite(AssetsData[id + '_base'], this.gridWidth, this.gridHeight, 4, { 1: '#26d426', 2: '#333' });
            if (this.basePivot) {
                baseSprite.anchorX = this.basePivot.x / this.gridWidth;
                baseSprite.anchorY = this.basePivot.y / this.gridHeight;
            }

            const turretSprite = new Sprite(AssetsData[id], this.gridWidth, this.gridHeight, 4, { 1: '#26d426', 2: '#333' });
            if (this.turretPivot) {
                turretSprite.anchorX = this.turretPivot.x / this.gridWidth;
                turretSprite.anchorY = this.turretPivot.y / this.gridHeight;
            }

            const def = new PartDef(id, name, PartType.WEAPON, turretSprite, statsObj, width, height);
            def.baseSprite = baseSprite;
            def.drawTurretInInventory = true;
            def.rotationOffset = rotOffset;
            if (this.barrelPos) {
                // Convert barrel position to offset from turret pivot (or center)
                const px = this.turretPivot ? this.turretPivot.x : this.gridWidth / 2;
                const py = this.turretPivot ? this.turretPivot.y : this.gridHeight / 2;
                def.stats.barrelPosition = {
                    x: (this.barrelPos.x - px) * 4, // Scale by pixel size (4)
                    y: (this.barrelPos.y - py) * 4
                };
                def.turretDrawOffset = 0; // Don't shift sprite from pivot
            } else {
                def.turretDrawOffset = 0;
            }
            PartsLibrary[id] = def;

            if (this.game.hangar) {
                this.game.hangar.inventory[id] = 10;
                this.game.hangar.updateUI();
            }

            // Code generation
            const baseDataStr = JSON.stringify(this.gridData);
            const turretDataStr = JSON.stringify(this.turretGridData);

            let tAnch = '', bAnch = '';
            if (this.turretPivot) {
                const ax = this.turretPivot.x / this.gridWidth;
                const ay = this.turretPivot.y / this.gridHeight;
                tAnch = `, ${ax.toFixed(3)}, ${ay.toFixed(3)}`;
            }
            if (this.basePivot) {
                const ax = this.basePivot.x / this.gridWidth;
                const ay = this.basePivot.y / this.gridHeight;
                bAnch = `, ${ax.toFixed(3)}, ${ay.toFixed(3)}`;
            }

            // Generate stats string with barrelPosition
            let statsStr = JSON.stringify(statsObj);
            if (this.barrelPos) {
                const px = this.turretPivot ? this.turretPivot.x : this.gridWidth / 2;
                const py = this.turretPivot ? this.turretPivot.y : this.gridHeight / 2;
                const bx = ((this.barrelPos.x - px) * 4).toFixed(1);
                const by = ((this.barrelPos.y - py) * 4).toFixed(1);
                statsStr = statsStr.slice(0, -1) + `, barrelPosition: { x: ${bx}, y: ${by} }}`;
            }

            code = `
        // ${name}
        '${id}': (() => {
            const ts = new Sprite(${turretDataStr}, ${this.gridWidth}, ${this.gridHeight}, 4, { 1: '#26d426', 2: '#333' }${tAnch});
            const bs = new Sprite(${baseDataStr}, ${this.gridWidth}, ${this.gridHeight}, 4, { 1: '#26d426', 2: '#333' }${bAnch});
            
            const d = new PartDef('${id}', '${name}', PartType.WEAPON, ts,
                ${statsStr}, ${width}, ${height}
            );
            d.baseSprite = bs;
            d.drawTurretInInventory = true;
            d.rotationOffset = ${rotOffset}; // ${Math.round(rotOffset * 180 / Math.PI)} degrees
            d.turretDrawOffset = 0;
            return d;
        })(),
`;

        } else {
            // Regular hull part (no turret)
            // AssetsData[id] = [...this.gridData]; // Moved above
            const sprite = new Sprite(AssetsData[id], this.gridWidth, this.gridHeight, 4, { 1: '#26d426', 2: '#333' });
            if (this.basePivot) { // Apply base pivot to hull sprite if it exists
                sprite.anchorX = this.basePivot.x / this.gridWidth;
                sprite.anchorY = this.basePivot.y / this.gridHeight;
            }
            const def = new PartDef(id, name, PartType.HULL, sprite, statsObj, width, height);
            PartsLibrary[id] = def;

            if (this.game.hangar) {
                this.game.hangar.inventory[id] = 10;
                this.game.hangar.updateUI();
            }

            // Code generation
            const dataStr = JSON.stringify(this.gridData);
            code = `
        // ${name}
        '${id}': new PartDef('${id}', '${name}', PartType.HULL, new Sprite(${dataStr}, ${this.gridWidth}, ${this.gridHeight}, 4, { 1: '#26d426', 2: '#333' }), { hp: ${20 * width * height}, mass: ${2 * width * height} }, ${width}, ${height}),
`;
        }

        console.log(`%c[DESIGNER] PART SAVED!`, 'color: #0f0; font-weight:bold; font-size: 14px;');
        console.log(code);

        // Automatically copy to clipboard
        navigator.clipboard.writeText(code).then(() => {
            console.log("Part code copied to clipboard.");
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });

        this.close();
    }

    drawGrid() {
        // Draw base canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const SCALE = 32;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const val = this.gridData[y * this.gridWidth + x];

                // Draw Grid Lines
                this.ctx.strokeStyle = '#444';
                this.ctx.strokeRect(x * SCALE, y * SCALE, SCALE, SCALE);

                if (val === 1) {
                    this.ctx.fillStyle = '#26d426';
                    this.ctx.fillRect(x * SCALE + 1, y * SCALE + 1, SCALE - 2, SCALE - 2);
                }
            }
        }

        // Draw Base Pivot
        if (this.basePivot) {
            // Note: Since x,y can be integer (cell center previously) or 0.5 (grid line), we handle drawing consistently.
            // If user clicked 0.5, 0.5 -> that's top-left corner of cell 0,0.
            // DRAW AT EXACT COORD scaled up.
            // Wait, previously we added + SCALE/2 because x,y assumed top-left of cell x,y.
            // Now x,y IS the precise relative coordinate (e.g. 3.5).
            // So draw at x * SCALE. 
            // BUT wait, cell 0 is from 0.0 to 1.0. Center is 0.5.
            // If user previously clicked cell 3,3 -> we stored {3,3}. Draw at 3.5 * SCALE.
            // But now we store {3.5, 3.5} if they click center.
            // So if we store precise coordinate, we just multiply by SCALE.

            // To maintain compatibility with "Center of Pixel" intent:
            // If they click CENTER of cell (3.5), we want pivot there.
            // The handleInput calculates snap to 0.5. 
            // So if they click center of cell 0 (0.5), we store 0.5.
            // Draw at 0.5 * SCALE. Correct.

            const bx = this.basePivot.x * SCALE;
            const by = this.basePivot.y * SCALE;
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.globalAlpha = 0.7;
            this.ctx.beginPath();
            this.ctx.arc(bx, by, 4, 0, Math.PI * 2); // Smaller dot for precision
            this.ctx.fill();

            // Crosshair
            this.ctx.beginPath();
            this.ctx.moveTo(bx - 8, by); this.ctx.lineTo(bx + 8, by);
            this.ctx.moveTo(bx, by - 8); this.ctx.lineTo(bx, by + 8);

            this.ctx.globalAlpha = 1.0;
            this.ctx.strokeStyle = '#ff00ff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Draw Front Indicator
        const rot = parseFloat(this.facingSelect.value) || 0;
        let arrow = '→';
        if (rot > 1.5 && rot < 1.6) arrow = '↓';
        else if (rot > 3.1 && rot < 3.2) arrow = '←';
        else if (rot > 4.7) arrow = '↑';

        // Base always forward relative to grid (ship context)
        this.ctx.fillStyle = '#444';
        this.ctx.font = 'bold 20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('→', this.canvas.width - 20, 20);


        // Draw turret canvas if in turret mode
        if (this.turretMode) {
            this.turretCtx.fillStyle = '#000';
            this.turretCtx.fillRect(0, 0, this.turretCanvas.width, this.turretCanvas.height);

            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    const val = this.turretGridData[y * this.gridWidth + x];

                    // Draw Grid Lines
                    this.turretCtx.strokeStyle = '#444';
                    this.turretCtx.strokeRect(x * SCALE, y * SCALE, SCALE, SCALE);

                    if (val === 1) {
                        this.turretCtx.fillStyle = '#26d426';
                        this.turretCtx.fillRect(x * SCALE + 1, y * SCALE + 1, SCALE - 2, SCALE - 2);
                    }
                }
            }

            // Draw Turret Pivot
            if (this.turretPivot) {
                const tx = this.turretPivot.x * SCALE;
                const ty = this.turretPivot.y * SCALE;
                this.turretCtx.fillStyle = '#ff00ff';
                this.turretCtx.globalAlpha = 0.7;
                this.turretCtx.beginPath();
                this.turretCtx.arc(tx, ty, 4, 0, Math.PI * 2);
                this.turretCtx.fill();

                // Crosshair
                this.turretCtx.beginPath();
                this.turretCtx.moveTo(tx - 8, ty); this.turretCtx.lineTo(tx + 8, ty);
                this.turretCtx.moveTo(tx, ty - 8); this.turretCtx.lineTo(tx, ty + 8);

                this.turretCtx.globalAlpha = 1.0;
                this.turretCtx.strokeStyle = '#ff00ff';
                this.turretCtx.lineWidth = 2;
                this.turretCtx.stroke();
            }

            // Draw Barrel Position (yellow/orange)
            if (this.barrelPos) {
                const bx = this.barrelPos.x * SCALE;
                const by = this.barrelPos.y * SCALE;
                this.turretCtx.fillStyle = '#ffaa00';
                this.turretCtx.globalAlpha = 0.8;
                this.turretCtx.beginPath();
                this.turretCtx.arc(bx, by, 5, 0, Math.PI * 2);
                this.turretCtx.fill();

                // Crosshair
                this.turretCtx.beginPath();
                this.turretCtx.moveTo(bx - 10, by); this.turretCtx.lineTo(bx + 10, by);
                this.turretCtx.moveTo(bx, by - 10); this.turretCtx.lineTo(bx, by + 10);

                this.turretCtx.globalAlpha = 1.0;
                this.turretCtx.strokeStyle = '#ffaa00';
                this.turretCtx.lineWidth = 2;
                this.turretCtx.stroke();
            }

            // Draw Turret Facing on Turret Canvas
            this.turretCtx.fillStyle = '#ffaa00';
            this.turretCtx.font = 'bold 20px monospace';
            this.turretCtx.textAlign = 'center';
            this.turretCtx.fillText(arrow, this.turretCanvas.width - 20, 20);
        }
    }

}
