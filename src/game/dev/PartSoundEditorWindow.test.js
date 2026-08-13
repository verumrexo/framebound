import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PartSoundEditorWindow } from './PartSoundEditorWindow.js';

function bareEditor() {
    const editor = Object.create(PartSoundEditorWindow.prototype);
    editor.part = { id: 'drone_a' };
    editor.activeSlotId = 'fire';
    editor.draft = {
        slots: [{ id: 'fire', label: 'fire', assignment: null }]
    };
    editor.onChange = () => {};
    editor.render = () => {};
    editor.setStatus = message => { editor.statusMessage = message; };
    return editor;
}

test('duplicating from the part editor loads an owned composer copy, never a shared record', async () => {
    const editor = bareEditor();
    const shared = { id: 'shared', name: 'shared', recipe: { frequency: 220 } };
    const copy = { id: 'shared-copy-1', name: 'shared copy', recipe: { frequency: 220 } };
    editor.signalForge = {
        sounds: new Map([[shared.id, shared]]),
        async duplicateSound(soundId) {
            assert.equal(soundId, shared.id);
            return copy;
        }
    };
    let loaded = null;
    editor.loadOwnedSound = async sound => { loaded = sound; };

    await editor.duplicateSaved(shared.id);

    assert.equal(loaded, copy);
});

test('assignment stays unchanged until the explicit use-for-slot action runs', () => {
    const editor = bareEditor();
    let changes = 0;
    editor.onChange = () => { changes += 1; };
    assert.equal(editor.draft.slots[0].assignment, null);
    assert.equal(changes, 0);

    editor.assignSlot('fire', { source: 'signal-forge', soundId: 'shared' });

    assert.deepEqual(editor.draft.slots[0].assignment, { source: 'signal-forge', soundId: 'shared' });
    assert.equal(changes, 1);
});

test('new preset and mutate workflows request fresh persistent library records', async () => {
    const editor = bareEditor();
    editor.presetSelect = { value: 'laser/shoot' };
    editor.nameInput = { value: '' };
    editor.adapter = {
        async create() { return { frequency: 220 }; },
        async mutate() { return { frequency: 330 }; }
    };
    editor.refreshRecipe = async () => {
        editor.rendered = { wavBytes: new Uint8Array([1]), sampleRate: 44100, duration: .1, peak: .1 };
    };
    const requests = [];
    editor.saveGenerated = async options => { requests.push(options); return { id: `sound-${requests.length}` }; };
    editor.currentSound = null;

    await editor.newFromPreset();
    await editor.mutate();

    assert.deepEqual(requests, [
        { forceNew: true, reason: 'new preset saved' },
        { forceNew: true, reason: 'mutated sound saved' }
    ]);
});

test('part sound editor exposes safe library actions and explicit save labels', async () => {
    const source = await readFile(new URL('./PartSoundEditorWindow.js', import.meta.url), 'utf8');
    assert.match(source, /listen/);
    assert.match(source, /use for slot/);
    assert.match(source, /duplicate \+ edit/);
    assert.match(source, /save sound/);
    assert.match(source, /save part/);
    assert.doesNotMatch(source, /button\(this\.document, 'select'/);
});
