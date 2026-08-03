import { Assets, AssetsData } from '../../Assets.js';
import { PartsLibrary, PartDef, PartType, TILE_SIZE } from '../../shared/parts/Part.js';
import { Sprite } from '../../engine/Sprite.js';
import {
    createBlankPartDesign,
    gridDimensions,
    parsePartDesign,
    serializePartDesign
} from '../dev/PartDesignDocument.js';
import { parseLegacyPartDesign } from '../dev/LegacyPartDesignImport.js';

const COLORS = { 1: '#26d426', 2: '#333' };
const TYPE_LABELS = [
    ['hull', 'hull'], ['weapon', 'weapon'], ['thruster', 'thruster'],
    ['accelerant', 'accelerant'], ['rocket_bay', 'rocket bay'],
    ['booster', 'booster'], ['shield', 'shield']
];

export class Designer {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.currentSize = [1, 1];
        this.gridWidth = 8;
        this.gridHeight = 8;
        this.gridData = new Array(64).fill(0);
        this.turretGridData = new Array(64).fill(0);
        this.importedStats = {};
        this.basePivot = null;
        this.turretPivot = null;
        this.barrelPos = null;
        this.pivotMode = false;
        this.barrelMode = false;
        this.turretMode = false;
        this.buildUI();
        this.bindEvents();
        this.resizeCanvases();
    }

    buildUI() {
        this.ui = document.createElement('div');
        this.ui.id = 'part-designer';
        Object.assign(this.ui.style, {
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            display: 'none', width: 'min(1120px, 94vw)', maxHeight: '94vh', overflow: 'auto',
            boxSizing: 'border-box', background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            border: '3px solid #4a9eff', padding: '18px', borderRadius: '8px', color: '#fff',
            textAlign: 'center', boxShadow: '0 0 30px rgba(74,158,255,.4)', zIndex: 1000,
            fontFamily: "'Press Start 2P', monospace", fontSize: '12px'
        });
        const options = TYPE_LABELS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
        this.ui.innerHTML = `
            <h3 style="color:#4a9eff;margin:0 0 12px">part designer</h3>
            <div style="display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap">
                <input id="design-name" value="my part" maxlength="64" aria-label="part name" style="${fieldStyle()}">
                <select id="design-type" aria-label="part type" style="${fieldStyle()}">${options}</select>
                <select id="design-size" aria-label="part size" style="${fieldStyle()}">
                    <option value="1x1">1x1</option><option value="1x2">1x2</option>
                    <option value="2x2">2x2</option><option value="2x4">2x4</option>
                </select>
                <select id="turret-facing" aria-label="turret facing" style="${fieldStyle()};display:none;border-color:#ff9944">
                    <option value="0">face right</option><option value="1.5708">face down</option>
                    <option value="3.1416">face left</option><option value="4.7124">face up</option>
                </select>
            </div>
            <div style="margin:10px 0;display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
                <label><input type="checkbox" id="turret-mode"> base + turret</label>
                <label><input type="checkbox" id="pivot-mode"> set mount/pivot</label>
                <label><input type="checkbox" id="barrel-mode"> set barrel</label>
            </div>
            <div id="designer-workspace" style="display:flex;gap:14px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
                <div><div id="base-label" style="color:#4a9eff;margin-bottom:4px">part art</div>
                    <canvas id="designerCanvas" aria-label="base art canvas" style="${canvasStyle('#4a9eff')}"></canvas></div>
                <div id="turret-canvas-wrapper" style="display:none"><div style="color:#ff9944;margin-bottom:4px">turret art</div>
                    <canvas id="turretCanvas" aria-label="turret art canvas" style="${canvasStyle('#ff9944')}"></canvas></div>
                <div><div style="color:#aabbff;margin-bottom:4px">ship mount preview</div>
                    <canvas id="mount-preview" width="280" height="210" aria-label="ship mount preview" style="${canvasStyle('#aabbff')};width:280px;height:210px"></canvas>
                    <div style="color:#8899bb;font-size:9px;margin-top:5px">exact pixels, anchors, size, and attachment</div></div>
            </div>
            <textarea id="design-notes" maxlength="2000" placeholder="describe what this part should do. mechanics, projectile, weird behavior, whatever." aria-label="part mechanics and notes" style="${fieldStyle()};box-sizing:border-box;width:min(760px,90%);height:58px;margin-top:10px;resize:vertical"></textarea>
            <div id="import-panel" style="display:none;margin:10px auto;padding:10px;max-width:760px;background:#10182c;border:1px solid #4a9eff">
                <div style="color:#aabbff;margin-bottom:6px">paste a .framebound-part.json design or old part javascript</div>
                <textarea id="import-text" aria-label="part design import" style="${fieldStyle()};box-sizing:border-box;width:100%;height:110px;resize:vertical"></textarea>
                <div style="margin-top:7px"><button id="btn-apply-import" style="${buttonStyle('#007bff')}">apply import</button>
                <button id="btn-close-import" style="${buttonStyle('#555')}">cancel import</button></div>
            </div>
            <div id="designer-status" role="status" style="height:14px;color:#88ffbb;font-size:9px;margin:9px 0"></div>
            <div style="display:flex;gap:7px;justify-content:center;flex-wrap:wrap">
                <button id="btn-save" style="${buttonStyle('#20a066')}">add to hangar</button>
                <button id="btn-copy" style="${buttonStyle('#007bff')}">copy design</button>
                <button id="btn-download" style="${buttonStyle('#6950cc')}">download design</button>
                <button id="btn-import" style="${buttonStyle('#a56b00')}">import design</button>
                <button id="btn-cancel" style="${buttonStyle('#b52b3b')}">close</button>
            </div>
            <div style="color:#8899bb;font-size:9px;margin-top:9px">left-click paint · right-click erase · paste copied design into codex</div>`;
        document.body.appendChild(this.ui);

        this.canvas = this.ui.querySelector('#designerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.turretCanvas = this.ui.querySelector('#turretCanvas');
        this.turretCtx = this.turretCanvas.getContext('2d');
        this.previewCanvas = this.ui.querySelector('#mount-preview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.nameInput = this.ui.querySelector('#design-name');
        this.typeSelect = this.ui.querySelector('#design-type');
        this.sizeSelect = this.ui.querySelector('#design-size');
        this.notesInput = this.ui.querySelector('#design-notes');
        this.turretModeCheckbox = this.ui.querySelector('#turret-mode');
        this.pivotModeCheckbox = this.ui.querySelector('#pivot-mode');
        this.barrelModeCheckbox = this.ui.querySelector('#barrel-mode');
        this.facingSelect = this.ui.querySelector('#turret-facing');
        this.importPanel = this.ui.querySelector('#import-panel');
        this.importInput = this.ui.querySelector('#import-text');
        this.status = this.ui.querySelector('#designer-status');
    }

    bindEvents() {
        this.ui.querySelector('#btn-save').onclick = () => this.save();
        this.ui.querySelector('#btn-copy').onclick = () => this.copyDesign();
        this.ui.querySelector('#btn-download').onclick = () => this.downloadDesign();
        this.ui.querySelector('#btn-import').onclick = () => this.showImport(true);
        this.ui.querySelector('#btn-apply-import').onclick = () => this.applyImport();
        this.ui.querySelector('#btn-close-import').onclick = () => this.showImport(false);
        this.ui.querySelector('#btn-cancel').onclick = () => this.close();
        this.sizeSelect.onchange = () => this.resizeGrid();
        this.typeSelect.onchange = () => this.syncTypeAndTurret('type');
        this.turretModeCheckbox.onchange = () => this.syncTypeAndTurret('turret');
        this.facingSelect.onchange = () => this.drawGrid();
        this.nameInput.oninput = () => this.drawPreview();
        this.notesInput.oninput = () => this.clearStatus();
        this.pivotModeCheckbox.onchange = () => {
            this.pivotMode = this.pivotModeCheckbox.checked;
            this.barrelMode = false; this.barrelModeCheckbox.checked = false;
        };
        this.barrelModeCheckbox.onchange = () => {
            this.barrelMode = this.barrelModeCheckbox.checked;
            this.pivotMode = false; this.pivotModeCheckbox.checked = false;
        };
        this.bindCanvas(this.canvas, false);
        this.bindCanvas(this.turretCanvas, true);
        window.addEventListener('resize', () => this.active && this.resizeCanvases());
    }

    bindCanvas(canvas, isTurret) {
        let drawing = false;
        const handle = event => {
            const rect = canvas.getBoundingClientRect();
            const rawX = (event.clientX - rect.left) / rect.width * this.gridWidth;
            const rawY = (event.clientY - rect.top) / rect.height * this.gridHeight;
            if (this.pivotMode && event.type === 'mousedown') {
                const point = snapPoint(rawX, rawY, this.gridWidth, this.gridHeight);
                if (isTurret) this.turretPivot = point; else this.basePivot = point;
            } else if (this.barrelMode && isTurret && event.type === 'mousedown') {
                this.barrelPos = snapPoint(rawX, rawY, this.gridWidth, this.gridHeight);
            } else {
                const x = Math.floor(rawX); const y = Math.floor(rawY);
                if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) return;
                if (event.buttons !== 1 && event.buttons !== 2) return;
                const data = isTurret ? this.turretGridData : this.gridData;
                data[y * this.gridWidth + x] = event.buttons === 1 ? 1 : 0;
            }
            this.clearStatus(); this.drawGrid();
        };
        canvas.onmousedown = event => { drawing = true; handle(event); };
        canvas.onmousemove = event => { if (drawing && !this.pivotMode && !this.barrelMode) handle(event); };
        canvas.oncontextmenu = event => event.preventDefault();
        window.addEventListener('mouseup', () => { drawing = false; });
    }

    open() {
        this.active = true;
        this.ui.style.display = 'block';
        this.resizeCanvases();
        this.game.input.active = false;
    }

    close() {
        this.active = false;
        this.ui.style.display = 'none';
        this.game.input.active = true;
    }

    syncTypeAndTurret(source) {
        if (source === 'type') this.turretModeCheckbox.checked = this.typeSelect.value === PartType.WEAPON;
        if (source === 'turret') this.typeSelect.value = this.turretModeCheckbox.checked ? PartType.WEAPON : PartType.HULL;
        this.turretMode = this.turretModeCheckbox.checked;
        this.ui.querySelector('#turret-canvas-wrapper').style.display = this.turretMode ? 'block' : 'none';
        this.facingSelect.style.display = this.turretMode ? 'inline-block' : 'none';
        this.barrelModeCheckbox.disabled = !this.turretMode;
        if (!this.turretMode) {
            this.barrelMode = false;
            this.barrelModeCheckbox.checked = false;
        }
        this.resizeCanvases();
    }

    resizeGrid() {
        this.currentSize = this.sizeSelect.value.split('x').map(Number);
        const grid = gridDimensions(...this.currentSize);
        this.gridWidth = grid.width; this.gridHeight = grid.height;
        this.gridData = new Array(this.gridWidth * this.gridHeight).fill(0);
        this.turretGridData = new Array(this.gridWidth * this.gridHeight).fill(0);
        this.basePivot = null; this.turretPivot = null; this.barrelPos = null;
        this.importedStats = {};
        this.resizeCanvases();
    }

    resizeCanvases() {
        const columns = this.turretMode ? 2 : 1;
        const availableWidth = Math.max(160, Math.min(window.innerWidth * .9 - 340, 760) / columns - 18);
        const availableHeight = Math.max(230, window.innerHeight * .48);
        this.editorScale = Math.max(7, Math.min(32, Math.floor(availableWidth / this.gridWidth), Math.floor(availableHeight / this.gridHeight)));
        for (const canvas of [this.canvas, this.turretCanvas]) {
            canvas.width = this.gridWidth * this.editorScale;
            canvas.height = this.gridHeight * this.editorScale;
            canvas.style.width = `${canvas.width}px`;
            canvas.style.height = `${canvas.height}px`;
        }
        this.drawGrid();
    }

    toDesignDocument() {
        const design = createBlankPartDesign({
            name: this.nameInput.value,
            type: this.typeSelect.value,
            width: this.currentSize[0],
            height: this.currentSize[1]
        });
        design.layers.base = [...this.gridData];
        design.layers.turret = this.turretMode ? [...this.turretGridData] : null;
        design.anchors.base = this.basePivot ? { ...this.basePivot } : null;
        design.anchors.turret = this.turretMode && this.turretPivot ? { ...this.turretPivot } : null;
        design.barrel = this.turretMode && this.barrelPos ? { ...this.barrelPos } : null;
        design.rotationOffset = this.turretMode ? Number(this.facingSelect.value) : 0;
        design.stats = { ...this.importedStats };
        design.notes = this.notesInput.value;
        return design;
    }

    loadDesign(design) {
        this.nameInput.value = design.name;
        this.typeSelect.value = design.type;
        this.sizeSelect.value = `${design.footprint.width}x${design.footprint.height}`;
        this.currentSize = [design.footprint.width, design.footprint.height];
        this.gridWidth = design.grid.width; this.gridHeight = design.grid.height;
        this.gridData = [...design.layers.base];
        this.turretGridData = design.layers.turret ? [...design.layers.turret] : new Array(this.gridWidth * this.gridHeight).fill(0);
        this.turretModeCheckbox.checked = Boolean(design.layers.turret);
        this.turretMode = Boolean(design.layers.turret);
        this.basePivot = design.anchors.base ? { ...design.anchors.base } : null;
        this.turretPivot = design.anchors.turret ? { ...design.anchors.turret } : null;
        this.barrelPos = design.barrel ? { ...design.barrel } : null;
        this.importedStats = { ...design.stats };
        this.notesInput.value = design.notes;
        this.facingSelect.value = closestFacing(design.rotationOffset);
        this.syncTypeAndTurret('type');
    }

    showImport(show) {
        this.importPanel.style.display = show ? 'block' : 'none';
        if (show) this.importInput.focus();
    }

    applyImport() {
        try {
            let design;
            try { design = parsePartDesign(this.importInput.value); }
            catch { design = parseLegacyPartDesign(this.importInput.value); }
            this.loadDesign(design);
            this.showImport(false);
            this.setStatus('design imported');
        } catch (error) {
            console.error(error);
            this.setStatus(error.message || 'could not import design', true);
        }
    }

    async copyDesign() {
        try {
            const text = serializePartDesign(this.toDesignDocument());
            await navigator.clipboard.writeText(text);
            this.setStatus('design copied — paste it into codex');
        } catch (error) {
            console.error(error);
            this.setStatus(error.message || 'could not copy design', true);
        }
    }

    downloadDesign() {
        try {
            const text = serializePartDesign(this.toDesignDocument());
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
            link.download = `${safeName(this.nameInput.value)}.framebound-part.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.setStatus('design downloaded — attach that file to codex');
        } catch (error) {
            console.error(error);
            this.setStatus(error.message || 'could not download design', true);
        }
    }

    save() {
        try {
            const design = parsePartDesign(serializePartDesign(this.toDesignDocument()));
            const id = `custom_${Date.now()}`;
            const definition = this.createDefinition(id, design);
            PartsLibrary[id] = definition;
            AssetsData[id] = [...design.layers.turret || design.layers.base];
            AssetsData[`${id}_base`] = [...design.layers.base];
            if (this.game.hangar) {
                this.game.hangar.inventory[id] = 10;
                this.game.hangar.updateUI();
            }
            this.game.showNotification?.(`${design.name} added to hangar`, '#44ff88');
            this.close();
        } catch (error) {
            console.error(error);
            this.setStatus(error.message || 'could not add part', true);
        }
    }

    createDefinition(id, design = this.toDesignDocument()) {
        const makeSprite = (pixels, anchor) => new Sprite(
            pixels, design.grid.width, design.grid.height, 4, COLORS,
            anchor?.x === undefined ? .5 : anchor.x / design.grid.width,
            anchor?.y === undefined ? .5 : anchor.y / design.grid.height
        );
        const stats = {
            hp: 20 * design.footprint.width * design.footprint.height,
            mass: 2 * design.footprint.width * design.footprint.height,
            ...design.stats
        };
        if (design.barrel) {
            const pivot = design.anchors.turret || { x: design.grid.width / 2, y: design.grid.height / 2 };
            stats.barrelPosition = { x: (design.barrel.x - pivot.x) * 4, y: (design.barrel.y - pivot.y) * 4 };
        }
        const sprite = makeSprite(design.layers.turret || design.layers.base, design.anchors.turret || design.anchors.base);
        const definition = new PartDef(id, design.name, design.type, sprite, stats, design.footprint.width, design.footprint.height);
        if (design.layers.turret) {
            definition.baseSprite = makeSprite(design.layers.base, design.anchors.base);
            definition.drawTurretInInventory = true;
            definition.rotationOffset = design.rotationOffset;
            definition.turretDrawOffset = 0;
        }
        return definition;
    }

    drawGrid() {
        this.drawEditorLayer(this.ctx, this.gridData, this.basePivot, null, '#4a9eff');
        if (this.turretMode) this.drawEditorLayer(this.turretCtx, this.turretGridData, this.turretPivot, this.barrelPos, '#ff9944');
        this.drawPreview();
    }

    drawEditorLayer(ctx, data, pivot, barrel, accent) {
        const scale = this.editorScale;
        ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for (let y = 0; y < this.gridHeight; y++) for (let x = 0; x < this.gridWidth; x++) {
            ctx.strokeStyle = '#303442'; ctx.lineWidth = 1; ctx.strokeRect(x * scale, y * scale, scale, scale);
            const value = data[y * this.gridWidth + x];
            if (value) { ctx.fillStyle = COLORS[value] || accent; ctx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2); }
        }
        if (pivot) drawMarker(ctx, pivot, scale, '#ff55ff');
        if (barrel) drawMarker(ctx, barrel, scale, '#ffaa00');
        ctx.fillStyle = accent; ctx.font = `bold ${Math.max(11, scale)}px monospace`; ctx.textAlign = 'right';
        ctx.fillText(facingArrow(Number(this.facingSelect.value)), ctx.canvas.width - 4, Math.max(13, scale));
    }

    drawPreview() {
        const ctx = this.previewCtx;
        ctx.fillStyle = '#080b14'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const width = this.currentSize[0]; const height = this.currentSize[1];
        const coreX = 54; const coreY = ctx.canvas.height / 2;
        const partGridY = -Math.floor((height - 1) / 2);
        const partX = coreX + (1 + (width - 1) / 2) * TILE_SIZE;
        const partY = coreY + (partGridY + (height - 1) / 2) * TILE_SIZE;
        ctx.strokeStyle = '#26344d'; ctx.lineWidth = 1;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            ctx.strokeRect(coreX + (1 + x) * TILE_SIZE - TILE_SIZE / 2, coreY + (partGridY + y) * TILE_SIZE - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        }
        Assets.PlayerBase.draw(ctx, coreX, coreY, 0, .5, .5);
        const design = this.toDesignDocument();
        try {
            const definition = this.createDefinition('preview', design);
            if (definition.baseSprite) definition.baseSprite.draw(ctx, partX, partY, 0, .5, .5);
            definition.sprite.draw(ctx, partX, partY, definition.rotationOffset || 0, null, null);
        } catch { /* incomplete text fields are allowed while typing */ }
        ctx.strokeStyle = '#44ff88'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(coreX + TILE_SIZE / 2, coreY); ctx.lineTo(coreX + TILE_SIZE / 2 + 8, coreY); ctx.stroke();
        ctx.fillStyle = '#8899bb'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        ctx.fillText('core', coreX, coreY + 28); ctx.fillText(`${width}x${height} mount`, partX, ctx.canvas.height - 9);
    }

    setStatus(message, isError = false) { this.status.style.color = isError ? '#ff6677' : '#88ffbb'; this.status.textContent = message; }
    clearStatus() { this.status.textContent = ''; }
}

function fieldStyle() { return 'background:#0f3460;border:2px solid #4a9eff;color:#fff;padding:7px;font-family:inherit;font-size:10px;border-radius:4px'; }
function buttonStyle(color) { return `padding:9px 12px;cursor:pointer;background:${color};color:white;border:0;font-family:inherit;font-size:10px;border-radius:4px`; }
function canvasStyle(color) { return `border:2px solid ${color};image-rendering:pixelated;cursor:crosshair;display:block;background:#000;border-radius:4px`; }
function safeName(value) { return (value || 'part').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part'; }
function closestFacing(value) { return [0, 1.5708, 3.1416, 4.7124].reduce((best, option) => Math.abs(option - value) < Math.abs(best - value) ? option : best, 0).toString(); }
function facingArrow(rotation) { if (rotation > 4.7) return '↑'; if (rotation > 3.1) return '←'; if (rotation > 1.5) return '↓'; return '→'; }
function snapPoint(x, y, maxX, maxY) { return { x: Math.max(0, Math.min(maxX, Math.round(x * 2) / 2)), y: Math.max(0, Math.min(maxY, Math.round(y * 2) / 2)) }; }
function drawMarker(ctx, point, scale, color) {
    const x = point.x * scale; const y = point.y * scale;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, Math.max(3, scale / 6), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
}
