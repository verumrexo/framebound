import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBlankPartDesign,
    serializePartDesign
} from '../dev/PartDesignDocument.js';
import { TILE_SIZE } from '../../shared/parts/Part.js';
import { createCoreEffectSprite } from '../../shared/parts/CoreEffect.js';

const {
    Designer,
    getDesignerPreviewDronePosition,
    getDesignerPreviewMount,
    getDesignerPreviewMuzzle,
    partDefinitionToDesign,
    validateStagedDesignDocument
} = await import('./Designer.js');
const {
    clearDroneVisualOverrides,
    getDroneBlueprintVisual,
    registerDroneVisualOverride,
    resolveDroneBlueprint
} = await import('../../shared/combat/DroneBlueprints.js');

test('designer preview applies the base sprite anchor to the turret mount and muzzle', () => {
    const definition = {
        type: 'weapon',
        width: 1,
        height: 1,
        turretDrawOffset: 0,
        baseSprite: {
            width: 8,
            height: 8,
            scale: 4,
            anchorX: .25,
            anchorY: .5
        },
        stats: { barrelPosition: { x: 12, y: 0 } }
    };
    const centered = getDesignerPreviewMount(
        { ...definition, baseSprite: { ...definition.baseSprite, anchorX: .5 } },
        100,
        100,
        { x: 200, y: 100 }
    );
    const shifted = getDesignerPreviewMount(definition, 100, 100, { x: 200, y: 100 });
    assert.deepEqual(centered, { x: 100, y: 100 });
    assert.deepEqual(shifted, { x: 92, y: 100 });
    assert.deepEqual(
        getDesignerPreviewMuzzle(definition, shifted.x, shifted.y, 0),
        { x: 104, y: 100 }
    );
});

test('part definition conversion preserves art, anchors, barrel, rotation, and stats', () => {
    const base = new Array(8 * 15).fill(0);
    const turret = new Array(8 * 15).fill(0);
    base[3] = 1;
    turret[7] = 2;
    const stats = {
        hp: 40,
        mass: 4,
        damage: 7,
        cooldown: 1.5,
        weaponGroup: 'velocity',
        barrelPosition: { x: 12, y: -2 }
    };
    const definition = {
        id: 'needle_rack',
        name: 'needle rack',
        type: 'weapon',
        width: 1,
        height: 2,
        rotationOffset: Math.PI / 2,
        stats,
        sprite: { data: turret, width: 8, height: 15, scale: 4, anchorX: .5, anchorY: .8 },
        baseSprite: { data: base, width: 8, height: 15, scale: 4, anchorX: .5, anchorY: .2 }
    };

    const design = partDefinitionToDesign('needle_rack', definition);

    assert.equal(design.partId, 'needle_rack');
    assert.equal(design.partType, 'weapon');
    assert.deepEqual(design.layers.base, base);
    assert.deepEqual(design.layers.turret, turret);
    assert.deepEqual(design.anchors.base, { x: 4, y: 3 });
    assert.deepEqual(design.anchors.turret, { x: 4, y: 12 });
    assert.deepEqual(design.barrel, { x: 7, y: 11.5 });
    assert.equal(design.rotationOffset, Math.PI / 2);
    assert.deepEqual(design.stats, stats);
    assert.notEqual(design.stats, stats);
    assert.deepEqual(definition.stats, stats);
});

test('designer conversion extracts exact custom core pixels and color', () => {
    const corePixels = new Array(64).fill(0);
    corePixels[9] = 1;
    const design = partDefinitionToDesign('violet_hull', {
        id: 'violet_hull', name: 'violet hull', type: 'hull', width: 1, height: 1,
        stats: { hp: 20, mass: 2 },
        sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 },
        coreEffectSprite: createCoreEffectSprite('#b56cff', corePixels)
    });
    assert.deepEqual(design.coreEffect.layers.base, corePixels);
    assert.equal(design.coreEffect.color, '#b56cff');
});

