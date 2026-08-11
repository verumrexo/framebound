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
import { getMountedTurretPosition } from '../renderers/ShipAssemblyRenderer.js';
import { Projectile } from '../../shared/entities/Projectile.js';
import {
    getDroneBlueprintVisual,
    registerDroneVisualOverride,
    resolveDroneBlueprint
} from '../../shared/combat/DroneBlueprints.js';
import { drawProjectileOnContext } from '../renderers/ProjectileRenderer.js';
import {
    DEFAULT_PROJECTILE_LOOK,
    DEFAULT_PROJECTILE_TRAIL,
    PROJECTILE_LOOK_PRESETS,
    PROJECTILE_TRAIL_PRESETS,
    normalizeProjectileLook,
    normalizeProjectileTrail,
    supportsProjectileCosmetics
} from '../../shared/combat/ProjectileVisuals.js';
import {
    CORE_EFFECT_GRID,
    DEFAULT_CORE_EFFECT_COLOR,
    coreEffectFromSprite,
    coreEffectRotation,
    createCoreEffectSprite
} from '../../shared/parts/CoreEffect.js';

const COLORS = { 1: '#26d426', 2: '#333' };
const TYPE_LABELS = [
    ['hull', 'hull'], ['weapon', 'weapon'], ['thruster', 'thruster'],
    ['accelerant', 'accelerant'], ['rocket_bay', 'rocket bay'],
    ['booster', 'booster'], ['drone', 'drone'], ['shield', 'shield'],
    ['utility', 'utility'], ['core', 'core']
];

const DESIGN_DOCUMENT_TYPES = new Set([
    PartType.HULL,
    PartType.WEAPON,
    PartType.THRUSTER,
    PartType.ACCELERANT,
    PartType.ROCKET_BAY,
    PartType.BOOSTER,
    PartType.DRONE,
    PartType.SHIELD
]);
const PART_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

/**
 * Turn a runtime part definition back into the serializable document used by
 * the designer. This deliberately copies every pixel and stat value instead
 * of reconstructing a prettier approximation.
 */
export function partDefinitionToDesign(partId, definition) {
    assertStablePartId(partId);
    if (!definition || typeof definition !== 'object') {
        throw new Error(`part definition is missing: ${partId}`);
    }

    const width = definition.width;
    const height = definition.height;
    const grid = gridDimensions(width, height);
    const isWeapon = definition.type === PartType.WEAPON;
    const turretSprite = isWeapon ? definition.sprite : null;
    const baseSprite = isWeapon
        ? (definition.baseSprite || fallbackWeaponBaseSprite(width, height))
        : definition.sprite;

    const design = createBlankPartDesign({
        name: definition.name || partId,
        type: DESIGN_DOCUMENT_TYPES.has(definition.type) ? definition.type : PartType.HULL,
        width,
        height
    });
    design.partId = partId;
    design.partType = definition.type;
    design.layers.base = spritePixels(baseSprite, grid, 'base');
    design.layers.turret = turretSprite
        ? spritePixels(turretSprite, grid, 'turret')
        : null;
    design.anchors.base = spriteAnchor(baseSprite, grid);
    design.anchors.turret = turretSprite ? spriteAnchor(turretSprite, grid) : null;
    design.rawAnchors = {
        base: rawSpriteAnchor(baseSprite, grid),
        turret: turretSprite ? rawSpriteAnchor(turretSprite, grid) : null
    };
    design.rotationOffset = Number.isFinite(definition.rotationOffset)
        ? definition.rotationOffset
        : 0;
    design.projectileLook = definition.projectileLook || DEFAULT_PROJECTILE_LOOK;
    design.projectileTrail = definition.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
    if (definition.coreEffectSprite) {
        design.coreEffect = coreEffectFromSprite(definition.coreEffectSprite);
    }
    design.stats = cloneSerializable(definition.stats || {});
    if (definition.type === PartType.DRONE) {
        const blueprintId = definition.stats?.droneType || 'striker';
        design.drone = droneVisualFromBlueprint(blueprintId);
    }

    const barrelPosition = definition.stats?.barrelPosition;
    if (turretSprite && barrelPosition && Number.isFinite(barrelPosition.x) && Number.isFinite(barrelPosition.y)) {
        const pivot = design.anchors.turret || { x: grid.width / 2, y: grid.height / 2 };
        const scale = Number.isFinite(turretSprite.scale) && turretSprite.scale > 0 ? turretSprite.scale : 1;
        const rawPivot = design.rawAnchors.turret || pivot;
        const rawBarrel = {
            x: rawPivot.x + Number(barrelPosition.x) / scale,
            y: rawPivot.y + Number(barrelPosition.y) / scale
        };
        design.barrel = snapDesignPoint(rawBarrel, grid);
        design.rawBarrel = rawBarrel;
    }

    return design;
}

/**
 * Validate a staged document while retaining the stable id metadata needed by
 * a dev tool. `serializePartDesign` remains the schema authority; the extra
 * fields are intentionally restored after its canonical validation pass.
 */
export function validateStagedDesignDocument(design, partId = design?.partId) {
    const stablePartId = partId === null || partId === undefined ? null : assertStablePartId(partId);
    if (design?.partId && stablePartId && design.partId !== stablePartId) {
        throw new Error('staged design part id does not match the open part');
    }
    const validated = parsePartDesign(serializePartDesign(design));
    if (stablePartId) validated.partId = stablePartId;
    if (design?.partType !== undefined) {
        if (!Object.values(PartType).includes(design.partType)) {
            throw new Error(`unsupported part type: ${design.partType}`);
        }
        validated.partType = design.partType;
    }
    if (design?.rawAnchors !== undefined) {
        validated.rawAnchors = normalizeRawAnchors(design.rawAnchors, validated.grid);
    }
    if (design?.rawBarrel !== undefined) {
        validated.rawBarrel = normalizeRawPoint(design.rawBarrel, validated.grid, 'raw barrel');
    }
    return validated;
}

function assertStablePartId(partId) {
    if (typeof partId !== 'string' || !PART_ID_PATTERN.test(partId)) {
        throw new Error(`invalid part id: ${partId}`);
    }
    return partId;
}

function cloneSerializable(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function spritePixels(sprite, grid, label) {
    if (!sprite || !Array.isArray(sprite.data) || sprite.width !== grid.width || sprite.height !== grid.height) {
        throw new Error(`${label} sprite does not match the part footprint`);
    }
    // A few legacy definitions contain short/long arrays. Sprite.generate only
    // consumes the footprint-sized prefix, so mirror that runtime behavior and
    // make missing cells transparent for the stricter design document schema.
    return Array.from({ length: grid.width * grid.height }, (_, index) => {
        const pixel = sprite.data[index];
        return Number.isInteger(pixel) && pixel >= 0 && pixel <= 2 ? pixel : 0;
    });
}

function spriteAnchor(sprite, grid) {
    return snapDesignPoint(rawSpriteAnchor(sprite, grid), grid);
}

function rawSpriteAnchor(sprite, grid) {
    if (!sprite || !Number.isFinite(sprite.anchorX) || !Number.isFinite(sprite.anchorY)) return null;
    return { x: sprite.anchorX * grid.width, y: sprite.anchorY * grid.height };
}

function snapDesignPoint(point, grid) {
    if (!point) return null;
    return {
        x: Math.max(0, Math.min(grid.width, Math.round(point.x * 2) / 2)),
        y: Math.max(0, Math.min(grid.height, Math.round(point.y * 2) / 2))
    };
}

function normalizeRawAnchors(value, grid) {
    if (!value || typeof value !== 'object') throw new Error('raw anchors must be an object');
    return {
        base: normalizeRawPoint(value.base, grid, 'raw base anchor'),
        turret: normalizeRawPoint(value.turret, grid, 'raw turret anchor')
    };
}

function normalizeRawPoint(value, grid, label) {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y) ||
        value.x < 0 || value.y < 0 || value.x > grid.width || value.y > grid.height) {
        throw new Error(`${label} is outside the design grid`);
    }
    return { x: Number(value.x), y: Number(value.y) };
}

