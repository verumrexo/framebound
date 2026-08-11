import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isPartLabReviewUntested, PartLabWindow, getPartLabCatalogRows } from './PartLabWindow.js';
import { createBlankPartDesign } from './PartDesignDocument.js';
import { PART_SOUND_EDITOR_INTRO } from './PartSoundEditorWindow.js';

const PARTS = {
    dart: { name: 'dart', type: 'weapon', description: 'fires a simple bullet' },
    hull: { name: 'hull block', type: 'hull', description: 'adds basic armor' }
};

test('part lab catalog helper searches ids, names, descriptions, and type filters', () => {
    assert.deepEqual(getPartLabCatalogRows(PARTS, { query: 'armor' }).map(row => row.id), ['hull']);
    assert.deepEqual(getPartLabCatalogRows(PARTS, { query: 'dart', type: 'weapon' }).map(row => row.id), ['dart']);
    assert.equal(getPartLabCatalogRows(PARTS)[0].state, 'untouched');
});

test('untouched part-lab entries count as untested', () => {
    assert.equal(isPartLabReviewUntested(null), true);
    assert.equal(isPartLabReviewUntested({ review: { status: 'untested' } }), true);
    assert.equal(isPartLabReviewUntested({ review: { status: 'good' } }), false);
});

test('sound editor explains immediate staging versus source promotion', () => {
    assert.match(PART_SOUND_EDITOR_INTRO, /only sounds this part actually uses are shown/);
    assert.match(PART_SOUND_EDITOR_INTRO, /save all promotes source changes/);
});

test('visual editor failures reopen the catalog instead of exposing connecting', () => {
    const lab = Object.create(PartLabWindow.prototype);
    lab.partsLibrary = { dart: { id: 'dart', name: 'dart', type: 'weapon' } };
    lab.store = { get: () => ({ visual: { version: 1 } }) };
    lab.game = { designer: { openPart: () => { throw new Error('bad old draft'); } } };
    lab.closing = false;
    lab.hideCatalog = () => { lab.hidden = true; };
    lab.open = () => { lab.reopened = true; return lab; };
    lab.setStatus = message => { lab.statusMessage = message; };

    lab.openVisual('dart');

    assert.equal(lab.hidden, true);
    assert.equal(lab.reopened, true);
    assert.match(lab.statusMessage, /bad old draft/);
});

function bareWindow({ audio, forge, store = { state: { parts: {} } } } = {}) {
    const lab = Object.create(PartLabWindow.prototype);
    lab.game = {
        audio,
        signalForge: forge
    };
    lab.store = store;
    lab.partSoundEventKeys = new Set(['part:dart:fire', 'part:dart:impact']);
    lab.baselineBindings = new Map();
    lab.stagedSoundEventKeys = new Set();
    lab.applyStoredSoundDrafts = () => {};
    return lab;
}

test('staged sound restore only touches part-lab event keys and preserves global bindings', () => {
    const audio = {
        eventBindings: new Map([
            ['global:menu', 'menu'],
            ['part:dart:fire', 'shoot_dart']
        ]),
        bindEvent(eventKey, soundName) {
            this.eventBindings.set(eventKey, soundName);
        },
        unbindEvent(eventKey) {
            this.eventBindings.delete(eventKey);
        }
    };
    const lab = bareWindow({ audio });
    lab.captureBaselineSoundBindings();
    audio.bindEvent('part:dart:impact', 'forge:impact');
    lab.stagedSoundEventKeys = new Set(['part:dart:fire', 'part:dart:impact']);

    lab.restoreStagedSoundBindings();

    assert.equal(audio.eventBindings.get('global:menu'), 'menu');
    assert.equal(audio.eventBindings.get('part:dart:fire'), 'shoot_dart');
    assert.equal(audio.eventBindings.has('part:dart:impact'), false);
});

test('forge sync changes only explicit staged slots and preserves unrelated part bindings', async () => {
    const forge = {
        bindings: new Map([
            ['part:unrelated:fire', 'keep-me'],
            ['part:dart:fire', 'old']
        ]),
        sounds: new Map([['new-hit', { id: 'new-hit' }]]),
        getBinding(eventKey) { return this.bindings.get(eventKey) || null; },
        async bind(eventKey, soundId) { this.bindings.set(eventKey, soundId); },
        async unbind(eventKey) { this.bindings.delete(eventKey); }
    };
    const audio = {
        eventBindings: new Map(),
        bindEvent(eventKey, soundName) {
            this.eventBindings.set(eventKey, soundName);
            return true;
        },
        unbindEvent(eventKey) {
            this.eventBindings.delete(eventKey);
        }
    };
    const lab = bareWindow({ audio, forge });

    await lab.syncForgeBindings({
        sounds: [{
            partId: 'dart',
            slots: [
                {
                    eventKey: 'part:dart:fire',
                    assignment: { source: 'signal-forge', soundId: 'new-hit' }
                },
                {
                    eventKey: 'part:dart:impact',
                    assignment: null
                }
            ]
        }]
    });

    assert.equal(forge.bindings.get('part:unrelated:fire'), 'keep-me');
    assert.equal(forge.bindings.get('part:dart:fire'), 'new-hit');
    assert.equal(forge.bindings.has('part:dart:impact'), false);
});

test('browser fallback downloads without marking the draft promoted', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:part-lab-test';
    URL.revokeObjectURL = () => {};
    const link = {
        click() { this.clicked = true; }
    };
    const documentRef = {
        createElement() { return link; }
    };
    const design = createBlankPartDesign({ name: 'dart', type: 'weapon' });
    design.partId = 'dart';
    const store = {
        state: {
            version: 1,
            parts: {
                dart: {
                    visual: design,
                    sound: null,
                    review: { status: 'untested', notes: '' },
                    savedAt: null
                }
            }
        },
        markPromoted() {
            throw new Error('browser fallback must not mark promoted');
        }
    };
    const lab = bareWindow({
        store,
        audio: { eventBindings: new Map() },
        forge: null
    });
    lab.bridge = { available: false };
    lab.document = documentRef;
    lab.syncForgeBindings = async () => {};
    lab.setStatus = message => { lab.statusMessage = message; };

    const result = await lab.saveAll();

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    assert.deepEqual(result, {
        promoted: false,
        downloaded: true,
        timestamp: result.timestamp
    });
    assert.equal(link.clicked, true);
    assert.equal(store.state.parts.dart.savedAt, null);
    assert.match(lab.statusMessage, /downloaded only/);
});
