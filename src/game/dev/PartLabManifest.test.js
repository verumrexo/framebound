import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PartType } from '../../shared/parts/PartDefinitions.js';
import { createBlankPartDesign } from './PartDesignDocument.js';
import {
    applyVisualDesignOverride,
    buildPartLabManifest,
    normalizePartLabManifest,
    parsePartLabManifest,
    serializePartLabManifest
} from './PartLabManifest.js';
import {
    clearDroneVisualOverrides,
    getDroneBlueprintVisual
} from '../../shared/combat/DroneBlueprints.js';
import { createCoreEffectSprite } from '../../shared/parts/CoreEffect.js';

function design() {
    const value = createBlankPartDesign({ name: 'dart', type: 'weapon' });
    value.partId = 'dart';
    value.partType = PartType.WEAPON;
    value.layers.base[0] = 1;
    value.layers.turret = [...value.layers.base];
    return value;
}

test('part lab manifests validate visual, sound, and review records', () => {
    const manifest = normalizePartLabManifest({
        schemaVersion: 1,
        version: 3,
        modifiedAt: '2026-08-11T00:00:00.000Z',
        visuals: [{ partId: 'dart', design: design() }],
        sounds: [{
            partId: 'dart',
            slots: [{
                id: 'fire',
                label: 'fire',
                eventKey: 'part:dart:fire',
                fallback: 'shoot_dart',
                optional: false,
                assignment: { source: 'runtime', eventId: 'shoot_dart' }
            }]
        }],
        reviews: [{ partId: 'dart', status: 'good', notes: 'clean' }]
    });
    const restored = parsePartLabManifest(serializePartLabManifest(manifest));
    assert.equal(restored.visuals[0].design.partId, 'dart');
    assert.equal(restored.sounds[0].slots[0].assignment.eventId, 'shoot_dart');
    assert.equal(restored.reviews[0].status, 'good');
});

test('manifest builder promotes only staged records and bounds review notes', () => {
    const state = {
        parts: {
            dart: { visual: design(), sound: null, review: { status: 'needs-work', notes: 'x'.repeat(400) } }
        }
    };
    const manifest = buildPartLabManifest(state, '2026-08-11T00:00:00.000Z');
    assert.equal(manifest.visuals.length, 1);
    assert.equal(manifest.sounds.length, 0);
    assert.equal(manifest.reviews[0].notes.length, 240);
});

test('visual override changes art while preserving gameplay stats and identity', () => {
    const stats = { hp: 10, mass: 2, damage: 5, cooldown: 1, barrelPosition: { x: 3, y: 4 } };
    const definition = {
        id: 'dart', name: 'dart', description: 'keep this', type: 'weapon', width: 1, height: 1,
        stats, rotationOffset: 0, drawTurretInInventory: true,
        sprite: { data: new Array(64).fill(0), width: 8, height: 8, scale: 4, colorMap: { 1: '#fff' }, anchorX: .5, anchorY: .5 },
        baseSprite: { data: new Array(64).fill(0), width: 8, height: 8, scale: 4, colorMap: { 1: '#fff' }, anchorX: .5, anchorY: .5 }
    };
    const value = design();
    value.layers.turret[1] = 2;
    applyVisualDesignOverride(definition, value);
    assert.equal(definition.id, 'dart');
    assert.equal(definition.description, 'keep this');
    assert.deepEqual(definition.stats, stats);
    assert.equal(definition.sprite.data[1], 2);
    assert.equal(definition.drawTurretInInventory, true);
});

test('v2 visual overrides use 31px two-cell rasters while keeping 1x1 art at 32 world px', () => {
    const value = createBlankPartDesign({
        name: 'wide hull',
        type: 'hull',
        width: 1,
        height: 2
    });
    const definition = {
        id: 'wide-hull',
        name: 'wide hull',
        type: PartType.HULL,
        width: 1,
        height: 2,
        stats: {},
        sprite: {
            data: new Array(64).fill(0),
            width: 8,
            height: 8,
            scale: 4,
            anchorX: 0.5,
            anchorY: 0.5
        }
    };

    applyVisualDesignOverride(definition, value);

    assert.deepEqual(value.grid, { width: 16, height: 31 });
    assert.equal(definition.sprite.width, 16);
    assert.equal(definition.sprite.height, 31);
    assert.equal(definition.sprite.scale, 2);
    assert.equal(definition.sprite.width * definition.sprite.scale, 32);
    assert.equal(definition.visualGeometry, undefined);
});

