import { PartsLibrary, PartType, TILE_SIZE } from '../../shared/parts/Part.js';
import { Sprite } from '../../engine/Sprite.js';
import {
    createBlankPartDesign,
    gridDimensions,
    parsePartDesign,
    serializePartDesign,
    upgradeLegacyPartDesign
} from '../dev/PartDesignDocument.js';
import { parseLegacyPartDesign } from '../dev/LegacyPartDesignImport.js';
import { applyVisualDesignOverride } from '../dev/PartLabManifest.js';
import { drawRasterStroke, RasterHistory } from '../dev/PartRasterTools.js';
import {
    DEFAULT_PROJECTILE_LOOK,
    DEFAULT_PROJECTILE_TRAIL,
    PROJECTILE_LOOK_PRESETS,
    PROJECTILE_TRAIL_PRESETS,
    normalizeProjectileLook,
    normalizeProjectileTrail,
    supportsProjectileCosmetics
} from '../../shared/combat/ProjectileVisuals.js';
import { drawProjectileOnContext } from '../renderers/ProjectileRenderer.js';
import { Projectile } from '../../shared/entities/Projectile.js';
import { WeaponSystem } from './WeaponSystem.js';
import {
    getAuthoredMuzzlePositions,
    getAuthoredTurretMount,
    pointOffset,
    rotateVector
} from '../../shared/parts/PartVisualGeometry.js';
import { coreEffectRotation } from '../../shared/parts/CoreEffect.js';
import { resolveDroneBlueprint } from '../../shared/combat/DroneBlueprints.js';

const PART_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const EDITABLE_DOCUMENT_TYPES = new Set(Object.values(PartType));
const BASE_SIZES = ['1x1', '1x2', '2x2', '2x4'];
const DEFAULT_DRONE_PALETTE = ['#00ffff', '#177777', '#f2f5ff', '#4a9eff', '#ff9944', '#b56cff'];
const LAYERS = Object.freeze([
    ['base', 'base'], ['turret', 'turret'], ['core', 'spinning core'], ['drone', 'spawned drone']
]);
const TOOLS = Object.freeze([
    ['pencil', 'pencil'], ['eraser', 'eraser'], ['line', 'line'],
    ['box', 'box'], ['box-fill', 'filled box'], ['fill', 'fill bucket']
]);

export function partDefinitionToDesign(partId, definition) {
    assertStablePartId(partId);
    if (!definition || typeof definition !== 'object') throw new Error(`part definition is missing: ${partId}`);
    if (definition.visualGeometry?.version === 2) return authoredDefinitionToDesign(partId, definition);
    const upgraded = upgradeLegacyPartDesign(legacyDefinitionToDesign(partId, definition));
    upgraded.partId = partId;
    upgraded.partType = definition.type;
    return upgraded;
}

export function createBlankDesignForPart(partId, definition) {
    assertStablePartId(partId);
    if (!definition) throw new Error(`part definition is missing: ${partId}`);
    if (partId === 'gun_basic') return partDefinitionToDesign(partId, definition);
    const documentType = EDITABLE_DOCUMENT_TYPES.has(definition.type)
        ? definition.type
        : PartType.HULL;
    const design = createBlankPartDesign({
        name: definition.name || partId,
        type: documentType,
        width: definition.width,
        height: definition.height
    });
    design.partId = partId;
    design.partType = definition.type;
    design.stats = clone(definition.stats || {});
    design.projectileLook = definition.projectileLook || DEFAULT_PROJECTILE_LOOK;
    design.projectileTrail = definition.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
    if (definition.type === PartType.WEAPON) {
        design.layers.turret = new Array(design.turretGrid.width * design.turretGrid.height).fill(0);
        design.anchors.base = centerPoint(design.grid);
        design.anchors.turret = centerPoint(design.turretGrid);
    }
    if (definition.type === PartType.DRONE) {
        design.drone = blankDroneVisual(definition.stats?.droneType || 'striker');
    }
    return design;
}

export function validateStagedDesignDocument(design, partId = design?.partId) {
    const stablePartId = partId === null || partId === undefined ? null : assertStablePartId(partId);
    if (design?.partId && stablePartId && design.partId !== stablePartId) {
        throw new Error('staged design part id does not match the open part');
    }
    let validated = parsePartDesign(serializePartDesign(design));
    if (validated.version === 1) validated = upgradeLegacyPartDesign(validated);
    if (validated.version !== 2) throw new Error('save requires a v2 part design');
    if (stablePartId) validated.partId = stablePartId;
    if (design?.partType !== undefined) {
        if (!Object.values(PartType).includes(design.partType)) throw new Error(`unsupported part type: ${design.partType}`);
        validated.partType = design.partType;
    }
    return validated;
}