test('conversion keeps library types that the shared document schema does not edit directly', () => {
    const pixels = new Array(64).fill(1);
    const design = partDefinitionToDesign('captain_seat', {
        name: 'captain seat',
        type: 'utility',
        width: 1,
        height: 1,
        stats: { hp: 20, mass: 2, cameraZoom: 1.2 },
        sprite: { data: pixels, width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 }
    });

    assert.equal(design.type, 'hull');
    assert.equal(design.partType, 'utility');
    assert.doesNotThrow(() => serializePartDesign(design));
});

test('loadPart preloads by stable id and rejects missing parts', () => {
    const worker = Object.create(Designer.prototype);
    let loaded = null;
    worker.loadDesign = design => { loaded = design; };
    const library = {
        stable_part: {
            name: 'stable part',
            type: 'hull',
            width: 1,
            height: 1,
            stats: { hp: 33, mass: 3 },
            sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 }
        }
    };

    assert.equal(worker.loadPart('stable_part', library), worker);
    assert.equal(loaded.partId, 'stable_part');
    assert.deepEqual(loaded.stats, library.stable_part.stats);
    assert.throws(() => worker.loadPart('missing_part', library), /unknown part id/);
});

test('staged validation returns a serializable document for the same stable id', () => {
    const design = createBlankPartDesign({ name: 'dart', type: 'weapon', width: 1, height: 1 });
    design.partId = 'gun_basic';
    design.partType = 'weapon';
    design.stats = { hp: 10, mass: 2, damage: 5 };
    const staged = validateStagedDesignDocument(design, 'gun_basic');

    assert.equal(staged.partId, 'gun_basic');
    assert.equal(staged.partType, 'weapon');
    assert.deepEqual(staged.stats, design.stats);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(staged)));
    assert.throws(
        () => validateStagedDesignDocument(design, 'different_part'),
        /does not match/
    );
});

test('designer stage and save-next callbacks receive validated documents without library mutation', () => {
    const design = createBlankPartDesign({ name: 'test part', type: 'hull', width: 1, height: 1 });
    design.partId = 'hull';
    design.partType = 'hull';
    design.stats = { hp: 20, mass: 2 };
    const worker = Object.create(Designer.prototype);
    worker.currentPartId = 'hull';
    worker.toDesignDocument = () => design;
    worker.stagedSaveCallback = null;
    worker.nextPartCallback = null;

    let saved = null;
    let next = null;
    worker.stagedSaveCallback = value => { saved = value; };
    worker.nextPartCallback = value => { next = value; };
    worker.setStatus = () => {};

    const staged = worker.stageSave();
    const advanced = worker.saveAndNext();

    assert.equal(saved.partId, 'hull');
    assert.equal(next.partId, 'hull');
    assert.deepEqual(staged.stats, design.stats);
    assert.deepEqual(advanced.stats, design.stats);
    assert.notEqual(saved, design);
});

test('designer conversion loads the exact deployed blueprint silhouette for a drone part', () => {
    const blueprint = resolveDroneBlueprint('striker');
    const definition = {
        id: 'drone_hive',
        name: 'drone hive',
        type: 'drone',
        width: 1,
        height: 1,
        stats: { hp: 20, mass: 2, droneType: 'striker' },
        sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 }
    };

    const design = partDefinitionToDesign('drone_hive', definition);

    assert.equal(design.drone.blueprintId, 'striker');
    assert.deepEqual(
        design.drone.layers.base,
        blueprint.spriteRows.flatMap(row => [...row].map(Number))
    );
});

