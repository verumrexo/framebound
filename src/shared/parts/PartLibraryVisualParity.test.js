import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PartsLibrary } from './Part.js';

test('existing part pixels, anchors, footprints, and mount offsets stay exact', () => {
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
        '96ebc3c47664079b29629bf3037f61d3d74c66ad6b8dea72cff868595ecdaa64'
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
