import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBlankPartDesign,
    serializePartDesign
} from '../dev/PartDesignDocument.js';

const {
    Designer,
    partDefinitionToDesign,
    validateStagedDesignDocument
} = await import('./Designer.js');

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