test('designer load restores nested drone art and projectile cosmetics', () => {
    const design = partDefinitionToDesign('drone_hive', {
        id: 'drone_hive',
        name: 'drone hive',
        type: 'drone',
        width: 1,
        height: 1,
        stats: { hp: 20, mass: 2, droneType: 'striker' },
        sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 }
    });
    design.drone.layers.base[7] = 2;
    design.drone.projectileLook = 'needle';
    design.drone.projectileTrail = 'ion';

    const worker = Object.create(Designer.prototype);
    worker.nameInput = { value: '' };
    worker.typeSelect = { value: '' };
    worker.sizeSelect = { value: '' };
    worker.turretModeCheckbox = { checked: false };
    worker.droneEditModeSelect = { value: '' };
    worker.facingSelect = { value: '' };
    worker.notesInput = { value: '' };
    worker.syncTypeAndTurret = () => {};

    worker.loadDesign(design);

    assert.deepEqual(worker.droneGridData, design.drone.layers.base);
    assert.equal(worker.droneProjectileLook, 'needle');
    assert.equal(worker.droneProjectileTrail, 'ion');
});

test('designer keeps the workspace visible while switching carrier and spawned drone modes', () => {
    const workspace = { style: { display: 'flex' } };
    const droneWrapper = { style: { display: 'none' } };
    const turretWrapper = { style: { display: 'none' } };
    const worker = Object.create(Designer.prototype);
    worker.ui = {
        querySelector(selector) {
            if (selector === '#turret-canvas-wrapper') return turretWrapper;
            return { style: {} };
        }
    };
    worker.typeSelect = { value: 'hull' };
    worker.turretModeCheckbox = { checked: false };
    worker.droneVisualControls = { style: {} };
    worker.droneCanvasWrapper = droneWrapper;
    worker.coreVisualControls = { style: {} };
    worker.coreCanvasWrapper = { style: { display: 'none' } };
    worker.droneCanvas = { parentElement: { parentElement: workspace } };
    worker.droneBlueprintLabel = { textContent: '' };
    worker.facingSelect = { style: {} };
    worker.barrelModeCheckbox = { disabled: false, checked: false };
    worker.importedStats = {};
    worker.droneVisual = { blueprintId: 'striker', layers: { base: new Array(64).fill(0) } };
    worker.syncProjectileVisualControls = () => {};
    worker.resizeCanvases = () => {};

    worker.syncTypeAndTurret('type');
    assert.equal(workspace.style.display, 'flex');
    assert.equal(droneWrapper.style.display, 'none');

    worker.typeSelect.value = 'drone';
    worker.editorMode = 'spawned';
    worker.syncTypeAndTurret('type');
    assert.equal(workspace.style.display, 'flex');
    assert.equal(droneWrapper.style.display, 'block');
    assert.equal(worker.droneVisualControls.style.display, 'block');
    assert.equal(worker.droneBlueprintLabel.textContent, 'blueprint: striker');

    worker.editorMode = 'carrier';
    worker.syncTypeAndTurret('mode');
    assert.equal(workspace.style.display, 'flex');
    assert.equal(droneWrapper.style.display, 'none');
    assert.equal(worker.droneBlueprintLabel.textContent, '');

    worker.editorMode = 'core';
    worker.syncTypeAndTurret('mode');
    assert.equal(worker.droneBlueprintLabel.textContent, '');
});

