import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PartsLibrary } from '../../shared/parts/Part.js';
import { createBlankPartDesign } from '../dev/PartDesignDocument.js';
import {
    Designer,
    createBlankDesignForPart,
    getDesignerPreviewMount,
    getDesignerPreviewMuzzle,
    partDefinitionToDesign,
    validateStagedDesignDocument
} from './Designer.js';
import { applyVisualDesignOverride } from '../dev/PartLabManifest.js';
import { LayerHistory } from '../dev/PartRasterTools.js';

test('every catalog part starts blank except gun_basic calibration art', () => {
    const blank = createBlankDesignForPart('scattr', PartsLibrary.scattr);
    assert.equal(blank.layers.base.every(pixel => pixel === 0), true);
    assert.equal(blank.layers.turret.every(pixel => pixel === 0), true);
    const calibration = createBlankDesignForPart('gun_basic', PartsLibrary.gun_basic);
    assert.equal(calibration.layers.base.some(Boolean) || calibration.layers.turret.some(Boolean), true);
});

test('legacy definitions convert to v2 without mutating stats or world scale', () => {
    const definition = PartsLibrary.gun_basic;
    const stats = JSON.stringify(definition.stats);
    const design = partDefinitionToDesign('gun_basic', definition);
    assert.equal(design.version, 2);
    assert.deepEqual(design.grid, { width: 16, height: 16 });
    assert.equal(design.layers.base.length, 256);
    assert.equal(JSON.stringify(definition.stats), stats);
});

test('authored v2 parts import legacy 8x8 cores as valid 16x16 designs', () => {
    const corePixels = new Array(64).fill(0);
    corePixels[1] = 1;
    corePixels[63] = 1;
    const definition = {
        id: 'legacy-core',
        name: 'legacy core',
        type: 'weapon',
        width: 1,
        height: 1,
        stats: { hp: 20, mass: 2 },
        sprite: { data: new Array(256).fill(1), width: 16, height: 16, scale: 2, colorMap: { 1: '#26d426' } },
        coreEffectSprite: { data: corePixels, width: 8, height: 8, scale: 4, colorMap: { 1: '#55ccff' } },
        coreEffectSpinPivot: { x: 2.5, y: 5.5 },
        visualGeometry: {
            version: 2,
            scale: 2,
            baseGrid: { width: 16, height: 16 },
            turretGrid: { width: 16, height: 16 },
            baseMount: { x: 8, y: 8 },
            turretPivot: { x: 8, y: 8 },
            muzzles: []
        }
    };

    const design = partDefinitionToDesign('legacy-core', definition);
    const reopened = validateStagedDesignDocument(design, 'legacy-core');

    assert.deepEqual(reopened.coreEffect.grid, { width: 16, height: 16 });
    assert.equal(reopened.coreEffect.layers.base.length, 256);
    assert.deepEqual(reopened.coreEffect.spinPivot, { x: 5, y: 11 });
    assert.deepEqual(reopened.coreEffect.layers.base.slice(0, 4), [0, 0, 1, 1]);
    assert.deepEqual(reopened.coreEffect.layers.base.slice(240 + 14, 240 + 16), [1, 1]);
    assert.equal(definition.coreEffectSprite.width, 8);
    assert.equal(definition.coreEffectSprite.height, 8);
});

test('opening a saved v1 draft upgrades it instead of stranding the standalone lab', () => {
    const legacy = {
        format: 'framebound-part-design',
        version: 1,
        name: 'old scattr',
        type: 'weapon',
        footprint: { width: 1, height: 2 },
        grid: { width: 8, height: 15 },
        layers: {
            base: new Array(120).fill(0),
            turret: new Array(120).fill(0)
        },
        anchors: {
            base: { x: 4, y: 7.5 },
            turret: { x: 4, y: 7.5 }
        },
        barrel: { x: 7.5, y: 7.5 },
        rotationOffset: 0,
        stats: { ...PartsLibrary.scattr.stats },
        notes: '',
        partId: 'scattr',
        partType: 'weapon'
    };

    const migrated = validateStagedDesignDocument(legacy, 'scattr');

    assert.equal(migrated.version, 2);
    assert.equal(migrated.partId, 'scattr');
    assert.equal(migrated.partType, 'weapon');
    assert.deepEqual(migrated.grid, { width: 16, height: 31 });
    assert.equal(migrated.layers.base.length, 496);
    assert.deepEqual(migrated.muzzles, [{ x: 15, y: 15.5 }]);
});

test('a 1x2 base accepts a separately authored 2x1 turret', () => {
    const design = createBlankPartDesign({ name: 'wide turret', type: 'weapon', width: 1, height: 2, turretWidth: 2, turretHeight: 1 });
    design.partId = 'scattr'; design.partType = 'weapon';
    design.layers.turret = new Array(31 * 16).fill(0);
    design.anchors.base = { x: 8, y: 15 };
    design.anchors.turret = { x: 15, y: 8 };
    design.muzzles = [{ x: 30.5, y: 5 }, { x: 30.5, y: 11 }];
    const staged = validateStagedDesignDocument(design, 'scattr');
    assert.deepEqual(staged.turretFootprint, { width: 2, height: 1 });
    assert.equal(staged.muzzles.length, 2);
});