export class Designer {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.currentPartId = null;
        this.currentPartType = PartType.HULL;
        this.fallbackDefinition = null;
        this.design = createBlankPartDesign();
        this.layer = 'base';
        this.tool = 'pencil';
        this.colorIndex = 1;
        this.pointMode = null;
        this.installRotation = 0;
        this.previewAim = { x: 360, y: 110 };
        this.previewProjectiles = [];
        this.previewLastFrame = 0;
        this.previewAnimationFrame = null;
        this.continuousFire = false;
        this.nextPreviewShotAt = 0;
        this.strokeStart = null;
        this.strokePixels = null;
        this.strokeTool = null;
        this.histories = new Map();
        this.turretVariants = new Map();
        this.stagedSaveCallback = null;
        this.nextPartCallback = null;
        this.draftChangeCallback = null;
        this.closeCallback = null;
        this.buildUI();
        this.bindEvents();
        this.loadDesign(this.design);
    }

    buildUI() {
        this.ui = document.createElement('div');
        this.ui.id = 'part-designer';
        this.ui.className = 'part-designer-v2';
        this.ui.innerHTML = `
            <header class="pd-head"><h2>part designer v2</h2><span class="pd-status" data-role="identity"></span><span class="pd-spacer"></span><button class="pd-btn" data-action="close">close</button></header>
            <main class="pd-main">
                <aside class="pd-side">
                    <section class="pd-section"><span class="pd-label">layer</span><div class="pd-row" data-role="layers"></div></section>
                    <section class="pd-section"><span class="pd-label">drawing tool</span><div class="pd-row" data-role="tools"></div></section>
                    <section class="pd-section"><span class="pd-label">palette · empty cells are transparent</span><div class="pd-palette" data-role="palette"></div></section>
                    <section class="pd-section"><span class="pd-label">geometry points</span><div class="pd-row">
                        <button class="pd-btn" data-point="base">set base mount</button><button class="pd-btn" data-point="turret">set turret pivot</button><button class="pd-btn" data-point="muzzle">add muzzle</button><button class="pd-btn is-warn" data-action="clear-muzzles">clear muzzles</button>
                    </div><div class="pd-marker-list" data-role="markers"></div></section>
                    <section class="pd-section"><span class="pd-label">history</span><div class="pd-row"><button class="pd-btn" data-action="undo">undo</button><button class="pd-btn" data-action="redo">redo</button><button class="pd-btn is-warn" data-action="clear-layer">clear layer</button><button class="pd-btn is-warn" data-action="remove-core">remove core</button></div></section>
                </aside>
                <section class="pd-canvas-wrap"><canvas class="pd-canvas" data-role="canvas"></canvas></section>
                <aside class="pd-side pd-preview-side">
                    <section class="pd-section"><span class="pd-label">canvas</span><div class="pd-row"><label>base <select class="pd-select" data-role="base-size">${BASE_SIZES.map(size => `<option>${size}</option>`).join('')}</select></label><label>turret <select class="pd-select" data-role="turret-size"></select></label></div></section>
                    <section class="pd-section"><span class="pd-label">exact runtime mount preview</span><canvas width="408" height="260" class="pd-preview" data-role="preview"></canvas><div class="pd-row" style="margin-top:7px"><label>installed <select class="pd-select" data-role="rotation"><option value="0">0°</option><option value="1">90°</option><option value="2">180°</option><option value="3">270°</option></select></label><label>fire <select class="pd-select" data-role="fire-mode"><option value="single">single</option><option value="burst">burst</option><option value="continuous">continuous</option></select></label><button class="pd-btn" data-action="fire">fire test</button></div></section>
                    <section class="pd-section" data-role="projectile-controls"><span class="pd-label">projectile cosmetics</span><div class="pd-row"><label>look <select class="pd-select" data-role="projectile-look"></select></label><label>trail <select class="pd-select" data-role="projectile-trail"></select></label></div><canvas width="390" height="56" class="pd-projectile-preview" data-role="projectile-preview"></canvas><div class="pd-help" data-role="projectile-help">trail = the glow or particles left behind a projectile.</div></section>
                    <section class="pd-section"><span class="pd-label">notes</span><textarea class="pd-input pd-text" maxlength="2000" data-role="notes"></textarea></section>
                    <details class="pd-advanced"><summary>advanced import / export</summary><textarea class="pd-input" data-role="import"></textarea><div class="pd-row"><button class="pd-btn" data-action="import">import</button><button class="pd-btn" data-action="copy">copy</button><button class="pd-btn" data-action="download">download</button></div></details>
                </aside>
            </main>
            <footer class="pd-foot"><span class="pd-status" data-role="status"></span><span class="pd-spacer"></span><button class="pd-btn" data-action="save-next">save & next</button><button class="pd-btn is-on" data-action="save">save changes</button></footer>`;
        document.body.appendChild(this.ui);
        this.canvas = this.ui.querySelector('[data-role="canvas"]');
        this.ctx = this.canvas.getContext('2d');
        this.previewCanvas = this.ui.querySelector('[data-role="preview"]');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.projectilePreviewCanvas = this.ui.querySelector('[data-role="projectile-preview"]');
        this.projectilePreviewCtx = this.projectilePreviewCanvas.getContext('2d');
        this.status = this.ui.querySelector('[data-role="status"]');
        this.identity = this.ui.querySelector('[data-role="identity"]');
        this.baseSizeSelect = this.ui.querySelector('[data-role="base-size"]');
        this.turretSizeSelect = this.ui.querySelector('[data-role="turret-size"]');
        this.rotationSelect = this.ui.querySelector('[data-role="rotation"]');
        this.fireModeSelect = this.ui.querySelector('[data-role="fire-mode"]');
        this.projectileLookSelect = this.ui.querySelector('[data-role="projectile-look"]');
        this.projectileTrailSelect = this.ui.querySelector('[data-role="projectile-trail"]');
        this.projectileControls = this.ui.querySelector('[data-role="projectile-controls"]');
        this.projectileHelp = this.ui.querySelector('[data-role="projectile-help"]');
        this.notesInput = this.ui.querySelector('[data-role="notes"]');
        this.importInput = this.ui.querySelector('[data-role="import"]');
        this.populateStaticControls();
    }

    populateStaticControls() {
        const layerHost = this.ui.querySelector('[data-role="layers"]');
        for (const [id, label] of LAYERS) layerHost.appendChild(makeButton(label, { layer: id }));
        const toolHost = this.ui.querySelector('[data-role="tools"]');
        for (const [id, label] of TOOLS) toolHost.appendChild(makeButton(label, { tool: id }));
        for (const preset of PROJECTILE_LOOK_PRESETS) this.projectileLookSelect.appendChild(makeOption(preset.label || preset.id, preset.id));
        for (const preset of PROJECTILE_TRAIL_PRESETS) this.projectileTrailSelect.appendChild(makeOption(preset.label || preset.id, preset.id));
    }

    bindEvents() {
        this.ui.addEventListener('click', event => {
            const target = event.target.closest?.('button');
            if (!target) return;
            if (target.dataset.layer) return this.setLayer(target.dataset.layer);
            if (target.dataset.tool) return this.setTool(target.dataset.tool);
            if (target.dataset.point) return this.setPointMode(target.dataset.point);
            const actions = {
                close: () => this.close(),
                save: () => this.save(),
                'save-next': () => this.saveAndNext(),
                undo: () => this.undo(),
                redo: () => this.redo(),
                'clear-layer': () => this.clearLayer(),
                'remove-core': () => this.removeCore(),
                'clear-muzzles': () => this.clearMuzzles(),
                fire: () => this.fireTest(),
                import: () => this.applyImport(),
                copy: () => this.copyDesign(),
                download: () => this.downloadDesign()
            };
            actions[target.dataset.action]?.();
        });
        this.baseSizeSelect.onchange = () => this.changeBaseSize(this.baseSizeSelect.value);
        this.turretSizeSelect.onchange = () => this.changeTurretSize(this.turretSizeSelect.value);
        this.rotationSelect.onchange = () => { this.installRotation = Number(this.rotationSelect.value); this.drawPreview(); };
        this.projectileLookSelect.onchange = () => this.changeProjectileCosmetics();
        this.projectileTrailSelect.onchange = () => this.changeProjectileCosmetics();
        this.notesInput.oninput = () => { this.design.notes = this.notesInput.value; this.notifyDraftChange(); };
        this.previewCanvas.onpointermove = event => this.updatePreviewAim(event);
        this.canvas.oncontextmenu = event => event.preventDefault();
        this.canvas.onpointerdown = event => this.beginStroke(event);
        this.canvas.onpointermove = event => this.moveStroke(event);
        this.canvas.onpointerup = event => this.endStroke(event);
        this.canvas.onpointercancel = () => this.cancelStroke();
        globalThis.addEventListener?.('keydown', event => {
            if (!this.active) return;
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                event.shiftKey ? this.redo() : this.undo();
            }
        });
    }

    open(partId = null, options = {}) {
        if (typeof partId === 'object' && partId !== null) { options = partId; partId = null; }
        this.configureCallbacks(options);
        if (partId) {
            const definition = options.fallbackDefinition || PartsLibrary[partId];
            if (!definition) throw new Error(`unknown part id: ${partId}`);
            const source = options.draft
                ? validateStagedDesignDocument(options.draft, partId)
                : createBlankDesignForPart(partId, definition);
            this.loadDesign(source, definition);
        } else {
            this.loadDesign(createBlankPartDesign());
        }
        this.active = true;
        this.ui.style.display = 'block';
        if (this.game?.input) this.game.input.active = false;
        this.resizeCanvas();
        this.startPreviewAnimation();
        return this;
    }

    openPart(partId, options = {}) { return this.open(partId, options); }

    configureCallbacks({ onStagedSave, onSave, onNext, onNextPart, onDraftChange, onClose } = {}) {
        this.stagedSaveCallback = onStagedSave || onSave || null;
        this.nextPartCallback = onNext || onNextPart || null;
        this.draftChangeCallback = onDraftChange || null;
        this.closeCallback = onClose || null;
        this.ui.querySelector('[data-action="save-next"]').style.display = this.nextPartCallback ? '' : 'none';
    }

    loadPart(partId, partsLibrary = PartsLibrary) {
        const definition = partsLibrary?.[assertStablePartId(partId)];
        if (!definition) throw new Error(`unknown part id: ${partId}`);
        this.loadDesign(createBlankDesignForPart(partId, definition), definition);
        return this;
    }

    loadDesign(value, fallbackDefinition = null) {
        let design = value;
        if (design.version === 1) design = upgradeLegacyPartDesign(design);
        this.design = validateLooseV2(design);
        this.currentPartId = design.partId || null;
        this.currentPartType = design.partType || design.type;
        this.fallbackDefinition = fallbackDefinition || this.fallbackDefinition;
        this.layer = 'base';
        this.tool = 'pencil';
        this.pointMode = null;
        this.turretVariants.clear();
        this.histories.clear();
        this.coreScratch = this.design.coreEffect
            ? clone(this.design.coreEffect)
            : blankRasterVisual(this.design.palette);
        this.notesInput.value = this.design.notes || '';
        this.baseSizeSelect.value = footprintKey(this.design.footprint);
        this.refreshTurretSizeOptions();
        this.turretSizeSelect.value = footprintKey(this.design.turretFootprint);
        this.projectileLookSelect.value = this.design.projectileLook;
        this.projectileTrailSelect.value = this.design.projectileTrail;
        this.identity.textContent = `${this.currentPartId || 'new part'} · ${this.design.name}`;
        this.ensureHistory('base');
        this.ensureHistory('turret');
        this.ensureHistory('core');
        this.ensureHistory('drone');
        this.renderPalette();
        this.syncControls();
        this.resizeCanvas();
    }

    close() {
        const wasActive = this.active;
        const id = this.currentPartId;
        this.active = false;
        this.continuousFire = false;
        this.ui.style.display = 'none';
        this.stopPreviewAnimation();
        if (this.game?.input) this.game.input.active = true;
        if (wasActive) this.closeCallback?.(id);
    }

    setLayer(layer) {
        if (!this.layerAvailable(layer)) return;
        this.layer = layer;
        this.pointMode = null;
        this.ensureHistory(layer);
        this.syncControls();
        this.resizeCanvas();
    }

    setTool(tool) {
        this.tool = tool;
        this.pointMode = null;
        this.syncControls();
    }

    setPointMode(mode) {
        if (mode === 'base') this.setLayer('base');
        else if (mode === 'turret' || mode === 'muzzle') this.setLayer('turret');
        if (!this.layerAvailable(this.layer)) return;
        this.pointMode = this.pointMode === mode ? null : mode;
        this.syncControls();
    }

    layerAvailable(layer) {
        if (layer === 'turret') return this.currentPartType === PartType.WEAPON && Boolean(this.design.layers.turret);
        if (layer === 'drone') return this.currentPartType === PartType.DRONE && Boolean(this.design.drone);
        return layer === 'base' || layer === 'core';
    }

    activeRaster() {
        if (this.layer === 'base') return { pixels: this.design.layers.base, grid: this.design.grid, palette: this.design.palette };
        if (this.layer === 'turret') return { pixels: this.design.layers.turret, grid: this.design.turretGrid, palette: this.design.palette };
        if (this.layer === 'core') {
            return { pixels: this.coreScratch.layers.base, grid: this.coreScratch.grid, palette: this.coreScratch.palette };
        }
        return { pixels: this.design.drone.layers.base, grid: this.design.drone.grid, palette: this.design.drone.palette };
    }

    ensureHistory(layer) {
        if (!this.layerAvailable(layer) && layer !== 'core') return null;
        const previous = this.layer;
        this.layer = layer;
        const raster = this.activeRaster();
        this.layer = previous;
        if (!this.histories.has(layer)) this.histories.set(layer, new RasterHistory(raster.pixels));
        return this.histories.get(layer);
    }

    setActivePixels(pixels) {
        if (this.layer === 'base') this.design.layers.base = [...pixels];
        else if (this.layer === 'turret') this.design.layers.turret = [...pixels];
        else if (this.layer === 'core') {
            this.coreScratch.layers.base = [...pixels];
            this.design.coreEffect = clone(this.coreScratch);
        }
        else this.design.drone.layers.base = [...pixels];
    }

    beginStroke(event) {
        const point = this.canvasPoint(event);
        if (!point) return;
        this.canvas.setPointerCapture?.(event.pointerId);
        if (this.pointMode) {
            this.placePoint(point);
            return;
        }
        this.strokeStart = point;
        this.strokePixels = [...this.activeRaster().pixels];
        this.strokeTool = event.button === 2 ? 'eraser' : this.tool;
        if (this.tool === 'fill') return this.endStroke(event);
        if (this.strokeTool === 'pencil' || this.strokeTool === 'eraser') this.paintStroke(point, this.strokeTool);
    }

    moveStroke(event) {
        if (!this.strokeStart || !this.strokePixels) return;
        const point = this.canvasPoint(event);
        if (!point) return;
        if (this.strokeTool === 'pencil' || this.strokeTool === 'eraser') {
            const start = this.lastStrokePoint || this.strokeStart;
            const raster = this.activeRaster();
            this.setActivePixels(drawRasterStroke(raster.pixels, raster.grid.width, raster.grid.height, this.strokeTool, start, point, this.colorIndex));
            this.lastStrokePoint = point;
            this.drawAll();
        } else {
            this.drawCanvasPreview(point);
        }
    }

    endStroke(event) {
        if (!this.strokeStart || !this.strokePixels) return;
        const point = this.canvasPoint(event) || this.strokeStart;
        const raster = this.activeRaster();
        const freehand = this.strokeTool === 'pencil' || this.strokeTool === 'eraser';
        const next = freehand
            ? [...raster.pixels]
            : drawRasterStroke(
                this.strokePixels,
                raster.grid.width,
                raster.grid.height,
                this.strokeTool,
                this.strokeStart,
                point,
                this.colorIndex
            );
        this.setActivePixels(next);
        this.ensureHistory(this.layer).commit(next);
        this.strokeStart = null;
        this.strokePixels = null;
        this.strokeTool = null;
        this.lastStrokePoint = null;
        this.changed('art updated');
    }

    paintStroke(point, tool = this.tool) {
        const raster = this.activeRaster();
        this.setActivePixels(drawRasterStroke(raster.pixels, raster.grid.width, raster.grid.height, tool, point, point, this.colorIndex));
        this.lastStrokePoint = point;
        this.drawAll();
    }

    cancelStroke() {
        if (this.strokePixels) this.setActivePixels(this.strokePixels);
        this.strokeStart = null;
        this.strokePixels = null;
        this.strokeTool = null;
        this.lastStrokePoint = null;
        this.drawAll();
    }

    placePoint(point) {
        const snapped = { x: point.x + 0.5, y: point.y + 0.5 };
        if (this.pointMode === 'base') this.design.anchors.base = snapped;
        if (this.pointMode === 'turret') this.design.anchors.turret = snapped;
        if (this.pointMode === 'muzzle') {
            if (this.design.muzzles.length >= 16) return this.setStatus('16 muzzles is already ridiculous', true);
            this.design.muzzles.push(snapped);
        }
        this.pointMode = null;
        this.changed('geometry point updated');
    }

    clearMuzzles() { this.design.muzzles = []; this.changed('muzzles cleared'); }

    undo() {
        const history = this.ensureHistory(this.layer);
        if (!history) return;
        this.setActivePixels(history.undo());
        this.changed('undo');
    }

    redo() {
        const history = this.ensureHistory(this.layer);
        if (!history) return;
        this.setActivePixels(history.redo());
        this.changed('redo');
    }

    clearLayer() {
        const raster = this.activeRaster();
        const next = new Array(raster.grid.width * raster.grid.height).fill(0);
        this.setActivePixels(next);
        this.ensureHistory(this.layer).commit(next);
        this.changed(`${this.layer} cleared`);
    }

    removeCore() {
        this.design.coreEffect = null;
        this.coreScratch = blankRasterVisual(this.design.palette);
        this.histories.delete('core');
        this.ensureHistory('core');
        this.changed('spinning core removed');
    }

    changeBaseSize(value) {
        const [width, height] = value.split('x').map(Number);
        if (width === this.design.footprint.width && height === this.design.footprint.height) return;
        const grid = gridDimensions(width, height);
        this.design.footprint = { width, height };
        this.design.grid = grid;
        this.design.layers.base = new Array(grid.width * grid.height).fill(0);
        this.design.anchors.base = centerPoint(grid);
        this.histories.delete('base');
        this.ensureHistory('base');
        this.refreshTurretSizeOptions();
        this.changed('base canvas resized and cleared');
    }

    refreshTurretSizeOptions() {
        const normal = footprintKey(this.design.footprint);
        const swapped = `${this.design.footprint.height}x${this.design.footprint.width}`;
        const choices = [...new Set([normal, swapped])];
        this.turretSizeSelect.replaceChildren(...choices.map(value => makeOption(value, value)));
    }

    changeTurretSize(value) {
        if (value === footprintKey(this.design.turretFootprint)) return;
        this.turretVariants.set(footprintKey(this.design.turretFootprint), {
            pixels: [...this.design.layers.turret],
            pivot: this.design.anchors.turret ? { ...this.design.anchors.turret } : null,
            muzzles: this.design.muzzles.map(point => ({ ...point }))
        });
        const [width, height] = value.split('x').map(Number);
        const grid = gridDimensions(width, height);
        const saved = this.turretVariants.get(value);
        this.design.turretFootprint = { width, height };
        this.design.turretGrid = grid;
        this.design.layers.turret = saved?.pixels || new Array(grid.width * grid.height).fill(0);
        this.design.anchors.turret = saved?.pivot || centerPoint(grid);
        this.design.muzzles = saved?.muzzles || [];
        this.histories.delete('turret');
        this.ensureHistory('turret');
        this.changed(`turret canvas is now ${value}`);
    }

    renderPalette() {
        const host = this.ui.querySelector('[data-role="palette"]');
        const palette = this.activeRaster().palette;
        host.replaceChildren(...palette.map((color, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `pd-swatch${this.colorIndex === index + 1 ? ' is-on' : ''}`;
            button.title = `color ${index + 1}`;
            const input = document.createElement('input');
            input.type = 'color';
            input.value = color;
            input.onclick = event => event.stopPropagation();
            input.oninput = () => {
                const next = input.value.toLowerCase();
                if (this.layer === 'drone') this.design.drone.palette[index] = next;
                else if (this.layer === 'core') {
                    this.coreScratch.palette[index] = next;
                    this.design.coreEffect = clone(this.coreScratch);
                } else this.design.palette[index] = next;
                this.changed('palette updated');
            };
            button.onclick = () => { this.colorIndex = index + 1; this.renderPalette(); };
            button.appendChild(input);
            return button;
        }));
    }

    changeProjectileCosmetics() {
        const look = normalizeProjectileLook(this.projectileLookSelect.value);
        const trail = normalizeProjectileTrail(this.projectileTrailSelect.value);
        if (this.layer === 'drone' && this.design.drone) {
            this.design.drone.projectileLook = look;
            this.design.drone.projectileTrail = trail;
        } else {
            this.design.projectileLook = look;
            this.design.projectileTrail = trail;
        }
        this.changed('projectile cosmetics updated');
    }

    syncControls() {
        for (const button of this.ui.querySelectorAll('[data-layer]')) {
            button.disabled = !this.layerAvailable(button.dataset.layer);
            button.classList.toggle('is-on', button.dataset.layer === this.layer);
        }
        for (const button of this.ui.querySelectorAll('[data-tool]')) button.classList.toggle('is-on', button.dataset.tool === this.tool && !this.pointMode);
        for (const button of this.ui.querySelectorAll('[data-point]')) button.classList.toggle('is-on', button.dataset.point === this.pointMode);
        const projectileType = this.activeProjectileType();
        const projectileLayer = this.currentPartType === PartType.WEAPON || (this.currentPartType === PartType.DRONE && this.layer === 'drone');
        this.projectileControls.style.display = projectileLayer ? '' : 'none';
        const supported = projectileType && supportsProjectileCosmetics(projectileType);
        this.projectileLookSelect.disabled = !supported;
        this.projectileTrailSelect.disabled = !supported;
        const visual = this.layer === 'drone' ? this.design.drone : this.design;
        this.projectileLookSelect.value = visual?.projectileLook || DEFAULT_PROJECTILE_LOOK;
        this.projectileTrailSelect.value = visual?.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
        this.projectileHelp.textContent = !projectileType
            ? 'this part has no projectile.'
            : supported
                ? `live ${projectileType} preview. trail = the glow or particles left behind it.`
                : `${projectileType} uses its own renderer, so cosmetic presets do not apply.`;
        const markers = [];
        if (this.design.anchors.base) markers.push(`base mount: ${formatPoint(this.design.anchors.base)}`);
        if (this.design.anchors.turret) markers.push(`turret pivot: ${formatPoint(this.design.anchors.turret)}`);
        this.design.muzzles.forEach((point, index) => markers.push(`muzzle ${index + 1}: ${formatPoint(point)}`));
        this.ui.querySelector('[data-role="markers"]').innerHTML = markers.join('<br>') || 'no points set';
        this.drawAll();
    }

    resizeCanvas() {
        if (!this.ctx) return;
        const raster = this.activeRaster();
        const maxWidth = Math.max(280, Math.min(720, globalThis.innerWidth * .48));
        const maxHeight = Math.max(320, Math.min(720, globalThis.innerHeight * .68));
        this.editorScale = Math.max(8, Math.min(30, Math.floor(maxWidth / raster.grid.width), Math.floor(maxHeight / raster.grid.height)));
        this.canvas.width = raster.grid.width * this.editorScale;
        this.canvas.height = raster.grid.height * this.editorScale;
        this.drawAll();
    }

    drawAll() {
        this.drawCanvas();
        this.drawPreview();
        this.drawProjectilePreview();
    }

    drawCanvas(pixels = null) {
        const raster = this.activeRaster();
        const data = pixels || raster.pixels;
        const ctx = this.ctx;
        const scale = this.editorScale || 12;
        ctx.fillStyle = '#080c13'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for (let y = 0; y < raster.grid.height; y++) for (let x = 0; x < raster.grid.width; x++) {
            const value = data[y * raster.grid.width + x];
            if (value) { ctx.fillStyle = raster.palette[value - 1] || '#ff00ff'; ctx.fillRect(x * scale, y * scale, scale, scale); }
            ctx.strokeStyle = '#1d2939'; ctx.lineWidth = 1; ctx.strokeRect(x * scale + .5, y * scale + .5, scale - 1, scale - 1);
        }
        const markers = this.layer === 'base'
            ? [{ point: this.design.anchors.base, color: '#68b7ff', label: 'm' }]
            : this.layer === 'turret'
                ? [{ point: this.design.anchors.turret, color: '#ff76de', label: 'p' }, ...this.design.muzzles.map((point, i) => ({ point, color: '#ffb45f', label: String(i + 1) }))]
                : [];
        for (const marker of markers) if (marker.point) drawMarker(ctx, marker.point, scale, marker.color, marker.label);
    }

    drawCanvasPreview(end) {
        const raster = this.activeRaster();
        const preview = drawRasterStroke(this.strokePixels, raster.grid.width, raster.grid.height, this.tool, this.strokeStart, end, this.colorIndex);
        this.drawCanvas(preview);
    }

    drawPreview() {
        const ctx = this.previewCtx;
        if (!ctx) return;
        ctx.fillStyle = '#050810'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.imageSmoothingEnabled = false;
        let definition;
        try { definition = this.createPreviewDefinition(); } catch { return; }
        const center = { x: 154, y: 130 };
        const baseAngle = this.installRotation * Math.PI / 2;
        ctx.strokeStyle = '#17263a';
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) ctx.strokeRect(center.x + x * TILE_SIZE - 14, center.y + y * TILE_SIZE - 14, TILE_SIZE, TILE_SIZE);
        const baseSprite = definition.type === PartType.WEAPON ? definition.baseSprite : definition.sprite;
        baseSprite?.draw(ctx, center.x, center.y, baseAngle, .5, .5);
        const aim = this.previewAim;
        const mount = getAuthoredTurretMount(definition, center.x, center.y, baseAngle);
        const aimAngle = Math.atan2(aim.y - mount.y, aim.x - mount.x);
        if (definition.type === PartType.WEAPON && definition.sprite) definition.sprite.draw(ctx, mount.x, mount.y, aimAngle);
        if (definition.coreEffectSprite) definition.coreEffectSprite.draw(ctx, center.x, center.y, coreEffectRotation(baseAngle));
        if (this.design.drone) this.drawDronePreview(ctx, definition, center, aimAngle);
        this.drawGeometryOverlay(ctx, definition, center, baseAngle, aimAngle);
        for (const projectile of this.previewProjectiles) drawProjectileOnContext(ctx, projectile);
        ctx.strokeStyle = '#d8e8ff'; ctx.beginPath(); ctx.moveTo(aim.x - 5, aim.y); ctx.lineTo(aim.x + 5, aim.y); ctx.moveTo(aim.x, aim.y - 5); ctx.lineTo(aim.x, aim.y + 5); ctx.stroke();
    }

    drawGeometryOverlay(ctx, definition, center, baseAngle, aimAngle) {
        if (definition.type !== PartType.WEAPON) return;
        const mount = getAuthoredTurretMount(definition, center.x, center.y, baseAngle);
        const muzzles = getAuthoredMuzzlePositions(definition, center.x, center.y, baseAngle, aimAngle);
        ctx.save();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = '#53779d'; ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(mount.x, mount.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ff76de'; ctx.beginPath(); ctx.arc(mount.x, mount.y, 3, 0, Math.PI * 2); ctx.fill();
        for (const point of muzzles) { ctx.fillStyle = '#ffb45f'; ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }

    drawDronePreview(ctx, definition, center, aimAngle) {
        const visual = this.design.drone;
        const sprite = new Sprite([...visual.layers.base], 16, 16, 2, paletteMap(visual.palette));
        const position = { x: center.x + 84, y: center.y - 54 };
        sprite.draw(ctx, position.x, position.y, aimAngle, .5, .5);
        ctx.fillStyle = '#8be8ff'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('spawned drone', position.x, position.y + 28);
    }

    drawProjectilePreview() {
        const ctx = this.projectilePreviewCtx;
        if (!ctx) return;
        ctx.fillStyle = '#050810'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const type = this.activeProjectileType();
        if (!type) return;
        const projectile = this.makePreviewProjectile(96, 28, 0, type);
        projectile.x += ((nowMs() / 8) % 180);
        drawProjectileOnContext(ctx, projectile);
    }

    fireTest() {
        const mode = this.fireModeSelect.value;
        if (mode === 'continuous') {
            this.continuousFire = !this.continuousFire;
            this.setStatus(this.continuousFire ? 'continuous fire running' : 'continuous fire stopped');
            return;
        }
        this.continuousFire = false;
        const count = mode === 'burst' ? Math.max(1, this.design.stats.burstCount || 1) : 1;
        this.spawnPreviewShot();
        for (let index = 1; index < count; index++) {
            globalThis.setTimeout?.(() => this.spawnPreviewShot(), index * (this.design.stats.burstInterval || .1) * 1000);
        }
    }

    spawnPreviewShot(skip = false) {
        if (skip || !this.activeProjectileType()) return;
        const definition = this.createPreviewDefinition();
        const center = { x: 154, y: 130 };
        if (this.currentPartType === PartType.DRONE) {
            const origin = { x: center.x + 84, y: center.y - 54 };
            const angle = Math.atan2(this.previewAim.y - origin.y, this.previewAim.x - origin.x);
            const projectile = this.makePreviewProjectile(origin.x, origin.y, angle, this.activeProjectileType());
            this.previewProjectiles.push(projectile);
            return;
        }
        const baseAngle = this.installRotation * Math.PI / 2;
        const mount = getAuthoredTurretMount(definition, center.x, center.y, baseAngle);
        const angle = Math.atan2(this.previewAim.y - mount.y, this.previewAim.x - mount.x);
        const partRef = this.previewPartRef ||= { x: 0, y: 0, rotation: this.installRotation, muzzleCursor: 0 };
        partRef.rotation = this.installRotation;
        const positions = getAuthoredMuzzlePositions(definition, center.x, center.y, baseAngle, angle);
        const start = partRef.muzzleCursor % Math.max(1, positions.length);
        partRef.muzzleCursor = (start + 1) % Math.max(1, positions.length);
        partRef.authoredShotMuzzles = positions;
        partRef.authoredShotMuzzleStart = start;
        const origin = positions[start] || mount;
        this.previewWeaponSystem(definition).spawnProjectile(definition, origin.x, origin.y, angle, partRef);
    }

    previewWeaponSystem(definition) {
        const previewGame = {
            projectiles: this.previewProjectiles,
            playerShip: { stats: {}, permanentStats: {}, stealthTimer: 0 },
            audio: { play() {}, playEvent() {} },
            designer: { active: false }
        };
        return new WeaponSystem(previewGame, { random: () => .5 });
    }

    makePreviewProjectile(x, y, angle, type) {
        const blueprint = this.currentPartType === PartType.DRONE
            ? resolveDroneBlueprint(this.design.drone?.blueprintId)
            : null;
        const projectile = new Projectile(
            x, y, angle, type,
            blueprint?.projectileSpeed || this.design.stats.projectileSpeed || 600,
            'player', this.design.stats.damage || 1,
            blueprint?.projectileLifetime ?? this.design.stats.lifetime ?? null
        );
        const visual = this.currentPartType === PartType.DRONE ? this.design.drone : this.design;
        projectile.projectileLook = visual?.projectileLook || DEFAULT_PROJECTILE_LOOK;
        projectile.projectileTrail = visual?.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
        if (this.design.stats.range) projectile.beamLength = this.design.stats.range;
        return projectile;
    }

    activeProjectileType() {
        if (this.currentPartType === PartType.WEAPON) return this.design.stats.projectileType || null;
        if (this.currentPartType === PartType.DRONE) return resolveDroneBlueprint(this.design.drone?.blueprintId).projectileType || null;
        return null;
    }

    updatePreviewAim(event) {
        const rect = this.previewCanvas.getBoundingClientRect();
        this.previewAim = {
            x: (event.clientX - rect.left) * this.previewCanvas.width / Math.max(1, rect.width),
            y: (event.clientY - rect.top) * this.previewCanvas.height / Math.max(1, rect.height)
        };
        this.drawPreview();
    }

    startPreviewAnimation() {
        if (this.previewAnimationFrame !== null) return;
        const tick = time => {
            this.previewAnimationFrame = null;
            if (!this.active) return;
            const dt = Math.min(.05, Math.max(0, (time - (this.previewLastFrame || time)) / 1000));
            this.previewLastFrame = time;
            if (this.continuousFire && time >= this.nextPreviewShotAt) {
                this.spawnPreviewShot();
                this.nextPreviewShotAt = time + Math.max(16, (this.design.stats.cooldown || .15) * 1000);
            }
            for (const projectile of this.previewProjectiles) {
                if (!projectile.isBeam) { projectile.x += (projectile.vx || Math.cos(projectile.angle) * projectile.speed) * dt; projectile.y += (projectile.vy || Math.sin(projectile.angle) * projectile.speed) * dt; }
                projectile.life -= dt;
            }
            this.previewProjectiles = this.previewProjectiles.filter(projectile => projectile.life > 0 && projectile.x < 520 && projectile.y > -100 && projectile.y < 360);
            this.drawPreview();
            this.drawProjectilePreview();
            this.previewAnimationFrame = requestFrame(tick);
        };
        this.previewAnimationFrame = requestFrame(tick);
    }

    stopPreviewAnimation() {
        if (this.previewAnimationFrame !== null) cancelFrame(this.previewAnimationFrame);
        this.previewAnimationFrame = null;
        this.previewLastFrame = 0;
    }

    createPreviewDefinition() {
        const base = this.fallbackDefinition || {
            id: this.currentPartId || 'preview', name: this.design.name,
            type: this.currentPartType, width: this.design.footprint.width,
            height: this.design.footprint.height, stats: this.design.stats
        };
        const definition = {
            ...base,
            id: this.currentPartId || base.id || 'preview',
            stats: clone(this.design.stats),
            sprite: base.sprite,
            baseSprite: base.baseSprite
        };
        applyVisualDesignOverride(definition, this.toDesignDocument());
        return definition;
    }

    toDesignDocument() { return clone(this.design); }
    getValidatedDesignDocument() { return validateStagedDesignDocument(this.toDesignDocument(), this.currentPartId); }

    stageSave() {
        const design = this.getValidatedDesignDocument();
        this.stagedSaveCallback?.(design);
        return design;
    }

    save() {
        try {
            const design = this.stageSave();
            this.setStatus('changes staged');
            this.close();
            return design;
        } catch (error) { this.setStatus(error.message || 'could not save', true); return null; }
    }

    saveAndNext() {
        try {
            const design = this.stageSave();
            this.nextPartCallback?.(design, design.partId || null);
            return design;
        } catch (error) { this.setStatus(error.message || 'could not save', true); return null; }
    }

    notifyDraftChange() {
        if (!this.draftChangeCallback || !this.currentPartId) return;
        try { this.draftChangeCallback(this.getValidatedDesignDocument()); } catch { /* typing may be incomplete */ }
    }

    changed(message) {
        this.setStatus(message);
        this.renderPalette();
        this.syncControls();
        this.notifyDraftChange();
    }

    applyImport() {
        try {
            let imported;
            try { imported = parsePartDesign(this.importInput.value); }
            catch { imported = parseLegacyPartDesign(this.importInput.value); }
            if (imported.version === 1) imported = upgradeLegacyPartDesign(imported);
            if (this.currentPartId) imported.partId = this.currentPartId;
            imported.partType = this.currentPartType;
            this.loadDesign(imported, this.fallbackDefinition);
            this.changed('design imported');
        } catch (error) { this.setStatus(error.message || 'could not import', true); }
    }

    async copyDesign() {
        try { await navigator.clipboard.writeText(serializePartDesign(this.design)); this.setStatus('design copied'); }
        catch (error) { this.setStatus(error.message || 'could not copy', true); }
    }

    downloadDesign() {
        try {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([serializePartDesign(this.design)], { type: 'application/json' }));
            link.download = `${safeName(this.design.name)}.framebound-part.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.setStatus('design downloaded');
        } catch (error) { this.setStatus(error.message || 'could not download', true); }
    }

    canvasPoint(event) {
        const raster = this.activeRaster();
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) * this.canvas.width / Math.max(1, rect.width) / this.editorScale);
        const y = Math.floor((event.clientY - rect.top) * this.canvas.height / Math.max(1, rect.height) / this.editorScale);
        return x >= 0 && y >= 0 && x < raster.grid.width && y < raster.grid.height ? { x, y } : null;
    }

    setStatus(message, isError = false) {
        if (!this.status) return;
        this.status.style.color = isError ? '#ff7d8e' : '#78e6a2';
        this.status.textContent = message;
    }
    clearStatus() { this.setStatus(''); }
}

function legacyDefinitionToDesign(partId, definition) {
    const grid = gridDimensions(definition.width, definition.height, 8);
    const isWeapon = definition.type === PartType.WEAPON;
    const baseSprite = isWeapon ? (definition.baseSprite || blankLegacySprite(grid)) : definition.sprite;
    const turretSprite = isWeapon ? definition.sprite : null;
    const type = ['hull', 'weapon', 'thruster', 'accelerant', 'rocket_bay', 'booster', 'drone', 'shield'].includes(definition.type)
        ? definition.type : 'hull';
    const design = {
        format: 'framebound-part-design', version: 1,
        name: definition.name || partId, type,
        footprint: { width: definition.width, height: definition.height }, grid,
        layers: { base: legacyPixels(baseSprite, grid), turret: turretSprite ? legacyPixels(turretSprite, grid) : null },
        anchors: { base: legacyAnchor(baseSprite, grid), turret: legacyAnchor(turretSprite, grid) },
        barrel: null, rotationOffset: definition.rotationOffset || 0,
        projectileLook: definition.projectileLook || DEFAULT_PROJECTILE_LOOK,
        projectileTrail: definition.projectileTrail || DEFAULT_PROJECTILE_TRAIL,
        coreEffect: null, drone: null, stats: clone(definition.stats || {}), notes: ''
    };
    if (turretSprite && definition.stats?.barrelPosition) {
        const pivot = design.anchors.turret || centerPoint(grid);
        design.barrel = {
            x: pivot.x + (definition.stats.barrelPosition.x || 0) / (turretSprite.scale || 4),
            y: pivot.y + (definition.stats.barrelPosition.y || 0) / (turretSprite.scale || 4)
        };
    }
    if (definition.coreEffectSprite?.width === 8 && definition.coreEffectSprite?.height === 8) {
        design.coreEffect = {
            grid: { width: 8, height: 8 },
            layers: { base: legacyPixels(definition.coreEffectSprite, { width: 8, height: 8 }).map(value => value ? 1 : 0) },
            color: definition.coreEffectSprite.colorMap?.[1] || '#55ccff'
        };
    }
    if (definition.type === PartType.DRONE) {
        const blueprint = resolveDroneBlueprint(definition.stats?.droneType || 'striker');
        design.drone = {
            blueprintId: blueprint.id, grid: { width: 8, height: 8 },
            layers: { base: blueprint.spriteRows.flatMap(row => [...row].map(Number)) },
            projectileLook: blueprint.projectileLook || DEFAULT_PROJECTILE_LOOK,
            projectileTrail: blueprint.projectileTrail || DEFAULT_PROJECTILE_TRAIL
        };
    }
    design.partId = partId;
    design.partType = definition.type;
    return design;
}

function authoredDefinitionToDesign(partId, definition) {
    const geometry = definition.visualGeometry;
    const turretFootprint = footprintFromGrid(geometry.turretGrid);
    const design = createBlankPartDesign({
        name: definition.name || partId, type: definition.type,
        width: definition.width, height: definition.height,
        turretWidth: turretFootprint.width, turretHeight: turretFootprint.height,
        palette: spritePalette(definition.baseSprite || definition.sprite)
    });
    design.partId = partId;
    design.partType = definition.type;
    design.layers.base = [...(definition.baseSprite || definition.sprite).data];
    design.layers.turret = definition.type === PartType.WEAPON ? [...definition.sprite.data] : null;
    design.anchors.base = { ...geometry.baseMount };
    design.anchors.turret = { ...geometry.turretPivot };
    design.muzzles = geometry.muzzles.map(point => ({ ...point }));
    design.stats = clone(definition.stats || {});
    design.projectileLook = definition.projectileLook || DEFAULT_PROJECTILE_LOOK;
    design.projectileTrail = definition.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
    return design;
}

export function getDesignerPreviewMount(definition, partX, partY, aim = { x: partX + 1, y: partY }, baseAngle = 0) {
    if (definition.visualGeometry?.version === 2) return getAuthoredTurretMount(definition, partX, partY, baseAngle);
    const sprite = definition.baseSprite;
    if (!sprite) return { x: partX, y: partY };
    const local = { x: (sprite.anchorX - .5) * sprite.width * sprite.scale, y: (sprite.anchorY - .5) * sprite.height * sprite.scale };
    const rotated = rotateVector(local.x, local.y, baseAngle);
    return { x: partX + rotated.x, y: partY + rotated.y };
}

export function getDesignerPreviewMuzzle(definition, partX, partY, angle, baseAngle = 0) {
    if (definition.visualGeometry?.version === 2) {
        return getAuthoredMuzzlePositions(definition, partX, partY, baseAngle, angle)[0] || { x: partX, y: partY };
    }
    const barrel = definition.stats?.barrelPosition;
    if (barrel) {
        return { x: partX + Math.cos(angle) * barrel.x - Math.sin(angle) * barrel.y, y: partY + Math.sin(angle) * barrel.x + Math.cos(angle) * barrel.y };
    }
    return { x: partX + Math.cos(angle) * TILE_SIZE * .6, y: partY + Math.sin(angle) * TILE_SIZE * .6 };
}

export function getDesignerPreviewDronePosition(partX, partY) { return { x: partX + TILE_SIZE * 3, y: partY - TILE_SIZE * 2 }; }

function validateLooseV2(design) {
    const metadata = { partId: design.partId, partType: design.partType };
    const normalized = parsePartDesign(serializePartDesign(design));
    if (normalized.version !== 2) throw new Error('designer requires a v2 document');
    if (metadata.partId) normalized.partId = metadata.partId;
    if (metadata.partType) normalized.partType = metadata.partType;
    return normalized;
}

function blankDroneVisual(blueprintId) {
    return {
        blueprintId: resolveDroneBlueprint(blueprintId).id,
        resolution: 16, grid: { width: 16, height: 16 },
        palette: [...DEFAULT_DRONE_PALETTE],
        layers: { base: new Array(256).fill(0) },
        projectileLook: DEFAULT_PROJECTILE_LOOK,
        projectileTrail: DEFAULT_PROJECTILE_TRAIL
    };
}

function blankRasterVisual(palette) {
    return { resolution: 16, grid: { width: 16, height: 16 }, palette: [...palette], layers: { base: new Array(256).fill(0) } };
}

function legacyPixels(sprite, grid) {
    return Array.from({ length: grid.width * grid.height }, (_, index) => {
        const value = sprite?.data?.[index];
        return Number.isInteger(value) && value >= 0 && value <= 2 ? value : 0;
    });
}
function legacyAnchor(sprite, grid) { return sprite ? { x: (sprite.anchorX ?? .5) * grid.width, y: (sprite.anchorY ?? .5) * grid.height } : null; }
function blankLegacySprite(grid) { return { data: new Array(grid.width * grid.height).fill(0), width: grid.width, height: grid.height, scale: 4, anchorX: .5, anchorY: .5 }; }
function footprintFromGrid(grid) {
    for (const value of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x2']) {
        const [width, height] = value.split('x').map(Number);
        const expected = gridDimensions(width, height);
        if (expected.width === grid.width && expected.height === grid.height) return { width, height };
    }
    throw new Error('unknown authored turret footprint');
}
function spritePalette(sprite) {
    const entries = Object.entries(sprite?.colorMap || {}).sort(([a], [b]) => Number(a) - Number(b));
    return entries.length ? entries.map(([, color]) => color) : ['#26d426', '#333333'];
}
function paletteMap(palette) { return Object.fromEntries(palette.map((color, index) => [index + 1, color])); }
function centerPoint(grid) { return { x: grid.width / 2, y: grid.height / 2 }; }
function footprintKey(footprint) { return `${footprint.width}x${footprint.height}`; }
function formatPoint(point) { return `${point.x}, ${point.y}`; }
function makeButton(label, data = {}) { const button = document.createElement('button'); button.type = 'button'; button.className = 'pd-btn'; button.textContent = label; Object.assign(button.dataset, data); return button; }
function makeOption(label, value) { const option = document.createElement('option'); option.value = value; option.textContent = label; return option; }
function drawMarker(ctx, point, scale, color, label) { const x = point.x * scale; const y = point.y * scale; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(4, scale * .22), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#07101a'; ctx.font = `bold ${Math.max(8, scale * .35)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y); }
function safeName(value) { return String(value || 'part').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part'; }
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function assertStablePartId(partId) { if (typeof partId !== 'string' || !PART_ID_PATTERN.test(partId)) throw new Error(`invalid part id: ${partId}`); return partId; }
function nowMs() { return globalThis.performance?.now?.() ?? Date.now(); }
function requestFrame(callback) { return globalThis.requestAnimationFrame?.(callback) ?? globalThis.setTimeout(() => callback(nowMs()), 16); }
function cancelFrame(handle) { if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(handle); else globalThis.clearTimeout(handle); }
