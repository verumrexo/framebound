import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PART_FIRE_DEFAULTS,
    SOUND_EVENTS,
    auditSoundEvents,
    getPackagedSoundManifest,
    getPartSoundSlots,
    globalSoundEventKey,
    partSoundEventKey
} from './SoundEventRegistry.js';

test('sound event ids and packaged asset paths are unique', () => {
    const ids = SOUND_EVENTS.map(entry => entry.id);
    const assets = getPackagedSoundManifest().map(entry => entry.url);

    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(assets).size, assets.length);
});

test('every part fire fallback resolves to a registered event', () => {
    const ids = new Set(SOUND_EVENTS.map(entry => entry.id));
    for (const eventId of Object.values(PART_FIRE_DEFAULTS)) {
        assert.equal(ids.has(eventId), true, eventId);
    }
});

test('event keys are stable and the audit exposes incomplete defaults', () => {
    assert.equal(partSoundEventKey('gun_basic'), 'part:gun_basic:fire');
    assert.equal(globalSoundEventKey('dash'), 'global:dash');
    assert.deepEqual(auditSoundEvents(['dash', 'bogus']).missing, ['bogus']);
    assert.equal(auditSoundEvents().withoutPackagedDefault.includes('respawn'), true);
});

test('part capabilities expose every audible slot without changing fallbacks', () => {
    assert.deepEqual(getPartSoundSlots({
        id: 'rocketle',
        type: 'weapon',
        stats: { weaponGroup: 'rocket' }
    }), [
        { id: 'launch', label: 'rocket launch', fallback: 'shoot_rocketle' },
        { id: 'explosion', label: 'explosion', fallback: 'explosion' }
    ]);
    assert.deepEqual(getPartSoundSlots({
        id: 'hive',
        type: 'drone',
        stats: {}
    }).map(slot => slot.id), ['deploy', 'shoot', 'destroyed']);
    assert.deepEqual(getPartSoundSlots({
        id: 'warp_gate',
        type: 'utility',
        stats: { activeAbility: 'blink' }
    }).map(slot => slot.id), ['departure', 'arrival']);
    assert.deepEqual(getPartSoundSlots({ id: 'hull', type: 'hull' }), []);
});
