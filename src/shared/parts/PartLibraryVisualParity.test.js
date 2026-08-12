import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PartsLibrary } from './Part.js';

const ADDED_PART_IDS = new Set([
    'warp_gate', 'mine_placer', 'captain_seat', 'beam_sword',
    'shrapnel_grenade', 'decoy', 'stealth', 'hack_dart', 'auto_aim',
    'prism', 'emp', 'fmj',
    'patch_plate', 'keel_beam', 'bulkhead', 'coffin_hull', 'glasswing',
    'engine_brace', 'salvage_magnet', 'coolant_loop', 'gyro_ring',
    'rangefinder', 'needler', 'twin_dart', 'heavy_slugger', 'burst_cannon',
    'ricochet_cannon', 'arc_welder', 'pulse_lance', 'lightning_rod',
    'micro_missile_pod', 'torpedo_tube'
]);

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
    const originalManifest = manifest.filter(({ id }) => !ADDED_PART_IDS.has(id));
    const hash = createHash('sha256')
        .update(JSON.stringify(originalManifest))
        .digest('hex');

    assert.equal(manifest.length, 72);
    assert.equal(originalManifest.length, 40);
    assert.equal(
        hash,
        '641dedaa54e52d5b17d44f5a42e9efceaaa1046d8a13d66cc77a3f4a68d74e7f'
    );
});

test('legacy laser turret offset follows the new renderer stride', () => {
    assert.equal(PartsLibrary.custom_1767999386292.turretDrawOffset, 12);
});

test('auto aim is explicitly legendary and reuses the core effect geometry in red', () => {
    const core = PartsLibrary.core.coreEffectSprite;
    const autoAim = PartsLibrary.auto_aim;

    assert.equal(autoAim.rarity, 'legendary');
    assert.deepEqual(autoAim.coreEffectSprite.data, core.data);
    assert.deepEqual(autoAim.coreEffectSprite.colorMap, { 1: '#ff4444' });
});

test('stealth has a distinct hand-authored violet core effect', () => {
    const core = PartsLibrary.core.coreEffectSprite;
    const stealth = PartsLibrary.stealth.coreEffectSprite;
    assert.ok(stealth);
    assert.equal(stealth.colorMap[1], '#b56cff');
    assert.notDeepEqual(stealth.data, core.data);
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
