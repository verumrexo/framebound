import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PartsLibrary } from './Part.js';

test('existing part art and approved family metadata stay exact', () => {
    const manifest = Object.keys(PartsLibrary).sort().map(id => {
        const definition = PartsLibrary[id];
        return {
            id,
            width: definition.width,
            height: definition.height,
            type: definition.type,
            sprite: snapshotSprite(definition.sprite),
            baseSprite: snapshotSprite(definition.baseSprite),
            rotationOffset: definition.rotationOffset,
            turretDrawOffset: definition.turretDrawOffset
        };
    });
    const hash = createHash('sha256')
        .update(JSON.stringify(manifest))
        .digest('hex');

    assert.equal(manifest.length, 30);
    assert.equal(
        hash,
        '529e15a197e0d00b51600e35e334a232dbc80db8bbbcc50c39e4547b87669e2d'
    );
});

function snapshotSprite(sprite) {
    if (!sprite) return null;
    return {
        data: sprite.data,
        width: sprite.width,
        height: sprite.height,
        scale: sprite.scale,
        colorMap: sprite.colorMap,
        anchorX: sprite.anchorX,
        anchorY: sprite.anchorY
    };
}