test('enabled core continuously animates the mounted preview and stops when disabled', () => {
    const worker = Object.create(Designer.prototype);
    const frames = new Map();
    const cancelled = [];
    let nextFrameId = 0;
    let mountedPreviewDraws = 0;
    let projectilePreviewDraws = 0;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = callback => {
        const id = ++nextFrameId;
        frames.set(id, callback);
        return id;
    };
    globalThis.cancelAnimationFrame = id => {
        cancelled.push(id);
        frames.delete(id);
    };
    worker.active = true;
    worker.previewFire = null;
    worker.previewAnimationFrame = null;
    worker.coreEnabled = true;
    worker.getActiveProjectileType = () => null;
    worker.drawPreview = () => { mountedPreviewDraws += 1; };
    worker.drawProjectileSelectorPreview = () => { projectilePreviewDraws += 1; };

    try {
        assert.equal(worker.reconcilePreviewAnimation(), true);
        assert.equal(frames.size, 1);
        const firstFrame = frames.get(1);
        frames.delete(1);
        firstFrame();
        assert.equal(projectilePreviewDraws, 1);
        assert.equal(mountedPreviewDraws, 1);
        assert.equal(frames.size, 1);

        worker.coreEnabled = false;
        assert.equal(worker.reconcilePreviewAnimation(), false);
        assert.deepEqual(cancelled, [2]);
        assert.equal(worker.previewAnimationFrame, null);
        assert.equal(frames.size, 0);
    } finally {
        if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        else delete globalThis.requestAnimationFrame;
        if (originalCancelAnimationFrame) globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        else delete globalThis.cancelAnimationFrame;
    }
});

test('designer shows the core layer without drone or projectile controls', () => {
    const worker = Object.create(Designer.prototype);
    worker.ui = { querySelector: () => ({ style: {} }) };
    worker.typeSelect = { value: 'weapon' };
    worker.turretModeCheckbox = { checked: true };
    worker.droneVisualControls = { style: {} };
    worker.droneCanvasWrapper = { style: {} };
    worker.coreVisualControls = { style: {} };
    worker.coreCanvasWrapper = { style: {} };
    worker.droneBlueprintLabel = { textContent: '' };
    worker.facingSelect = { style: {} };
    worker.barrelModeCheckbox = { disabled: false, checked: false };
    worker.importedStats = { projectileType: 'laser' };
    worker.droneVisual = null;
    worker.editorMode = 'core';
    worker.syncProjectileVisualControls = () => {};
    worker.resizeCanvases = () => {};
    worker.syncTypeAndTurret('type');
    assert.equal(worker.coreVisualControls.style.display, 'flex');
    assert.equal(worker.coreCanvasWrapper.style.display, 'block');
    assert.equal(worker.droneCanvasWrapper.style.display, 'none');
});

test('designer documents keep core color and binary pixels without touching a definition during preview construction', () => {
    const worker = Object.create(Designer.prototype);
    worker.currentPartType = 'hull';
    worker.currentPartId = 'hull';
    worker.currentSize = [1, 1];
    worker.nameInput = { value: 'violet hull' };
    worker.typeSelect = { value: 'hull' };
    worker.gridData = new Array(64).fill(0);
    worker.turretGridData = new Array(64).fill(0);
    worker.turretMode = false;
    worker.basePivot = null;
    worker.turretPivot = null;
    worker.barrelPos = null;
    worker.rawAnchors = { base: null, turret: null };
    worker.rawBarrel = null;
    worker.facingSelect = { value: '0' };
    worker.weaponProjectileLook = 'default';
    worker.weaponProjectileTrail = 'default';
    worker.coreEnabled = true;
    worker.coreGridData = new Array(64).fill(0);
    worker.coreGridData[10] = 1;
    worker.coreColor = '#b56cff';
    worker.importedStats = { hp: 20, mass: 2 };
    worker.notesInput = { value: '' };
    const design = worker.toDesignDocument();
    const definition = worker.createDefinition('preview', design);
    assert.equal(design.coreEffect.color, '#b56cff');
    assert.equal(design.coreEffect.layers.base[10], 1);
    assert.equal(definition.coreEffectSprite.colorMap[1], '#b56cff');
    assert.equal(definition.coreEffectSprite.data[10], 1);
});