test('v2 runtime preview and game geometry share mount and muzzle transforms', () => {
    const design = createBlankPartDesign({ name: 'offset', type: 'weapon' });
    design.layers.turret = new Array(256).fill(0);
    design.anchors.base = { x: 12, y: 8 };
    design.anchors.turret = { x: 4, y: 8 };
    design.muzzles = [{ x: 14, y: 8 }];
    const definition = { id: 'offset', name: 'offset', type: 'weapon', width: 1, height: 1, stats: {} };
    applyVisualDesignOverride(definition, design);
    assert.deepEqual(getDesignerPreviewMount(definition, 100, 100, undefined, Math.PI / 2), { x: 100, y: 108 });
    assert.deepEqual(getDesignerPreviewMuzzle(definition, 100, 100, 0), { x: 128, y: 100 });
});

test('designer save callbacks receive validated v2 copies', () => {
    const design = createBlankPartDesign(); design.partId = 'hull'; design.partType = 'hull';
    const worker = Object.create(Designer.prototype);
    worker.currentPartId = 'hull'; worker.toDesignDocument = () => design;
    let saved = null; worker.stagedSaveCallback = value => { saved = value; };
    const staged = worker.stageSave();
    assert.equal(staged.version, 2);
    assert.notEqual(saved, design);
});

test('designer mirror keeps geometry coherent and supports undo/redo', () => {
    const design = createBlankPartDesign({ name: 'mirror', type: 'weapon' });
    design.layers.turret = new Array(256).fill(0);
    design.layers.turret.splice(0, 4, 1, 2, 3, 4);
    design.anchors.turret = { x: 3.5, y: 8 };
    design.muzzles = [{ x: 14.5, y: 6.5 }];
    const worker = Object.create(Designer.prototype);
    worker.layer = 'turret';
    worker.design = design;
    worker.coreScratch = { spinPivot: { x: 8, y: 8 } };
    worker.histories = new Map([['turret', new LayerHistory({
        pixels: design.layers.turret,
        geometry: { turret: { ...design.anchors.turret }, muzzles: design.muzzles.map(point => ({ ...point })) }
    })]]);
    worker.ensureHistory = () => worker.histories.get('turret');
    worker.changed = () => {};

    worker.mirrorActiveLayer('horizontal');
    assert.deepEqual(worker.design.layers.turret.slice(12, 16), [4, 3, 2, 1]);
    assert.deepEqual(worker.design.anchors.turret, { x: 12.5, y: 8 });
    assert.deepEqual(worker.design.muzzles, [{ x: 1.5, y: 6.5 }]);

    worker.undo();
    assert.deepEqual(worker.design.layers.turret.slice(0, 4), [1, 2, 3, 4]);
    assert.deepEqual(worker.design.anchors.turret, { x: 3.5, y: 8 });
    assert.deepEqual(worker.design.muzzles, [{ x: 14.5, y: 6.5 }]);
    worker.redo();
    assert.deepEqual(worker.design.layers.turret.slice(12, 16), [4, 3, 2, 1]);
});

test('designer history keeps mirror geometry through an interleaved paint undo and redo timeline', () => {
    const design = createBlankPartDesign({ name: 'interleaved mirror', type: 'weapon' });
    design.layers.turret = new Array(256).fill(0);
    design.layers.turret[0] = 1;
    design.anchors.turret = { x: 3.5, y: 8 };
    design.muzzles = [{ x: 14.5, y: 6.5 }];
    const worker = Object.create(Designer.prototype);
    worker.layer = 'turret';
    worker.design = design;
    worker.coreScratch = { spinPivot: { x: 8, y: 8 } };
    worker.histories = new Map([['turret', new LayerHistory({
        pixels: design.layers.turret,
        geometry: { turret: { ...design.anchors.turret }, muzzles: design.muzzles.map(point => ({ ...point })) }
    })]]);
    worker.ensureHistory = () => worker.histories.get('turret');
    worker.changed = () => {};
    worker.setActivePixels = Designer.prototype.setActivePixels.bind(worker);
    worker.commitLayer = Designer.prototype.commitLayer.bind(worker);
    worker.captureLayerState = Designer.prototype.captureLayerState.bind(worker);
    worker.rasterForLayer = Designer.prototype.rasterForLayer.bind(worker);
    worker.captureLayerGeometry = Designer.prototype.captureLayerGeometry.bind(worker);
    worker.restoreLayerState = Designer.prototype.restoreLayerState.bind(worker);
    worker.restoreLayerGeometry = Designer.prototype.restoreLayerGeometry.bind(worker);

    worker.mirrorActiveLayer('horizontal');
    worker.setActivePixels(worker.design.layers.turret.map((pixel, index) => index === 1 ? 2 : pixel));
    worker.commitLayer('turret');

    worker.undo();
    assert.equal(worker.design.layers.turret[15], 1);
    assert.equal(worker.design.layers.turret[1], 0);
    assert.deepEqual(worker.design.anchors.turret, { x: 12.5, y: 8 });
    assert.deepEqual(worker.design.muzzles, [{ x: 1.5, y: 6.5 }]);

    worker.undo();
    assert.equal(worker.design.layers.turret[0], 1);
    assert.deepEqual(worker.design.anchors.turret, { x: 3.5, y: 8 });
    assert.deepEqual(worker.design.muzzles, [{ x: 14.5, y: 6.5 }]);

    worker.redo();
    assert.deepEqual(worker.design.anchors.turret, { x: 12.5, y: 8 });
    assert.deepEqual(worker.design.muzzles, [{ x: 1.5, y: 6.5 }]);
    worker.redo();
    assert.equal(worker.design.layers.turret[1], 2);
    assert.deepEqual(worker.design.anchors.turret, { x: 12.5, y: 8 });
    assert.deepEqual(worker.design.muzzles, [{ x: 1.5, y: 6.5 }]);
});
