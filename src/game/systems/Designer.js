
import { Assets, AssetsData } from '../../Assets.js';
import { PartsLibrary, PartDef, PartType, TILE_SIZE } from '../parts/Part.js';
import { Sprite } from '../../engine/Sprite.js';

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
            </div>
            
            <div style="margin-bottom:15px;">
                <label style="color:#aabbff; font-size:14px; cursor:pointer; user-select:none;">
                    <input type="checkbox" id="turret-mode" style="margin-right:8px; cursor:pointer;">
                    🔧 turret editor (base + turret)
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
                <button id="btn-cancel" style="padding: 10px 20px; cursor: pointer; background:linear-gradient(135deg, #dc3545, #c82333); color:white; border:none; font-family:inherit; font-size: 16px; border-radius:4px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: transform 0.1s;">✖ cancel</button>
            </div>
            <div style="color:#8899bb; font-size: 14px; margin-top:10px;">left-click: paint | right-click: erase | <span style="color:#ffaa00;">→ front</span></div>
        `;
        document.body.appendChild(this.ui);

        this.canvas = this.ui.querySelector('#designerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.turretCanvas = this.ui.querySelector('#turretCanvas');
        this.turretCtx = this.turretCanvas.getContext('2d');
        this.nameInput = this.ui.querySelector('#design-name');
        this.sizeSelect = this.ui.querySelector('#design-size');
        this.turretModeCheckbox = this.ui.querySelector('#turret-mode');

        // Events
        this.ui.querySelector('#btn-save').onclick = () => this.save();
        this.ui.querySelector('#btn-cancel').onclick = () => this.close();
        this.sizeSelect.onchange = () => this.resizeGrid();
        this.turretModeCheckbox.onchange = () => this.toggleTurretMode();

        // Painting
        let isDrawing = false;
        const paint = (e, canvas, gridData) => {
            const rect = canvas.getBoundingClientRect();
            const scale = 32; // Visual scale for editor
            const x = Math.floor((e.clientX - rect.left) / scale);
            const y = Math.floor((e.clientY - rect.top) / scale);

            // Bounds check
            if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                const val = e.buttons === 1 ? 1 : 0;
                gridData[y * this.gridWidth + x] = val;
                this.drawGrid();
            }
        };

        this.canvas.onmousedown = (e) => { isDrawing = true; paint(e, this.canvas, this.gridData); };
        this.canvas.onmousemove = (e) => { if (isDrawing) paint(e, this.canvas, this.gridData); };
        this.canvas.oncontextmenu = (e) => e.preventDefault();

        this.turretCanvas.onmousedown = (e) => { isDrawing = true; paint(e, this.turretCanvas, this.turretGridData); };
        this.turretCanvas.onmousemove = (e) => { if (isDrawing) paint(e, this.turretCanvas, this.turretGridData); };
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

        if (this.turretMode) {
            turretWrapper.style.display = 'block';
            baseLabel.style.display = 'block';
        } else {
            turretWrapper.style.display = 'none';
            baseLabel.style.display = 'none';
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

    save() {
        const name = this.nameInput.value;
        const id = 'custom_' + Date.now();
        const width = this.currentSize[0];
        const height = this.currentSize[1];

        let code = '';

        if (this.turretMode) {
            // Save with both baseSprite and turret sprite (for weapons)
            AssetsData[id + '_base'] = [...this.gridData];
            AssetsData[id] = [...this.turretGridData];

            const baseSprite = new Sprite(AssetsData[id + '_base'], this.gridWidth, this.gridHeight, 4, { 1: '#26d426', 2: '#333' });
            const turretSprite = new Sprite(AssetsData[id], this.gridWidth, this.gridHeight, 4, { 1: '#26d426', 2: '#333' });

            const def = new PartDef(id, name, PartType.WEAPON, turretSprite, { hp: 20 * width * height, mass: 2 * width * height }, width, height);
            def.baseSprite = baseSprite;
            def.drawTurretInInventory = true;
            PartsLibrary[id] = def;

            if (this.game.hangar) {
                this.game.hangar.inventory[id] = 10;
                this.game.hangar.updateUI();
            }

            // Code generation
            const baseDataStr = JSON.stringify(this.gridData);
            const turretDataStr = JSON.stringify(this.turretGridData);
            code = `
        // ${name}
        '${id}': (() => {
            const d = new PartDef('${id}', '${name}', PartType.WEAPON,
                new Sprite(${turretDataStr}, ${this.gridWidth}, ${this.gridHeight}, 4, { 1: '#26d426', 2: '#333' }),
                { hp: ${20 * width * height}, mass: ${2 * width * height} }, ${width}, ${height}
            );
            d.baseSprite = new Sprite(${baseDataStr}, ${this.gridWidth}, ${this.gridHeight}, 4, { 1: '#26d426', 2: '#333' });
            d.drawTurretInInventory = true;
            return d;
        })(),
`;
        } else {
            // Regular hull part (no turret)
            AssetsData[id] = [...this.gridData];
            const sprite = new Sprite(AssetsData[id], this.gridWidth, this.gridHeight, 4, { 1: '#26d426', 2: '#333' });
            const def = new PartDef(id, name, PartType.HULL, sprite, { hp: 20 * width * height, mass: 2 * width * height }, width, height);
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

        // Draw front indicator arrow (pointing right)
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.font = 'bold 20px Arial';
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

            // Draw front indicator on turret canvas too
            this.turretCtx.fillStyle = '#ffaa00';
            this.turretCtx.font = 'bold 20px Arial';
            this.turretCtx.textAlign = 'center';
            this.turretCtx.fillText('→', this.turretCanvas.width - 20, 20);
        }
    }
}

