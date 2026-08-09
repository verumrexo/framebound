import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getShopItemState } from '../renderers/ShopPresentation.js';

const {
    HARD_RASTER_HEADINGS_DEGREES,
    createHardRasterProofScenes,
    createDroneFamilyProofEntries,
    createShopProofItems,
    getHardRasterProofScale
} = await import('./VisualGallery.js');

test('hard-raster proof covers every required continuous heading', () => {
    assert.deepEqual(HARD_RASTER_HEADINGS_DEGREES, [0, 22.5, 45, 67.5, 90]);

    const scenes = createHardRasterProofScenes();
    assert.equal(scenes.length, 20);
    assert.deepEqual(
        [...new Set(scenes.map(scene => scene.entityType))],
        ['local-ship', 'remote-player', 'modular-enemy', 'boss']
    );
    assert.deepEqual(
        [...new Set(scenes.map(scene => scene.headingDegrees))],
        HARD_RASTER_HEADINGS_DEGREES
    );
});

test('hard-raster proof scene identities and turret aims stay distinct', () => {
    const scenes = createHardRasterProofScenes();
    assert.equal(new Set(scenes.map(scene => scene.id)).size, scenes.length);

    for (const scene of scenes) {
        assert.notEqual(scene.turretAimDegrees, scene.headingDegrees);
    }
});

test('hard-raster proof defaults to the approved 3x scale and accepts only bounded comparisons', () => {
    assert.equal(getHardRasterProofScale('?visual-gallery=hard-raster'), 3);
    assert.equal(getHardRasterProofScale('?visual-gallery=hard-raster&raster-scale=1'), 1);
    assert.equal(getHardRasterProofScale('?visual-gallery=hard-raster&raster-scale=2'), 2);
    assert.equal(getHardRasterProofScale('?visual-gallery=hard-raster&raster-scale=3'), 3);
    assert.equal(getHardRasterProofScale('?visual-gallery=hard-raster&raster-scale=4'), 3);
    assert.equal(getHardRasterProofScale('?visual-gallery=hard-raster&raster-scale=0'), 3);
});

test('shop proof covers affordable, unaffordable, and sold terminal states', () => {
    const items = createShopProofItems(1000, 800);
    assert.equal(items.length, 4);
    assert.deepEqual(
        items.map(item => getShopItemState(item, 65)),
        ['affordable', 'affordable', 'unaffordable', 'sold']
    );
});

test('drone-family proof covers every new carrier and deployed silhouette', () => {
    const entries = createDroneFamilyProofEntries();
    assert.equal(entries.length, 10);
    assert.equal(new Set(entries.map(entry => entry.partId)).size, 10);
    assert.equal(new Set(entries.map(entry => entry.droneType)).size, 10);
    for (const entry of entries) {
        assert.equal(entry.carrierLabel, entry.carrierLabel.toLowerCase());
        assert.equal(entry.droneLabel, entry.droneLabel.toLowerCase());
        assert.ok(entry.partDef.sprite.data.length > 0);
    }
});
