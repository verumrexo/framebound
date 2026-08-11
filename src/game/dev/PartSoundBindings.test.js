import test from 'node:test';
import assert from 'node:assert/strict';
import { PartType } from '../../shared/parts/PartDefinitions.js';
import {
    createPartSoundDraft,
    getAssignmentForSlot,
    getPartLabSoundSlots,
    getPartSoundProfile,
    inspectPartSoundSlot,
    listPartSoundChoices,
    parseSoundChoiceKey,
    serializePartSoundDraft,
    soundChoiceKey,
    withPartSoundAssignment
} from './PartSoundBindings.js';

function audioWith(...names) {
    return {
        sounds: new Map(names.map(name => [name, {}])),
        hasSound(name) {
            return this.sounds.has(name);
        }
    };
}

test('part lab exposes exactly two semantic slots for every part family', () => {
    const weapon = getPartLabSoundSlots({ id: 'railgun', type: PartType.WEAPON, stats: {} });
    assert.deepEqual(weapon.map(slot => [slot.id, slot.eventSlot]), [
        ['fire', 'fire'],
        ['hit', 'impact']
    ]);
    assert.deepEqual(getPartSoundProfile({ id: 'hive', type: PartType.DRONE }), 'drone');
    assert.deepEqual(
        getPartLabSoundSlots({ id: 'hive', type: PartType.DRONE }).map(slot => slot.id),
        ['deploy', 'action']
    );
    assert.deepEqual(
        getPartLabSoundSlots({
            id: 'warp_gate',
            type: PartType.UTILITY,
            stats: { activeAbility: 'blink' }
        }).map(slot => [slot.id, slot.fallback]),
        [['activate', 'dash'], ['effect', 'nova']]
    );
    assert.deepEqual(
        getPartLabSoundSlots({ id: 'hull', type: PartType.HULL }).map(slot => slot.optional),
        [true, true]
    );
    assert.deepEqual(getPartSoundProfile({ id: 'hull', type: PartType.HULL }), 'passive');
});
test('drafts retain current Signal Forge bindings and serialize semantic event keys', () => {
    const signalForge = {
        sounds: new Map([['zap', { id: 'zap', name: 'zap custom' }]]),
        bindings: new Map([['part:gun_basic:fire', 'zap']]),
        audioName: id => `forge:${id}`,
        getBinding(eventKey) {
            return this.bindings.get(eventKey) || null;
        }
    };
    const part = {
        id: 'gun_basic',
        name: 'Dart',
        type: PartType.WEAPON,
        stats: {}
    };

    const draft = createPartSoundDraft(part, signalForge);
    assert.equal(draft.schemaVersion, 1);
    assert.equal(draft.slots[0].eventKey, 'part:gun_basic:fire');
    assert.deepEqual(draft.slots[0].assignment, {
        source: 'signal-forge',
        soundId: 'zap'
    });
    assert.equal(draft.slots[1].eventKey, 'part:gun_basic:impact');
    assert.equal(draft.slots[1].assignment, null);

    const staged = withPartSoundAssignment(
        draft,
        'hit',
        { source: 'runtime', eventId: 'explosion' }
    );
    assert.equal(getAssignmentForSlot(draft, 'hit'), null);
    assert.deepEqual(getAssignmentForSlot(staged, 'hit'), {
        source: 'runtime',
        eventId: 'explosion'
    });
    assert.deepEqual(
        JSON.parse(JSON.stringify(staged)),
        serializePartSoundDraft(part, staged)
    );
});

test('choice keys and slot states distinguish default, custom, and missing audio', () => {
    const signalForge = {
        sounds: new Map([['zap', { id: 'zap', name: 'zap custom' }]]),
        audioName: id => `forge:${id}`
    };
    const audio = audioWith('shoot_dart', 'hit', 'forge:zap');
    const part = { id: 'gun_basic', type: PartType.WEAPON, stats: {} };
    const [fire, hit] = getPartLabSoundSlots(part);

    assert.equal(inspectPartSoundSlot(fire, null, { audio, signalForge }).status, 'default');
    assert.equal(inspectPartSoundSlot(
        fire,
        { source: 'signal-forge', soundId: 'zap' },
        { audio, signalForge }
    ).status, 'custom');
    assert.equal(inspectPartSoundSlot(
        hit,
        { source: 'runtime', eventId: 'not_registered' },
        { audio, signalForge }
    ).status, 'missing');

    const choices = listPartSoundChoices({ audio, signalForge });
    const saved = choices.find(choice => choice.soundId === 'zap');
    assert.equal(saved.available, true);
    assert.deepEqual(parseSoundChoiceKey(soundChoiceKey(saved)), {
        source: 'signal-forge',
        soundId: 'zap'
    });
    assert.equal(choices.some(choice => choice.eventId === 'shoot_dart' && choice.available), true);
});