function fallbackWeaponBaseSprite(width, height) {
    const expected = gridDimensions(width, height);
    const fallback = width === 1 && height === 2 ? Assets.LongHull : Assets.PlayerBase;
    return fallback?.width === expected.width && fallback?.height === expected.height
        ? fallback
        : { data: new Array(expected.width * expected.height).fill(0), width: expected.width, height: expected.height, scale: 1, anchorX: .5, anchorY: .5 };
}

function droneVisualFromBlueprint(blueprintId) {
    const blueprint = getDroneBlueprintVisual(blueprintId);
    const rows = blueprint.spriteRows || resolveDroneBlueprint(blueprintId).spriteRows;
    const pixels = rows?.flatMap(row => [...row].map(Number)) || new Array(64).fill(0);
    return {
        blueprintId: blueprint.id,
        grid: { width: 8, height: 8 },
        layers: { base: pixels },
        projectileLook: blueprint.projectileType ? (blueprint.projectileLook || DEFAULT_PROJECTILE_LOOK) : DEFAULT_PROJECTILE_LOOK,
        projectileTrail: blueprint.projectileType ? (blueprint.projectileTrail || DEFAULT_PROJECTILE_TRAIL) : DEFAULT_PROJECTILE_TRAIL
    };
}

export function getDesignerPreviewDronePosition(partX, partY) {
    return {
        x: partX + TILE_SIZE * 1.9,
        y: partY - TILE_SIZE * 0.6
    };
}

function getDesignerPreviewDroneMuzzle(originX, originY, angle) {
    const offset = TILE_SIZE * 0.6;
    return {
        x: originX + Math.cos(angle) * offset,
        y: originY + Math.sin(angle) * offset
    };
}

