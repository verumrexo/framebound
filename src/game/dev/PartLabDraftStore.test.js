import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PartType } from '../../shared/parts/PartDefinitions.js';
import { createBlankPartDesign } from './PartDesignDocument.js';
import {
    getPartLabDraftState,
    normalizePartLabDraftState,
    PartLabDraftStore
} from './PartLabDraftStore.js';

const PARTS = {
    dart: { id: 'dart', name: 'dart', type: PartType.WEAPON, stats: {} }
};

function storage() {
    const values = new Map();
    return {
        values,
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
}

test('part lab drafts autosave, normalize, and survive a fresh store', () => {
    const fakeStorage = storage();
    const store = new PartLabDraftStore({ storage: fakeStorage, partsLibrary: PARTS, now: () => '2026-08-11T00:00:00.000Z' });
    const design = createBlankPartDesign({ name: 'dart', type: 'weapon' });
    design.partId = 'dart';
    design.partType = 'weapon';

    store.saveVisual('dart', design);
    store.saveReview('dart', 'good', '  flies well  ');
    assert.equal(fakeStorage.values.size, 1);
    assert.equal(getPartLabDraftState(store.get('dart')), 'tested');

    const restored = new PartLabDraftStore({ storage: fakeStorage, partsLibrary: PARTS });
    assert.equal(restored.get('dart').visual.partId, 'dart');
    assert.deepEqual(restored.get('dart').review, { status: 'good', notes: 'flies well' });
});

test('part lab draft normalization drops malformed and unknown entries', () => {
    const normalized = normalizePartLabDraftState({
        parts: {
            '../escape': { review: { status: 'good' } },
            missing: { review: { status: 'good' } },
            dart: { review: { status: 'wat', notes: 'x'.repeat(400) } }
        }
    }, PARTS);
    assert.deepEqual(normalized.parts.dart.review, { status: 'untested', notes: 'x'.repeat(240) });
    assert.deepEqual(Object.keys(normalized.parts), ['dart']);
});

test('discard and reset remove drafts only after explicit calls', () => {
    const fakeStorage = storage();
    const store = new PartLabDraftStore({ storage: fakeStorage, partsLibrary: PARTS });
    store.saveReview('dart', 'needs-work', 'fix it');
    assert.equal(store.discard('dart'), true);
    assert.equal(store.get('dart'), null);
    store.saveReview('dart', 'good');
    store.reset();
    assert.equal(store.get('dart'), null);
});
