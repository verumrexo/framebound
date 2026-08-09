import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const {
    HARD_RASTER_HEADINGS_DEGREES,
    createHardRasterProofScenes,
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