test('part lab normalization migrates old v2 30px visual documents before applying them', () => {
    const old = createBlankPartDesign({ name: 'old tall hull', type: 'hull', width: 1, height: 2 });
    old.grid = { width: 16, height: 30 };
    old.layers.base = new Array(16 * 30).fill(0);
    const manifest = normalizePartLabManifest({
        schemaVersion: 1,
        version: 1,
        modifiedAt: '2026-08-11T00:00:00.000Z',
        visuals: [{ partId: 'old-tall-hull', design: old }],
        sounds: [],
        reviews: []
    });

    assert.deepEqual(manifest.visuals[0].design.grid, { width: 16, height: 31 });
    assert.equal(manifest.visuals[0].design.layers.base.length, 16 * 31);
});

test('non-weapon visual overrides replace visible art and clear stale auxiliary layers', () => {
    const staleBase = {
        data: new Array(64).fill(2),
        width: 8,
        height: 8,
        scale: 4,
        anchorX: 0.5,
        anchorY: 0.5
    };
    const definition = {
        id: 'hull',
        name: 'hull',
        description: 'preserve me',
        type: 'hull',
        width: 1,
        height: 1,
        stats: { hp: 22, mass: 4 },
        sprite: {
            data: new Array(64).fill(1),
            width: 8,
            height: 8,
            scale: 4,
            colorMap: { 1: '#fff' },
            anchorX: 0.5,
            anchorY: 0.5
        },
        baseSprite: staleBase,
        drawTurretInInventory: true
    };
    const value = createBlankPartDesign({ name: 'hull', type: 'hull' });
    value.partId = 'hull';
    value.layers.base[0] = 2;

    applyVisualDesignOverride(definition, value);

    assert.equal(definition.sprite.data[0], 2);
    assert.equal(definition.baseSprite, null);
    assert.equal(definition.drawTurretInInventory, false);
    assert.deepEqual(definition.stats, { hp: 22, mass: 4 });
    assert.equal(definition.description, 'preserve me');
});

test('part lab manifests round-trip and apply nested drone visuals without mutating blueprints', () => {
    const droneDesign = createBlankPartDesign({ name: 'hive', type: 'drone' });
    droneDesign.partId = 'hive';
    droneDesign.partType = PartType.DRONE;
    droneDesign.stats = { hp: 40, mass: 4, droneType: 'striker' };
    droneDesign.drone = {
        blueprintId: 'striker',
        resolution: 16,
        grid: { width: 16, height: 16 },
        palette: ['#00ffff', '#177777'],
        layers: { base: new Array(256).fill(0).map((_, index) => index === 0 ? 2 : 0) },
        projectileLook: 'heavy-slug',
        projectileTrail: 'smoke'
    };
    const manifest = normalizePartLabManifest({
        schemaVersion: 1,
        version: 1,
        modifiedAt: '2026-08-11T00:00:00.000Z',
        visuals: [{ partId: 'hive', design: droneDesign }],
        sounds: [],
        reviews: []
    });
    const restored = parsePartLabManifest(serializePartLabManifest(manifest));
    const definition = {
        id: 'hive', type: PartType.DRONE, width: 1, height: 1,
        stats: { hp: 40, mass: 4, droneType: 'striker' },
        sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 }
    };

    applyVisualDesignOverride(definition, restored.visuals[0].design);
    const visual = getDroneBlueprintVisual('striker');
    assert.equal(visual.visualPixels[0], 2);
    assert.deepEqual(visual.visualGrid, { width: 16, height: 16 });
    assert.equal(visual.projectileLook, 'heavy-slug');
    assert.equal(visual.projectileTrail, 'smoke');
    clearDroneVisualOverrides();
});

test('visual override preserves, removes, and replaces core effects by field presence', () => {
    const original = createCoreEffectSprite('#55ccff');
    const definition = {
        id: 'hull', name: 'hull', type: 'hull', width: 1, height: 1,
        stats: { hp: 22, mass: 4 },
        sprite: { data: new Array(64).fill(1), width: 8, height: 8, scale: 4, anchorX: .5, anchorY: .5 },
        coreEffectSprite: original
    };
    const absent = createBlankPartDesign({ name: 'hull', type: 'hull' });
    delete absent.coreEffect;
    applyVisualDesignOverride(definition, absent);
    assert.equal(definition.coreEffectSprite, original);

    const replacement = createBlankPartDesign({ name: 'hull', type: 'hull' });
    replacement.coreEffect = {
        resolution: 16,
        grid: { width: 16, height: 16 },
        palette: ['#b56cff'],
        layers: { base: new Array(256).fill(0).map((_, index) => index === 3 ? 1 : 0) }
    };
    applyVisualDesignOverride(definition, replacement);
    assert.notEqual(definition.coreEffectSprite, original);
    assert.equal(definition.coreEffectSprite.colorMap[1], '#b56cff');
    assert.equal(definition.coreEffectSprite.data[3], 1);

    const removed = createBlankPartDesign({ name: 'hull', type: 'hull' });
    removed.coreEffect = null;
    applyVisualDesignOverride(definition, removed);
    assert.equal(definition.coreEffectSprite, null);
});