test('old drafts without core effect inherit the current definition effect on load', () => {
    const design = createBlankPartDesign({ name: 'core carrier', type: 'hull' });
    delete design.coreEffect;
    const worker = Object.create(Designer.prototype);
    worker.nameInput = { value: '' };
    worker.typeSelect = { value: '' };
    worker.sizeSelect = { value: '' };
    worker.turretModeCheckbox = { checked: false };
    worker.droneEditModeSelect = { value: '' };
    worker.facingSelect = { value: '' };
    worker.notesInput = { value: '' };
    worker.syncTypeAndTurret = () => {};
    worker.loadDesign(design, {
        coreEffectSprite: createCoreEffectSprite('#55ccff', new Array(64).fill(0).map((_, index) => index === 18 ? 1 : 0))
    });
    assert.equal(worker.coreEnabled, true);
    assert.equal(worker.coreColor, '#55ccff');
    assert.equal(worker.coreGridData[18], 1);
});

test('designer preview construction does not register staged drone visuals', () => {
    clearDroneVisualOverrides();
    const design = partDefinitionToDesign('drone_hive', {
        id: 'drone_hive',
        name: 'drone hive',
        type: 'drone',
        width: 1,
        height: 1,
        stats: { hp: 20, mass: 2, droneType: 'striker' },
        sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 }
    });
    design.drone.layers.base[0] = 2;
    design.drone.projectileLook = 'needle';
    design.drone.projectileTrail = 'ion';
    const worker = Object.create(Designer.prototype);
    const definition = worker.createDefinition('preview', design);
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 280;
    previewCanvas.height = 210;
    worker.previewCtx = previewCanvas.getContext('2d');
    worker.currentSize = [1, 1];
    worker.editorMode = 'carrier';
    worker.previewAim = null;
    worker.previewFire = null;
    worker.fireTestButton = null;
    worker.toDesignDocument = () => design;
    worker.drawPreview();

    const beforeApply = getDroneBlueprintVisual('striker');
    assert.notEqual(definition.droneVisual, undefined);
    assert.notEqual(beforeApply.spriteRows[0], '20000000');
    assert.equal(beforeApply.projectileLook, undefined);
    assert.equal(beforeApply.projectileTrail, undefined);

    registerDroneVisualOverride(definition.droneVisual);
    const afterApply = getDroneBlueprintVisual('striker');
    assert.equal(afterApply.spriteRows[0], '20000000');
    assert.equal(afterApply.projectileLook, 'needle');
    assert.equal(afterApply.projectileTrail, 'ion');
    clearDroneVisualOverrides();
});

test('spawned drone preview uses the deployed position while keeping the carrier static', () => {
    const design = partDefinitionToDesign('drone_hive', {
        id: 'drone_hive',
        name: 'drone hive',
        type: 'drone',
        width: 1,
        height: 1,
        stats: { hp: 20, mass: 2, droneType: 'striker' },
        sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 }
    });
    const carrierDraws = [];
    let fireArgs = null;
    const worker = Object.create(Designer.prototype);
    worker.previewCtx = document.createElement('canvas').getContext('2d');
    worker.previewCtx.canvas.width = 280;
    worker.previewCtx.canvas.height = 210;
    worker.currentSize = [1, 1];
    worker.editorMode = 'spawned';
    worker.previewAim = { x: 250, y: 90 };
    worker.previewFire = {};
    worker.fireTestButton = null;
    worker.toDesignDocument = () => design;
    worker.createDefinition = () => ({
        type: 'drone',
        width: 1,
        height: 1,
        stats: {},
        rotationOffset: 0,
        sprite: { draw: (...args) => carrierDraws.push(args) }
    });
    worker.drawPreviewFire = (...args) => {
        fireArgs = {
            x: args[2],
            y: args[3],
            spawnedDrone: args[6]
        };
    };

    const previewHeight = worker.previewCtx.canvas.height;
    worker.drawPreview();

    const partX = 54 + TILE_SIZE;
    const partY = previewHeight / 2;
    assert.deepEqual(
        { x: fireArgs.x, y: fireArgs.y },
        getDesignerPreviewDronePosition(partX, partY)
    );
    assert.equal(fireArgs.spawnedDrone, true);
    assert.equal(carrierDraws[0][3], 0);
});
