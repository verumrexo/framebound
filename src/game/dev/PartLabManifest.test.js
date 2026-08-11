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