export class Designer {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.currentSize = [1, 1];
        this.gridWidth = 8;
        this.gridHeight = 8;
        this.gridData = new Array(64).fill(0);
        this.turretGridData = new Array(64).fill(0);
        this.droneGridData = new Array(64).fill(0);
        this.coreGridData = new Array(64).fill(0);
        this.coreColor = DEFAULT_CORE_EFFECT_COLOR;
        this.coreEnabled = false;
        this.droneVisual = null;
        this.editorMode = 'part';
        this.weaponProjectileLook = DEFAULT_PROJECTILE_LOOK;
        this.weaponProjectileTrail = DEFAULT_PROJECTILE_TRAIL;
        this.droneProjectileLook = DEFAULT_PROJECTILE_LOOK;
        this.droneProjectileTrail = DEFAULT_PROJECTILE_TRAIL;
        this.importedStats = {};
        this.currentPartId = null;
        this.currentPartType = PartType.HULL;
        this.stagedSaveCallback = null;
        this.nextPartCallback = null;
        this.draftChangeCallback = null;
        this.closeCallback = null;
        this.rawAnchors = { base: null, turret: null };
        this.rawBarrel = null;
        this.basePivot = null;
        this.turretPivot = null;
        this.barrelPos = null;
        this.pivotMode = false;
        this.barrelMode = false;
        this.turretMode = false;
        this.previewAim = { x: 236, y: 105 };
        this.previewFire = null;
        this.previewAnimationFrame = null;
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
            <div id="projectile-visual-controls" style="display:none;margin:10px 0;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap">
                <label>projectile look <select id="projectile-look" aria-label="projectile look" style="${fieldStyle()}"></select></label>
                <label>trail <select id="projectile-trail" aria-label="projectile trail" style="${fieldStyle()}"></select></label>
                <canvas id="projectile-preview" width="190" height="42" aria-label="live projectile preview" style="${canvasStyle('#8b4cc7')};width:190px;height:42px;cursor:default"></canvas>
                <span id="projectile-availability" style="color:#aabbff;font-size:9px;max-width:220px"></span>
            </div>
            <div id="visual-layer-controls" style="display:none;margin:10px 0;color:#aabbff">
                <label>visual layer <select id="visual-layer-select" aria-label="visual layer" style="${fieldStyle()}">
                    <option value="part">part</option><option value="core">spinning core</option><option value="spawned">spawned drone</option>
                </select></label>
                <span id="drone-blueprint-label" style="font-size:9px;margin-left:8px"></span>
            </div>
            <div id="core-visual-controls" style="display:none;margin:10px 0;color:#d7b8ff;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap">
                <label><input type="checkbox" id="core-effect-enabled"> enabled</label>
                <label>color <input type="color" id="core-effect-color" value="${DEFAULT_CORE_EFFECT_COLOR}" aria-label="spinning core color" style="width:38px;height:28px;padding:1px;border:1px solid #b56cff;background:#0f3460"></label>
                <code id="core-effect-color-value" aria-label="spinning core hex color">${DEFAULT_CORE_EFFECT_COLOR}</code>
                <span style="font-size:9px;color:#bda4d9">one color · right-click erases</span>
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
                <div id="drone-canvas-wrapper" style="display:none"><div style="color:#00ffff;margin-bottom:4px">spawned drone art</div>
                    <canvas id="droneCanvas" aria-label="spawned drone art canvas" style="${canvasStyle('#00ffff')}"></canvas></div>
                <div id="core-canvas-wrapper" style="display:none"><div style="color:#d7b8ff;margin-bottom:4px">spinning core art</div>
                    <canvas id="coreCanvas" aria-label="spinning core art canvas" style="${canvasStyle('#b56cff')}"></canvas></div>
                <div><div style="color:#aabbff;margin-bottom:4px">ship mount preview</div>
                    <canvas id="mount-preview" width="280" height="210" aria-label="ship mount preview" style="${canvasStyle('#aabbff')};width:280px;height:210px"></canvas>
                    <div style="color:#8899bb;font-size:9px;margin-top:5px">move over preview to aim · click fire test</div>
                    <button id="btn-fire-test" style="${buttonStyle('#8b4cc7')}">fire test</button>
                </div>
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
                <button id="btn-next" style="${buttonStyle('#2b7dbd')};display:none">save &amp; next</button>
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
        this.droneCanvas = this.ui.querySelector('#droneCanvas');
        this.droneCtx = this.droneCanvas.getContext('2d');
        this.coreCanvas = this.ui.querySelector('#coreCanvas');
        this.coreCtx = this.coreCanvas.getContext('2d');
        this.previewCanvas = this.ui.querySelector('#mount-preview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.fireTestButton = this.ui.querySelector('#btn-fire-test');
        this.saveButton = this.ui.querySelector('#btn-save');
        this.nextButton = this.ui.querySelector('#btn-next');
        this.nameInput = this.ui.querySelector('#design-name');
        this.typeSelect = this.ui.querySelector('#design-type');
        this.sizeSelect = this.ui.querySelector('#design-size');
        this.notesInput = this.ui.querySelector('#design-notes');
        this.turretModeCheckbox = this.ui.querySelector('#turret-mode');
        this.pivotModeCheckbox = this.ui.querySelector('#pivot-mode');
        this.barrelModeCheckbox = this.ui.querySelector('#barrel-mode');
        this.facingSelect = this.ui.querySelector('#turret-facing');
        this.projectileVisualControls = this.ui.querySelector('#projectile-visual-controls');
        this.projectileLookSelect = this.ui.querySelector('#projectile-look');
        this.projectileTrailSelect = this.ui.querySelector('#projectile-trail');
        this.projectilePreviewCanvas = this.ui.querySelector('#projectile-preview');
        this.projectilePreviewCtx = this.projectilePreviewCanvas.getContext('2d');
        this.projectileAvailability = this.ui.querySelector('#projectile-availability');
        this.visualLayerControls = this.ui.querySelector('#visual-layer-controls');
        this.droneVisualControls = this.visualLayerControls;
        this.visualLayerSelect = this.ui.querySelector('#visual-layer-select');
        this.droneEditModeSelect = this.visualLayerSelect;
        this.droneBlueprintLabel = this.ui.querySelector('#drone-blueprint-label');
        this.droneCanvasWrapper = this.ui.querySelector('#drone-canvas-wrapper');
        this.coreVisualControls = this.ui.querySelector('#core-visual-controls');
        this.coreCanvasWrapper = this.ui.querySelector('#core-canvas-wrapper');
        this.coreEnabledCheckbox = this.ui.querySelector('#core-effect-enabled');
        this.coreColorInput = this.ui.querySelector('#core-effect-color');
        this.coreColorValue = this.ui.querySelector('#core-effect-color-value');
        this.projectileLookSelect.replaceChildren(...PROJECTILE_LOOK_PRESETS.map(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.label;
            return option;
        }));
        this.projectileTrailSelect.replaceChildren(...PROJECTILE_TRAIL_PRESETS.map(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.label;
            return option;
        }));
        this.importPanel = this.ui.querySelector('#import-panel');
        this.importInput = this.ui.querySelector('#import-text');
        this.status = this.ui.querySelector('#designer-status');
    }

    bindEvents() {
        this.ui.querySelector('#btn-save').onclick = () => this.save();
        this.ui.querySelector('#btn-next').onclick = () => this.saveAndNext();
        this.ui.querySelector('#btn-fire-test').onclick = () => this.fireTest();
        this.ui.querySelector('#btn-copy').onclick = () => this.copyDesign();
        this.ui.querySelector('#btn-download').onclick = () => this.downloadDesign();
        this.ui.querySelector('#btn-import').onclick = () => this.showImport(true);
        this.ui.querySelector('#btn-apply-import').onclick = () => this.applyImport();
        this.ui.querySelector('#btn-close-import').onclick = () => this.showImport(false);
        this.ui.querySelector('#btn-cancel').onclick = () => this.close();
        this.sizeSelect.onchange = () => { this.resizeGrid(); this.notifyDraftChange(); };
        this.typeSelect.onchange = () => { this.syncTypeAndTurret('type'); this.notifyDraftChange(); };
        this.turretModeCheckbox.onchange = () => { this.syncTypeAndTurret('turret'); this.notifyDraftChange(); };
        this.facingSelect.onchange = () => { this.drawGrid(); this.notifyDraftChange(); };
        this.projectileLookSelect.onchange = () => { this.captureProjectileSelectors(); this.drawPreview(); this.notifyDraftChange(); };
        this.projectileTrailSelect.onchange = () => { this.captureProjectileSelectors(); this.drawPreview(); this.notifyDraftChange(); };
        this.visualLayerSelect.onchange = () => {
            this.editorMode = normalizeEditorMode(this.visualLayerSelect.value);
            this.syncTypeAndTurret('mode');
            this.drawGrid();
            this.notifyDraftChange();
        };
        this.coreEnabledCheckbox.onchange = () => {
            this.coreEnabled = this.coreEnabledCheckbox.checked;
            this.clearStatus();
            this.drawGrid();
            this.reconcilePreviewAnimation();
            this.notifyDraftChange();
        };
        this.coreColorInput.oninput = () => {
            this.coreColor = normalizeCoreColor(this.coreColorInput.value);
            this.coreColorValue.textContent = this.coreColor;
            this.clearStatus();
            this.drawGrid();
            this.notifyDraftChange();
        };
        this.nameInput.oninput = () => { this.drawPreview(); this.notifyDraftChange(); };
        this.notesInput.oninput = () => { this.clearStatus(); this.notifyDraftChange(); };
        this.previewCanvas.onmousemove = event => this.updatePreviewAim(event);
        this.previewCanvas.onmouseleave = () => {
            this.previewAim = null;
            this.drawPreview();
        };
        this.previewCanvas.onclick = () => this.fireTest();
        this.pivotModeCheckbox.onchange = () => {
            this.pivotMode = this.pivotModeCheckbox.checked;
            this.barrelMode = false; this.barrelModeCheckbox.checked = false;
            this.notifyDraftChange();
        };
        this.barrelModeCheckbox.onchange = () => {
            this.barrelMode = this.barrelModeCheckbox.checked;
            this.pivotMode = false; this.pivotModeCheckbox.checked = false;
            this.notifyDraftChange();
        };
        this.bindCanvas(this.canvas, false);
        this.bindCanvas(this.turretCanvas, true);
        this.bindDroneCanvas();
        this.bindCoreCanvas();
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
                if (isTurret) {
                    this.turretPivot = point;
                    this.rawAnchors.turret = null;
                } else {
                    this.basePivot = point;
                    this.rawAnchors.base = null;
                }
            } else if (this.barrelMode && isTurret && event.type === 'mousedown') {
                this.barrelPos = snapPoint(rawX, rawY, this.gridWidth, this.gridHeight);
                this.rawBarrel = null;
            } else {
                const x = Math.floor(rawX); const y = Math.floor(rawY);
                if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) return;
                if (event.buttons !== 1 && event.buttons !== 2) return;
                const data = isTurret ? this.turretGridData : this.gridData;
                data[y * this.gridWidth + x] = event.buttons === 1 ? 1 : 0;
            }
            this.clearStatus(); this.drawGrid(); this.notifyDraftChange();
        };
        canvas.onmousedown = event => { drawing = true; handle(event); };
        canvas.onmousemove = event => { if (drawing && !this.pivotMode && !this.barrelMode) handle(event); };
        canvas.oncontextmenu = event => event.preventDefault();
        window.addEventListener('mouseup', () => { drawing = false; });
    }

    bindDroneCanvas() {
        let drawing = false;
        const handle = event => {
            if (!this.droneVisual) return;
            const rect = this.droneCanvas.getBoundingClientRect();
            const rawX = (event.clientX - rect.left) / rect.width * 8;
            const rawY = (event.clientY - rect.top) / rect.height * 8;
            const x = Math.floor(rawX); const y = Math.floor(rawY);
            if (x < 0 || y < 0 || x >= 8 || y >= 8) return;
            if (event.buttons !== 1 && event.buttons !== 2) return;
            this.droneGridData[y * 8 + x] = event.buttons === 1 ? 1 : 0;
            this.clearStatus(); this.drawGrid(); this.notifyDraftChange();
        };
        this.droneCanvas.onmousedown = event => { drawing = true; handle(event); };
        this.droneCanvas.onmousemove = event => { if (drawing) handle(event); };
        this.droneCanvas.oncontextmenu = event => event.preventDefault();
        window.addEventListener('mouseup', () => { drawing = false; });
    }

    bindCoreCanvas() {
        let drawing = false;
        const handle = event => {
            const rect = this.coreCanvas.getBoundingClientRect();
            const rawX = (event.clientX - rect.left) / rect.width * CORE_EFFECT_GRID.width;
            const rawY = (event.clientY - rect.top) / rect.height * CORE_EFFECT_GRID.height;
            const x = Math.floor(rawX); const y = Math.floor(rawY);
            if (x < 0 || y < 0 || x >= CORE_EFFECT_GRID.width || y >= CORE_EFFECT_GRID.height) return;
            if (event.buttons !== 1 && event.buttons !== 2) return;
            this.coreGridData[y * CORE_EFFECT_GRID.width + x] = event.buttons === 1 ? 1 : 0;
            if (event.buttons === 1) {
                this.coreEnabled = true;
                this.coreEnabledCheckbox.checked = true;
            }
            this.clearStatus(); this.drawGrid(); this.reconcilePreviewAnimation(); this.notifyDraftChange();
        };
        this.coreCanvas.onmousedown = event => { drawing = true; handle(event); };
        this.coreCanvas.onmousemove = event => { if (drawing) handle(event); };
        this.coreCanvas.oncontextmenu = event => event.preventDefault();
        window.addEventListener('mouseup', () => { drawing = false; });
    }

    /**
     * Open a blank designer (legacy behavior) or preload a stable library id.
     * Callbacks are intentionally per-open so normal dev-menu use cannot keep
     * a stale part-lab callback alive.
     */
    open(partId = null, options = {}) {
        if (typeof partId === 'object' && partId !== null) {
            options = partId;
            partId = null;
        }
        this.configureCallbacks(options || {});
        if (partId !== null && partId !== undefined) {
            if (options?.draft) {
                this.loadDesign(
                    validateStagedDesignDocument(options.draft, partId),
                    options.fallbackDefinition || PartsLibrary[partId]
                );
            }
            else this.loadPart(partId);
        } else {
            this.loadDesign(createBlankPartDesign({
                name: 'my part',
                type: PartType.HULL,
                width: 1,
                height: 1
            }));
        }
        this.showImport(false);
        this.active = true;
        this.ui.style.display = 'block';
        this.resizeCanvases();
        this.reconcilePreviewAnimation();
        if (this.game?.input) this.game.input.active = false;
        return this;
    }

    openPart(partId, options = {}) {
        return this.open(partId, options);
    }

    configureCallbacks({ onStagedSave, onSave, onNext, onNextPart, onDraftChange, onClose } = {}) {
        this.stagedSaveCallback = onStagedSave || onSave || null;
        this.nextPartCallback = onNext || onNextPart || null;
        this.draftChangeCallback = onDraftChange || null;
        this.closeCallback = onClose || null;
        if (this.saveButton) {
            this.saveButton.textContent = this.stagedSaveCallback ? 'save changes' : 'add to hangar';
        }
        if (this.nextButton) {
            this.nextButton.style.display = this.nextPartCallback ? 'inline-block' : 'none';
        }
        this.updateFireTestControl();
    }

    loadPart(partId, partsLibrary = PartsLibrary) {
        assertStablePartId(partId);
        const definition = partsLibrary?.[partId];
        if (!definition) throw new Error(`unknown part id: ${partId}`);
        this.loadDesign(partDefinitionToDesign(partId, definition), definition);
        return this;
    }

    close() {
        const wasActive = this.active;
        const closedPartId = this.currentPartId;
        this.active = false;
        this.ui.style.display = 'none';
        this.stopPreviewAnimation();
        this.previewFire = null;
        this.showImport(false);
        if (this.game?.input) this.game.input.active = true;
        if (wasActive) this.closeCallback?.(closedPartId);
        this.currentPartId = null;
    }

    syncTypeAndTurret(source) {
        if (source === 'type') this.turretModeCheckbox.checked = this.typeSelect.value === PartType.WEAPON;
        if (source === 'turret') this.typeSelect.value = this.turretModeCheckbox.checked ? PartType.WEAPON : PartType.HULL;
        this.currentPartType = this.typeSelect.value || PartType.HULL;
        this.turretMode = this.turretModeCheckbox.checked;
        this.ui.querySelector('#turret-canvas-wrapper').style.display = this.turretMode ? 'block' : 'none';
        const isDrone = this.currentPartType === PartType.DRONE;
        this.editorMode = normalizeEditorMode(this.editorMode);
        if (!isDrone && this.editorMode === 'spawned') this.editorMode = 'part';
        const visualLayerSelect = this.visualLayerSelect || this.droneEditModeSelect;
        const spawnedOption = visualLayerSelect?.querySelector?.('option[value="spawned"]');
        if (spawnedOption) spawnedOption.hidden = !isDrone;
        if (visualLayerSelect) visualLayerSelect.value = this.editorMode;
        if (isDrone && !this.droneVisual) {
            this.droneVisual = droneVisualFromBlueprint(this.importedStats?.droneType || 'striker');
            this.droneGridData = [...this.droneVisual.layers.base];
        }
        (this.visualLayerControls || this.droneVisualControls)?.style &&
            ((this.visualLayerControls || this.droneVisualControls).style.display = 'block');
        this.droneCanvasWrapper.style.display = isDrone && this.editorMode === 'spawned' ? 'block' : 'none';
        if (this.coreVisualControls) this.coreVisualControls.style.display = this.editorMode === 'core' ? 'flex' : 'none';
        if (this.coreCanvasWrapper) this.coreCanvasWrapper.style.display = this.editorMode === 'core' ? 'block' : 'none';
        this.droneBlueprintLabel.textContent = isDrone && this.editorMode === 'spawned' && this.droneVisual
            ? `blueprint: ${this.droneVisual.blueprintId}`
            : '';
        this.facingSelect.style.display = this.turretMode ? 'inline-block' : 'none';
        this.syncProjectileVisualControls();
        this.barrelModeCheckbox.disabled = !this.turretMode;
        if (!this.turretMode) {
            this.barrelMode = false;
            this.barrelModeCheckbox.checked = false;
        }
        this.resizeCanvases();
        this.reconcilePreviewAnimation();
    }

    getActiveProjectileType() {
        if (this.currentPartType === PartType.WEAPON && this.editorMode === 'part') return this.importedStats?.projectileType || null;
        if (this.currentPartType === PartType.DRONE && this.editorMode === 'spawned') {
            return resolveDroneBlueprint(this.droneVisual?.blueprintId || this.importedStats?.droneType).projectileType || null;
        }
        return null;
    }

    needsPreviewAnimation() {
        return Boolean(this.previewFire || this.coreEnabled || this.getActiveProjectileType());
    }

    reconcilePreviewAnimation() {
        if (!this.active || !this.needsPreviewAnimation()) {
            this.stopPreviewAnimation();
            return false;
        }
        this.startPreviewAnimation();
        return true;
    }

    captureProjectileSelectors() {
        const look = normalizeProjectileLook(this.projectileLookSelect.value);
        const trail = normalizeProjectileTrail(this.projectileTrailSelect.value);
        if (this.currentPartType === PartType.DRONE && this.editorMode === 'spawned') {
            this.droneProjectileLook = look;
            this.droneProjectileTrail = trail;
        } else {
            this.weaponProjectileLook = look;
            this.weaponProjectileTrail = trail;
        }
    }

    syncProjectileVisualControls() {
        if (!this.projectileLookSelect) return;
        const isWeapon = this.currentPartType === PartType.WEAPON && this.editorMode === 'part';
        const isSpawnedDrone = this.currentPartType === PartType.DRONE && this.editorMode === 'spawned';
        const projectileType = this.getActiveProjectileType();
        const visible = isWeapon || isSpawnedDrone;
        this.projectileVisualControls.style.display = visible ? 'flex' : 'none';
        const look = isSpawnedDrone ? (this.droneProjectileLook || DEFAULT_PROJECTILE_LOOK) : this.weaponProjectileLook;
        const trail = isSpawnedDrone ? (this.droneProjectileTrail || DEFAULT_PROJECTILE_TRAIL) : this.weaponProjectileTrail;
        this.projectileLookSelect.value = look || DEFAULT_PROJECTILE_LOOK;
        this.projectileTrailSelect.value = trail || DEFAULT_PROJECTILE_TRAIL;
        const available = Boolean(projectileType);
        const supported = available && supportsProjectileCosmetics(projectileType);
        this.projectileLookSelect.disabled = !supported;
        this.projectileTrailSelect.disabled = !supported;
        this.projectileAvailability.textContent = !available
            ? 'this drone has no projectile; cosmetics and fire test are unavailable.'
            : supported
                ? `live production preview: ${projectileType}`
                : `${projectileType} uses native rendering; cosmetic look/trail are unavailable.`;
        this.updatePreviewFireAnimation();
    }

    resizeGrid() {
        this.currentSize = this.sizeSelect.value.split('x').map(Number);
        const grid = gridDimensions(...this.currentSize);
        this.gridWidth = grid.width; this.gridHeight = grid.height;
        this.gridData = new Array(this.gridWidth * this.gridHeight).fill(0);
        this.turretGridData = new Array(this.gridWidth * this.gridHeight).fill(0);
        this.basePivot = null; this.turretPivot = null; this.barrelPos = null;
        this.rawAnchors = { base: null, turret: null };
        this.rawBarrel = null;
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
        this.droneCanvas.width = 8 * this.editorScale;
        this.droneCanvas.height = 8 * this.editorScale;
        this.droneCanvas.style.width = `${this.droneCanvas.width}px`;
        this.droneCanvas.style.height = `${this.droneCanvas.height}px`;
        this.coreCanvas.width = CORE_EFFECT_GRID.width * this.editorScale;
        this.coreCanvas.height = CORE_EFFECT_GRID.height * this.editorScale;
        this.coreCanvas.style.width = `${this.coreCanvas.width}px`;
        this.coreCanvas.style.height = `${this.coreCanvas.height}px`;
        this.drawGrid();
    }

    toDesignDocument() {
        const partType = this.typeSelect.value || this.currentPartType || PartType.HULL;
        const design = createBlankPartDesign({
            name: this.nameInput.value,
            type: DESIGN_DOCUMENT_TYPES.has(partType) ? partType : PartType.HULL,
            width: this.currentSize[0],
            height: this.currentSize[1]
        });
        design.partType = partType;
        if (this.currentPartId) design.partId = this.currentPartId;
        design.layers.base = [...this.gridData];
        design.layers.turret = this.turretMode ? [...this.turretGridData] : null;
        design.anchors.base = snapDesignPoint(this.basePivot, design.grid);
        design.anchors.turret = this.turretMode ? snapDesignPoint(this.turretPivot, design.grid) : null;
        design.barrel = this.turretMode ? snapDesignPoint(this.barrelPos, design.grid) : null;
        design.rawAnchors = {
            base: this.rawAnchors?.base ? { ...this.rawAnchors.base } : null,
            turret: this.turretMode && this.rawAnchors?.turret ? { ...this.rawAnchors.turret } : null
        };
        design.rawBarrel = this.turretMode && this.rawBarrel ? { ...this.rawBarrel } : null;
        design.rotationOffset = this.turretMode ? Number(this.facingSelect.value) : 0;
        design.projectileLook = this.turretMode
            ? normalizeProjectileLook(this.weaponProjectileLook)
            : DEFAULT_PROJECTILE_LOOK;
        design.projectileTrail = this.turretMode
            ? normalizeProjectileTrail(this.weaponProjectileTrail)
            : DEFAULT_PROJECTILE_TRAIL;
        design.coreEffect = this.coreEnabled
            ? {
                grid: { ...CORE_EFFECT_GRID },
                layers: { base: [...this.coreGridData] },
                color: normalizeCoreColor(this.coreColor)
            }
            : null;
        if (partType === PartType.DRONE) {
            const drone = this.droneVisual || droneVisualFromBlueprint(this.importedStats.droneType || 'striker');
            const hasProjectile = Boolean(resolveDroneBlueprint(drone.blueprintId).projectileType);
            design.drone = {
                blueprintId: drone.blueprintId,
                grid: { width: 8, height: 8 },
                layers: { base: [...this.droneGridData] },
                projectileLook: hasProjectile ? normalizeProjectileLook(this.droneProjectileLook || DEFAULT_PROJECTILE_LOOK) : DEFAULT_PROJECTILE_LOOK,
                projectileTrail: hasProjectile ? normalizeProjectileTrail(this.droneProjectileTrail || DEFAULT_PROJECTILE_TRAIL) : DEFAULT_PROJECTILE_TRAIL
            };
        }
        design.stats = { ...this.importedStats };
        design.notes = this.notesInput.value;
        return design;
    }

    loadDesign(design, fallbackDefinition = null) {
        this.currentPartId = design.partId || null;
        this.currentPartType = design.partType || design.type;
        this.nameInput.value = design.name;
        this.typeSelect.value = this.currentPartType;
        if (!this.typeSelect.value) {
            this.currentPartType = PartType.HULL;
            this.typeSelect.value = PartType.HULL;
        }
        this.sizeSelect.value = `${design.footprint.width}x${design.footprint.height}`;
        this.currentSize = [design.footprint.width, design.footprint.height];
        this.gridWidth = design.grid.width; this.gridHeight = design.grid.height;
        this.gridData = [...design.layers.base];
        this.turretGridData = design.layers.turret ? [...design.layers.turret] : new Array(this.gridWidth * this.gridHeight).fill(0);
        this.turretModeCheckbox.checked = Boolean(design.layers.turret);
        this.turretMode = Boolean(design.layers.turret);
        this.rawAnchors = {
            base: design.rawAnchors?.base ? { ...design.rawAnchors.base } : null,
            turret: design.rawAnchors?.turret ? { ...design.rawAnchors.turret } : null
        };
        this.rawBarrel = design.rawBarrel ? { ...design.rawBarrel } : null;
        this.basePivot = this.rawAnchors.base || (design.anchors.base ? { ...design.anchors.base } : null);
        this.turretPivot = this.rawAnchors.turret || (design.anchors.turret ? { ...design.anchors.turret } : null);
        this.barrelPos = this.rawBarrel || (design.barrel ? { ...design.barrel } : null);
        this.importedStats = { ...design.stats };
        this.droneVisual = design.drone
            ? {
                blueprintId: design.drone.blueprintId,
                grid: { width: 8, height: 8 },
                layers: { base: [...design.drone.layers.base] },
                projectileLook: design.drone.projectileLook,
                projectileTrail: design.drone.projectileTrail
            }
            : (this.currentPartType === PartType.DRONE ? droneVisualFromBlueprint(design.stats?.droneType || 'striker') : null);
        this.droneGridData = this.droneVisual ? [...this.droneVisual.layers.base] : new Array(64).fill(0);
        const coreEffect = Object.hasOwn(design, 'coreEffect')
            ? design.coreEffect
            : fallbackDefinition?.coreEffectSprite
                ? coreEffectFromSprite(fallbackDefinition.coreEffectSprite)
                : null;
        this.coreGridData = coreEffect?.layers?.base
            ? [...coreEffect.layers.base]
            : new Array(64).fill(0);
        this.coreColor = normalizeCoreColor(coreEffect?.color || DEFAULT_CORE_EFFECT_COLOR);
        this.coreEnabled = Boolean(coreEffect);
        if (this.coreEnabledCheckbox) this.coreEnabledCheckbox.checked = this.coreEnabled;
        if (this.coreColorInput) this.coreColorInput.value = this.coreColor;
        if (this.coreColorValue) this.coreColorValue.textContent = this.coreColor;
        this.editorMode = 'part';
        this.droneEditModeSelect.value = this.editorMode;
        this.weaponProjectileLook = design.projectileLook || DEFAULT_PROJECTILE_LOOK;
        this.weaponProjectileTrail = design.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
        this.droneProjectileLook = this.droneVisual?.projectileLook || DEFAULT_PROJECTILE_LOOK;
        this.droneProjectileTrail = this.droneVisual?.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
        this.notesInput.value = design.notes || '';
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

    getValidatedDesignDocument() {
        return validateStagedDesignDocument(this.toDesignDocument(), this.currentPartId);
    }

    /** Stage the current design for the part lab without mutating the library. */
    stageSave() {
        const design = this.getValidatedDesignDocument();
        if (this.stagedSaveCallback) this.stagedSaveCallback(design);
        return design;
    }

    notifyDraftChange() {
        if (!this.draftChangeCallback || !this.currentPartId) return;
        try {
            this.draftChangeCallback(this.getValidatedDesignDocument());
        } catch {
            // incomplete fields are normal while typing in the designer
        }
    }

    saveAndNext() {
        try {
            const design = this.getValidatedDesignDocument();
            if (this.stagedSaveCallback) this.stagedSaveCallback(design);
            if (this.nextPartCallback) this.nextPartCallback(design, design.partId || null);
            else this.setStatus('next part is not available', true);
            return design;
        } catch (error) {
            console.error(error);
            this.setStatus(error.message || 'could not stage design', true);
            return null;
        }
    }

    save() {
        try {
            if (this.stagedSaveCallback) {
                const design = this.stageSave();
                this.setStatus('changes staged');
                this.close();
                return design;
            }

            const design = this.getValidatedDesignDocument();
            const id = `custom_${Date.now()}`;
            const definition = this.createDefinition(id, design);
            if (definition.droneVisual) registerDroneVisualOverride(definition.droneVisual);
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
        if (design.barrel || design.rawBarrel) {
            const pivot = design.rawAnchors?.turret || design.anchors.turret || { x: design.grid.width / 2, y: design.grid.height / 2 };
            const barrel = design.rawBarrel || design.barrel;
            stats.barrelPosition = { x: (barrel.x - pivot.x) * 4, y: (barrel.y - pivot.y) * 4 };
        }
        const sprite = makeSprite(
            design.layers.turret || design.layers.base,
            design.rawAnchors?.turret || design.anchors.turret || design.rawAnchors?.base || design.anchors.base
        );
        const definition = new PartDef(
            id,
            design.name,
            design.partType || design.type,
            sprite,
            stats,
            design.footprint.width,
            design.footprint.height
        );
        if (design.layers.turret) {
            definition.baseSprite = makeSprite(
                design.layers.base,
                design.rawAnchors?.base || design.anchors.base
            );
            definition.drawTurretInInventory = true;
            definition.rotationOffset = design.rotationOffset;
            definition.turretDrawOffset = 0;
        }
        definition.projectileLook = design.projectileLook || DEFAULT_PROJECTILE_LOOK;
        definition.projectileTrail = design.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
        definition.coreEffectSprite = design.coreEffect
            ? createCoreEffectSprite(
                design.coreEffect.color,
                design.coreEffect.layers.base
            )
            : null;
        if (definition.type === PartType.DRONE && design.drone) {
            definition.droneVisual = {
                blueprintId: design.drone.blueprintId,
                layers: { base: [...design.drone.layers.base] },
                projectileLook: design.drone.projectileLook,
                projectileTrail: design.drone.projectileTrail
            };
        }
        return definition;
    }

    drawGrid() {
        this.drawEditorLayer(this.ctx, this.gridData, this.basePivot, null, '#4a9eff');
        if (this.turretMode) this.drawEditorLayer(this.turretCtx, this.turretGridData, this.turretPivot, this.barrelPos, '#ff9944');
        if (this.currentPartType === PartType.DRONE && this.editorMode === 'spawned') {
            this.drawEditorLayer(this.droneCtx, this.droneGridData, null, null, '#00ffff', 8, 8);
        }
        if (this.editorMode === 'core') this.drawCoreEffectLayer();
        this.drawPreview();
    }

    drawCoreEffectLayer() {
        const scale = this.editorScale;
        const ctx = this.coreCtx;
        ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for (let y = 0; y < CORE_EFFECT_GRID.height; y++) for (let x = 0; x < CORE_EFFECT_GRID.width; x++) {
            ctx.strokeStyle = '#303442'; ctx.lineWidth = 1;
            ctx.strokeRect(x * scale, y * scale, scale, scale);
            if (this.coreGridData[y * CORE_EFFECT_GRID.width + x]) {
                ctx.fillStyle = this.coreColor;
                ctx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2);
            }
        }
        if (!this.coreEnabled) {
            ctx.fillStyle = 'rgba(5, 7, 13, .62)';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#bda4d9'; ctx.font = `${Math.max(11, scale)}px monospace`;
            ctx.textAlign = 'center'; ctx.fillText('disabled', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
    }

    drawEditorLayer(ctx, data, pivot, barrel, accent, width = this.gridWidth, height = this.gridHeight) {
        const scale = this.editorScale;
        ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            ctx.strokeStyle = '#303442'; ctx.lineWidth = 1; ctx.strokeRect(x * scale, y * scale, scale, scale);
            const value = data[y * width + x];
            if (value) { ctx.fillStyle = COLORS[value] || accent; ctx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2); }
        }
        if (pivot) drawMarker(ctx, pivot, scale, '#ff55ff');
        if (barrel) drawMarker(ctx, barrel, scale, '#ffaa00');
        ctx.fillStyle = accent; ctx.font = `bold ${Math.max(11, scale)}px monospace`; ctx.textAlign = 'right';
        ctx.fillText(facingArrow(Number(this.facingSelect.value)), ctx.canvas.width - 4, Math.max(13, scale));
    }

    drawPreview() {
        const ctx = this.previewCtx;
        const now = nowMs();
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
        let definition = null;
        try {
            definition = this.createDefinition('preview', design);
            if (definition.baseSprite) definition.baseSprite.draw(ctx, partX, partY, 0, .5, .5);
            const followsAim = (definition.type === PartType.WEAPON && this.editorMode === 'part') ||
                (definition.type === PartType.DRONE && this.editorMode === 'spawned');
            const isSpawnedDrone = definition.type === PartType.DRONE && this.editorMode === 'spawned';
            const mountAim = this.previewAim || { x: partX + TILE_SIZE * 2, y: partY };
            const mount = getDesignerPreviewMount(definition, partX, partY, mountAim);
            const fireOrigin = isSpawnedDrone
                ? getDesignerPreviewDronePosition(partX, partY)
                : mount;
            const aim = this.previewAim || {
                x: fireOrigin.x + TILE_SIZE * 2,
                y: fireOrigin.y
            };
            const aimAngle = Math.atan2(aim.y - fireOrigin.y, aim.x - fireOrigin.x);
            definition.sprite.draw(
                ctx,
                mount.x,
                mount.y,
                definition.type === PartType.WEAPON && followsAim
                    ? aimAngle + (definition.rotationOffset || 0)
                    : 0,
                null,
                null
            );
            if (definition.coreEffectSprite) {
                definition.coreEffectSprite.draw(ctx, partX, partY, coreEffectRotation());
            }
            if (definition.type === PartType.DRONE) {
                const drone = design.drone;
                const droneSprite = new Sprite(
                    [...(drone?.layers?.base || new Array(64).fill(0))],
                    8,
                    8,
                    3,
                    { 1: '#00ffff', 2: '#177777' }
                );
                const dronePosition = getDesignerPreviewDronePosition(partX, partY);
                droneSprite.draw(ctx, dronePosition.x, dronePosition.y, 0, .5, .5);
                ctx.fillStyle = '#00ffff'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
                ctx.fillText('deployed', dronePosition.x, partY + 28);
            }
            if (followsAim) {
                drawAimGuide(ctx, fireOrigin.x, fireOrigin.y, aim, aimAngle);
                this.drawPreviewFire(ctx, definition, fireOrigin.x, fireOrigin.y, aimAngle, now, isSpawnedDrone);
            }
        } catch { /* incomplete text fields are allowed while typing */ }
        ctx.strokeStyle = '#44ff88'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(coreX + TILE_SIZE / 2, coreY); ctx.lineTo(coreX + TILE_SIZE / 2 + 8, coreY); ctx.stroke();
        ctx.fillStyle = '#8899bb'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        ctx.fillText('core', coreX, coreY + 28); ctx.fillText(`${width}x${height} mount`, partX, ctx.canvas.height - 9);
        this.updateFireTestControl(definition);
    }

    updatePreviewAim(event) {
        const rect = this.previewCanvas.getBoundingClientRect();
        const scaleX = this.previewCanvas.width / Math.max(1, rect.width);
        const scaleY = this.previewCanvas.height / Math.max(1, rect.height);
        this.previewAim = {
            x: clamp((event.clientX - rect.left) * scaleX, 0, this.previewCanvas.width),
            y: clamp((event.clientY - rect.top) * scaleY, 0, this.previewCanvas.height)
        };
        this.drawPreview();
    }

    updateFireTestControl(definition = null) {
        if (!this.fireTestButton) return;
        const type = definition?.type || this.currentPartType;
        const isWeapon = type === PartType.WEAPON && this.editorMode === 'part';
        const isDrone = type === PartType.DRONE && this.editorMode === 'spawned';
        const projectileType = definition?.stats?.projectileType || this.getActiveProjectileType();
        const available = (isWeapon || isDrone) && Boolean(projectileType);
        this.fireTestButton.disabled = !available;
        this.fireTestButton.textContent = available ? 'fire test' : 'fire test (n/a)';
        this.fireTestButton.style.opacity = available ? '1' : '.55';
        this.fireTestButton.style.cursor = available ? 'pointer' : 'not-allowed';
    }

    fireTest() {
        const projectileType = this.getActiveProjectileType();
        const isWeapon = this.currentPartType === PartType.WEAPON && this.editorMode === 'part';
        const isDrone = this.currentPartType === PartType.DRONE && this.editorMode === 'spawned';
        if ((!isWeapon && !isDrone) || !projectileType) {
            this.setStatus('fire test is not applicable to this part');
            return false;
        }
        const width = this.currentSize[0];
        const height = this.currentSize[1];
        const partX = 54 + (1 + (width - 1) / 2) * TILE_SIZE;
        const partY = this.previewCanvas.height / 2 + (-Math.floor((height - 1) / 2) + (height - 1) / 2) * TILE_SIZE;
        const definition = this.createDefinition('preview', this.toDesignDocument());
        const mountAim = this.previewAim || { x: partX + TILE_SIZE * 2, y: partY };
        const mount = getDesignerPreviewMount(definition, partX, partY, mountAim);
        const origin = isDrone ? getDesignerPreviewDronePosition(partX, partY) : mount;
        const aim = this.previewAim || { x: origin.x + TILE_SIZE * 2, y: origin.y };
        const aimAngle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
        const blueprint = isDrone ? resolveDroneBlueprint(this.droneVisual?.blueprintId) : null;
        this.previewFire = {
            startedAt: nowMs(),
            partX: origin.x,
            partY: origin.y,
            aimAngle,
            spawnedDrone: isDrone,
            projectileType,
            projectileSpeed: blueprint?.projectileSpeed ?? definition.stats.projectileSpeed,
            projectileLifetime: blueprint?.projectileLifetime ?? definition.stats.lifetime,
            projectileLook: isDrone ? this.droneProjectileLook : this.weaponProjectileLook,
            projectileTrail: isDrone ? this.droneProjectileTrail : this.weaponProjectileTrail
        };
        this.setStatus('preview fire test — game state untouched');
        this.startPreviewAnimation();
        this.drawPreview();
        return true;
    }

    drawPreviewFire(ctx, definition, partX, partY, aimAngle, now, spawnedDrone = false) {
        if (!this.previewFire) return;
        const elapsed = now - this.previewFire.startedAt;
        if (elapsed > 900) {
            this.previewFire = null;
            return;
        }
        const barrel = this.previewFire.spawnedDrone || spawnedDrone
            ? getDesignerPreviewDroneMuzzle(partX, partY, aimAngle)
            : getDesignerPreviewMuzzle(definition, partX, partY, aimAngle);
        const elapsedSeconds = elapsed / 1000;
        const projectile = new Projectile(
            barrel.x,
            barrel.y,
            aimAngle,
            this.previewFire.projectileType,
            this.previewFire.projectileSpeed || 600,
            'player',
            definition.stats.damage || 1,
            this.previewFire.projectileLifetime ?? null
        );
        projectile.projectileLook = this.previewFire.projectileLook || DEFAULT_PROJECTILE_LOOK;
        projectile.projectileTrail = this.previewFire.projectileTrail || DEFAULT_PROJECTILE_TRAIL;
        if (definition.stats.range) projectile.beamLength = definition.stats.range;
        if (!projectile.isBeam) {
            const travel = Math.min(300, Math.max(0, elapsedSeconds * (projectile.speed || 600)));
            projectile.x = barrel.x + Math.cos(aimAngle) * travel;
            projectile.y = barrel.y + Math.sin(aimAngle) * travel;
        } else if (projectile.type === 'beam_sword') {
            projectile.update(elapsedSeconds, null);
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 900);
        drawProjectileOnContext(ctx, projectile);
        if (elapsed < 180) {
            ctx.fillStyle = '#fff5b0';
            ctx.beginPath(); ctx.arc(barrel.x, barrel.y, 7 + (180 - elapsed) / 12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    startPreviewAnimation() {
        if (!this.active || !this.needsPreviewAnimation() || this.previewAnimationFrame !== null) return;
        const tick = () => {
            this.previewAnimationFrame = null;
            if (!this.active || !this.needsPreviewAnimation()) {
                this.stopPreviewAnimation();
                return;
            }
            this.drawProjectileSelectorPreview();
            if (this.previewFire || this.coreEnabled) this.drawPreview();
            if (this.needsPreviewAnimation()) {
                this.previewAnimationFrame = requestPreviewFrame(tick);
            }
        };
        this.previewAnimationFrame = requestPreviewFrame(tick);
    }

    updatePreviewFireAnimation() {
        if (!this.active) return;
        this.drawProjectileSelectorPreview();
        this.reconcilePreviewAnimation();
    }

    drawProjectileSelectorPreview() {
        if (!this.projectilePreviewCtx) return;
        const ctx = this.projectilePreviewCtx;
        ctx.fillStyle = '#080b14';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const type = this.getActiveProjectileType();
        if (!type) {
            ctx.fillStyle = '#7788aa';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('no projectile', ctx.canvas.width / 2, 25);
            return;
        }
        const blueprint = this.currentPartType === PartType.DRONE
            ? resolveDroneBlueprint(this.droneVisual?.blueprintId)
            : null;
        const projectile = new Projectile(
            74,
            ctx.canvas.height / 2,
            0,
            type,
            blueprint?.projectileSpeed ?? this.importedStats?.projectileSpeed ?? 600,
            'player',
            1,
            blueprint?.projectileLifetime ?? this.importedStats?.lifetime ?? null
        );
        projectile.projectileLook = this.currentPartType === PartType.DRONE
            ? this.droneProjectileLook
            : this.weaponProjectileLook;
        projectile.projectileTrail = this.currentPartType === PartType.DRONE
            ? this.droneProjectileTrail
            : this.weaponProjectileTrail;
        if (this.importedStats?.range) projectile.beamLength = this.importedStats.range;
        if (type === 'beam_sword') {
            const elapsed = (nowMs() % 700) / 1000;
            projectile.update(Math.min(elapsed, projectile.maxLife), null);
        }
        ctx.save();
        drawProjectileOnContext(ctx, projectile);
        ctx.restore();
    }

    stopPreviewAnimation() {
        if (this.previewAnimationFrame === null || this.previewAnimationFrame === undefined) {
            this.previewAnimationFrame = null;
            return;
        }
        cancelPreviewFrame(this.previewAnimationFrame);
        this.previewAnimationFrame = null;
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
function normalizeEditorMode(value) { return value === 'carrier' ? 'part' : ['part', 'core', 'spawned'].includes(value) ? value : 'part'; }
function normalizeCoreColor(value) { return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : DEFAULT_CORE_EFFECT_COLOR; }
function snapPoint(x, y, maxX, maxY) { return { x: Math.max(0, Math.min(maxX, Math.round(x * 2) / 2)), y: Math.max(0, Math.min(maxY, Math.round(y * 2) / 2)) }; }
function nowMs() { return globalThis.performance?.now?.() ?? Date.now(); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function requestPreviewFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === 'function') return globalThis.requestAnimationFrame(callback);
    return globalThis.setTimeout(callback, 16);
}
function cancelPreviewFrame(handle) {
    if (typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(handle);
    else globalThis.clearTimeout(handle);
}
function drawAimGuide(ctx, partX, partY, aim, angle) {
    ctx.save();
    ctx.strokeStyle = 'rgba(170, 204, 255, .45)';
    ctx.setLineDash?.([4, 4]);
    ctx.beginPath(); ctx.moveTo(partX, partY); ctx.lineTo(aim.x, aim.y); ctx.stroke();
    ctx.setLineDash?.([]);
    ctx.strokeStyle = '#d9e5ff'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(aim.x - 6, aim.y); ctx.lineTo(aim.x + 6, aim.y);
    ctx.moveTo(aim.x, aim.y - 6); ctx.lineTo(aim.x, aim.y + 6);
    ctx.stroke();
    ctx.fillStyle = '#d9e5ff'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(facingArrow((angle + Math.PI * 2) % (Math.PI * 2)), aim.x + 8, aim.y - 7);
    ctx.restore();
}
export function getDesignerPreviewMuzzle(definition, partX, partY, angle) {
    const height = definition.height || 1;
    const barrel = definition.stats?.barrelPosition;
    if (barrel) {
        return {
            x: partX + Math.cos(angle) * (barrel.x || 0) - Math.sin(angle) * (barrel.y || 0),
            y: partY + Math.sin(angle) * (barrel.x || 0) + Math.cos(angle) * (barrel.y || 0)
        };
    }
    const length = height > 1.5 ? TILE_SIZE * 1.3 : TILE_SIZE * .6;
    return { x: partX + Math.cos(angle) * length, y: partY + Math.sin(angle) * length };
}

export function getDesignerPreviewMount(definition, partX, partY, aim = { x: partX + 1, y: partY }) {
    const baseAngle = 0;
    const part = {
        def: definition,
        width: definition.width,
        height: definition.height,
        partRef: { recoil: 0 }
    };
    const first = getMountedTurretPosition(
        part,
        baseAngle,
        Math.atan2(aim.y - partY, aim.x - partX),
        0
    );
    const firstX = partX + first.offsetX;
    const firstY = partY + first.offsetY;
    const aimAngle = Math.atan2(aim.y - firstY, aim.x - firstX);
    const shifted = getMountedTurretPosition(part, baseAngle, aimAngle, 0);
    return { x: partX + shifted.offsetX, y: partY + shifted.offsetY };
}

function drawMarker(ctx, point, scale, color) {
    const x = point.x * scale; const y = point.y * scale;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, Math.max(3, scale / 6), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
}
