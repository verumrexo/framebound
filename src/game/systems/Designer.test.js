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

test('a 1x2 base accepts a separately authored 2x1 turret', () => {
    const design = createBlankPartDesign({ name: 'wide turret', type: 'weapon', width: 1, height: 2, turretWidth: 2, turretHeight: 1 });
    design.partId = 'scattr'; design.partType = 'weapon';
    design.layers.turret = new Array(30 * 16).fill(0);
    design.anchors.base = { x: 8, y: 15 };
    design.anchors.turret = { x: 15, y: 8 };
    design.muzzles = [{ x: 29.5, y: 5 }, { x: 29.5, y: 11 }];
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
