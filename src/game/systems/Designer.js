
import { Assets, AssetsData } from '../../Assets.js';
import { PartsLibrary, UserPartsLibrary, PartDef, PartType, TILE_SIZE } from '../parts/Part.js';
import { Sprite } from '../../engine/Sprite.js';

export class Designer {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.gridData = [];
        this.currentSize = [1, 1]; // Width, Height in tiles

        // UI Container
        this.ui = document.createElement('div');
        Object.assign(this.ui.style, {
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            display: 'none', background: '#111', border: '2px solid #333', padding: '20px',
            textAlign: 'center', boxShadow: '0 0 20px rgba(0,0,0,0.8)', zIndex: 1000,
            fontFamily: "'VT323', monospace", fontSize: "20px"
        });

        this.ui.innerHTML = `
            <h3 style="color:white; margin-top:0;">designer</h3>
            
            <div style="margin-bottom:10px; display:flex; gap:10px; justify-content:center;">
                <input type="text" id="design-name" placeholder="part name" value="my part" 
                    style="background:#222; border:1px solid #444; color:white; padding:5px; font-family:inherit;">
                
                <select id="design-size" style="background:#222; border:1px solid #444; color:white; padding:5px; font-family:inherit;">
                    <option value="1x1">1x1 (standard)</option>
                    <option value="1x2">1x2 (vertical)</option>
                    <option value="2x2">2x2 (large)</option>
                </select>
            </div>

            <div style="position:relative; display:inline-block;">
                <canvas id="designerCanvas" style="border:1px solid #444; image-rendering: pixelated; cursor: crosshair; display:block; background:#000;"></canvas>
            </div>

            <div style="margin-top:10px;">
                <button id="btn-save" style="padding: 5px 15px; cursor: pointer; background:#28a745; color:white; border:none; font-family:inherit; font-size: 18px;">save new</button>
                <button id="btn-cancel" style="padding: 5px 15px; cursor: pointer; background:#dc3545; color:white; border:none; font-family:inherit; font-size: 18px;">cancel</button>
            </div>
            <div style="color:#666; font-size: 16px; margin-top:5px;">l-click: paint, r-click: erase</div>
        `;
        document.body.appendChild(this.ui);

        this.canvas = this.ui.querySelector('#designerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nameInput = this.ui.querySelector('#design-name');
        this.sizeSelect = this.ui.querySelector('#design-size');

        // Events
        this.ui.querySelector('#btn-save').onclick = () => this.save();
        this.ui.querySelector('#btn-cancel').onclick = () => this.close();
        this.sizeSelect.onchange = () => this.resizeGrid();

        // Painting
        let isDrawing = false;
        const paint = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scale = 32; // Visual scale for editor
            const x = Math.floor((e.clientX - rect.left) / scale);
            const y = Math.floor((e.clientY - rect.top) / scale);

            // Bounds check
            if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                const val = e.buttons === 1 ? 1 : 0;
                this.gridData[y * this.gridWidth + x] = val;
                this.drawGrid();
            }
        };

        this.canvas.onmousedown = (e) => { isDrawing = true; paint(e); };
        window.addEventListener('mouseup', () => { isDrawing = false; });
        this.canvas.onmousemove = (e) => { if (isDrawing) paint(e); };
        this.canvas.oncontextmenu = (e) => e.preventDefault();
    }

    open(basePartId) {
        // Reset to default new state or load existing if we support editing later
        this.active = true;
        this.ui.style.display = 'block';
        this.resizeGrid();
        this.game.input.active = false;
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
        }

        // Reset data
        this.gridData = new Array(this.gridWidth * this.gridHeight).fill(0);

        // Resize visual canvas (scale 32x)
        this.canvas.width = this.gridWidth * 32;
        this.canvas.height = this.gridHeight * 32;
        this.canvas.style.width = (this.gridWidth * 32) + 'px';
        this.canvas.style.height = (this.gridHeight * 32) + 'px';

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

        // 1. Runtime Update
        AssetsData[id] = [...this.gridData];
        const sprite = new Sprite(AssetsData[id], this.gridWidth, this.gridHeight, 4, { 1: '#26d426', 2: '#333' });
        const def = new PartDef(id, name, PartType.HULL, sprite, { hp: 20 * width * height, mass: 2 * width * height }, width, height);
        UserPartsLibrary[id] = def;

        if (this.game.hangar) {
            this.game.hangar.inventory[id] = 10;
            this.game.hangar.updateUI();
        }

        // 2. Code Generation (For Persistence)
        const dataStr = JSON.stringify(this.gridData);
        const code = `
        // ${name}
        '${id}': new PartDef('${id}', '${name}', PartType.HULL, new Sprite(${dataStr}, ${this.gridWidth}, ${this.gridHeight}, 4, { 1: '#26d426', 2: '#333' }), { hp: ${20 * width * height}, mass: ${2 * width * height} }, ${width}, ${height}),
`;

        console.log(`% c[DESIGNER] PART SAVED!`, 'color: #0f0; font-weight:bold; font-size: 14px;');
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
        // Clear
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const SCALE = 32;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const val = this.gridData[y * this.gridWidth + x];

                // Draw Grid Lines
                this.ctx.strokeStyle = '#333';
                this.ctx.strokeRect(x * SCALE, y * SCALE, SCALE, SCALE);

                if (val === 1) {
                    this.ctx.fillStyle = '#26d426';
                    this.ctx.fillRect(x * SCALE + 1, y * SCALE + 1, SCALE - 2, SCALE - 2);
                }
            }
        }
    }
}

