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

    assert.equal(manifest.length, 40);
    assert.equal(
        hash,
        '6527f3c4bb09f558617f9336bf127f5ce9f8791353f469f63268871255c8bee1'
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
