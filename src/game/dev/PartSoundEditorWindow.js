import { JfxrAdapter } from '../audio/JfxrAdapter.js';
import {
    createPartSoundDraft,
    getAssignmentForSlot,
    getPartLabSoundSlots,
    inspectPartSoundSlot,
    serializePartSoundDraft,
    withPartSoundAssignment
} from './PartSoundBindings.js';

const CONTROL_KEYS = new Set([
    'waveform', 'attack', 'sustain', 'sustainPunch', 'decay',
    'frequency', 'frequencySweep', 'frequencyDeltaSweep',
    'repeatFrequency', 'frequencyJump1Onset', 'frequencyJump1Amount',
    'harmonics', 'harmonicsFalloff', 'vibratoDepth', 'vibratoFrequency',
    'squareDuty', 'squareDutySweep', 'flangerOffset', 'flangerOffsetSweep',
    'bitCrush', 'bitCrushSweep', 'lowPassCutoff', 'lowPassCutoffSweep',
    'highPassCutoff', 'highPassCutoffSweep', 'compression',
    'normalization', 'amplification'
]);

const PARAMETER_GROUPS = [
    {
        id: 'envelope',
        label: 'envelope',
        keys: new Set(['attack', 'sustain', 'sustainPunch', 'decay'])
    },
    {
        id: 'pitch',
        label: 'pitch',
        keys: new Set(['waveform', 'frequency', 'frequencySweep', 'frequencyDeltaSweep', 'repeatFrequency', 'frequencyJump1Onset', 'frequencyJump1Amount'])
    },
    {
        id: 'texture',
        label: 'texture + modulation',
        keys: new Set(['harmonics', 'harmonicsFalloff', 'vibratoDepth', 'vibratoFrequency', 'squareDuty', 'squareDutySweep', 'flangerOffset', 'flangerOffsetSweep', 'bitCrush', 'bitCrushSweep'])
    },
    {
        id: 'output',
        label: 'filters + output',
        keys: new Set(['lowPassCutoff', 'lowPassCutoffSweep', 'highPassCutoff', 'highPassCutoffSweep', 'compression', 'normalization', 'amplification'])
    }
];

export const PART_SOUND_EDITOR_INTRO = 'only this part\'s sound slots are shown. choose a slot, listen or create a sound, then use it for that slot. library sounds are shared; duplicate before shaping. save sound stores audio, save part commits slot assignments, and save all promotes source changes.';

function cloneDraft(draft) {
    return {
        ...draft,
        slots: draft.slots.map(slot => ({
            ...slot,
            assignment: slot.assignment ? { ...slot.assignment } : null
        }))
    };
}

function isFormControl(target) {
    return target instanceof globalThis.HTMLInputElement ||
        target instanceof globalThis.HTMLSelectElement ||
        target instanceof globalThis.HTMLTextAreaElement ||
        target instanceof globalThis.HTMLButtonElement;
}

function option(documentRef, value, label = value) {
    const entry = documentRef.createElement('option');
    entry.value = value;
    entry.textContent = label;
    return entry;
}

function button(documentRef, label, action, className = '') {
    const element = documentRef.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.className = `part-sound-button ${className}`.trim();
    element.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        action();
    };
    return element;
}

export class PartSoundEditorWindow {
    constructor(game, {
        signalForge = game?.signalForge,
        audio = game?.audio,
        onSave = () => {},
        onCancel = () => {},
        onChange = () => {},
        onClose = () => {},
        onNext = null,
        partsLibrary = null,
        documentRef = globalThis.document,
        adapter = new JfxrAdapter()
    } = {}) {
        this.game = game;
        this.signalForge = signalForge;
        this.audio = audio;
        this.onSave = onSave;
        this.onCancel = onCancel;
        this.onChange = onChange;
        this.onClose = onClose;
        this.onNext = onNext;
        this.partsLibrary = partsLibrary;
        this.document = documentRef;
        this.adapter = adapter;
        this.overlay = null;
        this.part = null;
        this.draft = null;
        this.opened = false;
        this.busy = false;
        this.activeSlotId = null;
        this.recipe = null;
        this.rendered = null;
        this.currentSound = null;
        this.composerOwnsSound = false;
        this.composerDirty = false;
        this.renderGeneration = 0;
        this.renderTimer = null;
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    open(partOrId, options = {}) {
        const part = typeof partOrId === 'string' ? this.partsLibrary?.[partOrId] : partOrId;
        if (!part?.id) throw new Error('part sound editor needs a valid part');
        if (!this.document) throw new Error('part sound editor needs a document');

        if (typeof options.onSave === 'function') this.onSave = options.onSave;
        if (typeof options.onChange === 'function') this.onChange = options.onChange;
        if (typeof options.onCancel === 'function') this.onCancel = options.onCancel;
        if (typeof options.onClose === 'function') this.onClose = options.onClose;
        if (typeof options.onNext === 'function') this.onNext = options.onNext;
        this.part = part;
        const initial = options.draft || createPartSoundDraft(part, this.signalForge);
        this.draft = serializePartSoundDraft(part, initial);
        this.activeSlotId = this.draft.slots[0]?.id || null;
        this.busy = false;
        this.recipe = null;
        this.rendered = null;
        this.currentSound = null;
        this.composerOwnsSound = false;
        this.composerDirty = false;
        this.opened = true;
        this.wasPaused = Boolean(this.game?.paused);
        this.game && (this.game.paused = true);
        this.game?.input?.resetActiveState?.();

        if (!this.overlay) this.build();
        this.overlay.classList.add('is-open');
        this.overlay.classList.toggle('has-no-slots', this.draft.slots.length === 0);
        this.overlay.setAttribute('aria-label', `${part.name || part.id} focused signal forge`);
        this.overlay.addEventListener('keydown', this.handleKeyDown);
        this.render();
        if (this.activeSlotId) this.prepareComposer();
        else this.setStatus('this part has no custom sound hooks. there is nothing fake to assign.');
        this.overlay.focus();
        return this;
    }

    close({ cancelled = false } = {}) {
        if (!this.opened) return;
        this.audio?.stopPreview?.();
        this.opened = false;
        this.overlay.classList.remove('is-open');
        this.overlay.removeEventListener('keydown', this.handleKeyDown);
        this.game && (this.game.paused = this.wasPaused);
        this.game?.input?.resetActiveState?.();
        if (cancelled) this.onCancel?.(this.part);
        this.onClose?.(this.part, { cancelled });
    }

    handleKeyDown(event) {
        event.stopPropagation();
        if (event.code === 'Escape') {
            event.preventDefault();
            this.close({ cancelled: true });
        } else if (event.code === 'Space' && !isFormControl(event.target)) {
            event.preventDefault();
            this.previewDraft();
        }
    }

    build() {
        const overlay = this.document.createElement('div');
        overlay.id = 'part-sound-editor';
        overlay.tabIndex = -1;
        overlay.innerHTML = `
            <section class="part-sound-dialog" role="dialog" aria-modal="true">
                <header class="part-sound-header">
                    <div class="part-sound-title"><strong></strong><small></small></div>
                    <button class="part-sound-close" type="button" aria-label="close">×</button>
                </header>
                <div class="part-sound-body">
                    <p class="part-sound-intro">${PART_SOUND_EDITOR_INTRO}</p>
                    <div class="part-sound-slots"></div>
                    <div class="part-sound-forge-layout">
                        <div class="part-sound-left-column">
                            <section class="part-sound-panel part-sound-composer">
                                <h3>sound composer</h3>
                                <div class="part-sound-fields"></div>
                                <div class="part-sound-actions"></div>
                                <div class="part-sound-editor-state"></div>
                                <canvas class="part-sound-wave" width="640" height="100"></canvas>
                                <div class="part-sound-meter"></div>
                            </section>
                            <details class="part-sound-panel part-sound-parameters">
                                <summary>advanced sound shaping</summary>
                                <div class="part-sound-params"></div>
                            </details>
                        </div>
                        <div class="part-sound-right-column">
                            <section class="part-sound-panel part-sound-saved">
                                <h3>saved sound library</h3>
                                <p class="part-sound-panel-help">shared choices live here. listen, use, or duplicate before editing.</p>
                                <div class="part-sound-library"></div>
                            </section>
                            <section class="part-sound-panel part-sound-assignment">
                                <h3>use a sound for this slot</h3>
                                <div class="part-sound-assignment-body"></div>
                            </section>
                        </div>
                    </div>
                </div>
                <footer class="part-sound-footer">
                    <span class="part-sound-status" role="status"></span>
                    <button type="button" data-action="cancel">cancel</button>
                    <button type="button" data-action="save-next">save part + next</button>
                    <button type="button" data-action="save">save part</button>
                </footer>
            </section>
        `;

        this.title = overlay.querySelector('.part-sound-title strong');
        this.subtitle = overlay.querySelector('.part-sound-title small');
        this.slotsElement = overlay.querySelector('.part-sound-slots');
        this.fields = overlay.querySelector('.part-sound-fields');
        this.actions = overlay.querySelector('.part-sound-actions');
        this.editorState = overlay.querySelector('.part-sound-editor-state');
        this.parameterGrid = overlay.querySelector('.part-sound-params');
        this.library = overlay.querySelector('.part-sound-library');
        this.assignmentBody = overlay.querySelector('.part-sound-assignment-body');
        this.waveCanvas = overlay.querySelector('.part-sound-wave');
        this.meter = overlay.querySelector('.part-sound-meter');
        this.status = overlay.querySelector('.part-sound-status');
        this.closeButton = overlay.querySelector('.part-sound-close');
        this.cancelButton = overlay.querySelector('[data-action="cancel"]');
        this.saveNextButton = overlay.querySelector('[data-action="save-next"]');
        this.saveButton = overlay.querySelector('[data-action="save"]');
        this.closeButton.onclick = () => this.close({ cancelled: true });
        this.cancelButton.onclick = () => this.close({ cancelled: true });
        this.saveButton.onclick = () => this.commit(false);
        this.saveNextButton.onclick = () => this.commit(true);

        this.nameInput = this.document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.maxLength = 64;
        this.nameInput.placeholder = 'sound name';
        this.nameInput.oninput = () => {
            this.composerDirty = true;
            this.updateComposerState(true);
        };
        this.presetSelect = this.document.createElement('select');
        this.fields.append(
            this.makeField('name', this.nameInput),
            this.makeField('starting preset', this.presetSelect)
        );
        this.actions.append(
            button(this.document, 'new from preset', () => this.newFromPreset()),
            button(this.document, 'mutate into new sound', () => this.mutate(), 'is-amber'),
            button(this.document, 'listen to draft [space]', () => this.previewDraft(), 'is-cyan'),
            button(this.document, 'stop listening', () => this.audio?.stopPreview?.(), 'is-muted'),
            button(this.document, 'save sound', () => this.saveGenerated(), 'is-pink')
        );

        for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'contextmenu', 'wheel']) {
            overlay.addEventListener(type, event => event.stopPropagation());
        }
        this.document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    makeField(labelText, control) {
        const label = this.document.createElement('label');
        label.className = 'part-sound-field';
        const text = this.document.createElement('span');
        text.textContent = labelText;
        label.append(text, control);
        return label;
    }

    async prepareComposer() {
        if (!this.opened) return;
        this.setStatus('loading jfxr...');
        try {
            const presets = await this.adapter.listPresets();
            this.presetSelect = this.presetSelect || this.document.createElement('select');
            this.presetSelect.replaceChildren(...presets.map(name => option(this.document, name)));
            this.presetSelect.value = presets.includes('laser/shoot') ? 'laser/shoot' : presets[0];
            this.recipe = await this.adapter.create(this.presetSelect.value);
            this.nameInput.value = `${this.part.id} ${this.activeSlotId || 'sound'}`.toLowerCase();
            await this.refreshRecipe(false);
            this.setStatus('ready. make a draft, save it, then assign it to this part slot.');
        } catch (error) {
            this.setStatus(`forge failed: ${error.message}`);
        }
    }

    render() {
        if (!this.draft || !this.overlay) return;
        this.title.textContent = `${this.part.name || this.part.id} // ${this.part.id}`;
        const count = this.draft.slots.length;
        this.subtitle.textContent = `focused signal forge // ${count} sound slot${count === 1 ? '' : 's'}`;
        this.renderSlotTabs();
        this.renderAssignment();
        this.renderSavedSounds();
        this.updateComposerState();
        this.updateButtons();
    }

    renderSlotTabs() {
        this.slotsElement.replaceChildren();
        for (const slot of this.draft.slots) {
            const tab = button(
                this.document,
                `${slot.label}${getAssignmentForSlot(this.draft, slot.id) ? ' // assigned' : ''}`,
                () => {
                    this.activeSlotId = slot.id;
                    this.render();
                },
                this.activeSlotId === slot.id ? 'is-selected' : ''
            );
            tab.setAttribute('aria-pressed', this.activeSlotId === slot.id ? 'true' : 'false');
            this.slotsElement.appendChild(tab);
        }
    }

    renderAssignment() {
        const slot = this.draft.slots.find(entry => entry.id === this.activeSlotId) || this.draft.slots[0];
        if (!slot) {
            this.assignmentBody.replaceChildren();
            const empty = this.document.createElement('div');
            empty.className = 'part-sound-empty';
            empty.textContent = 'this part does not make a part-specific sound in the game.';
            this.assignmentBody.appendChild(empty);
            return;
        }
        this.activeSlotId = slot.id;
        const definition = getPartLabSoundSlots(this.part).find(entry => entry.id === slot.id) || slot;
        const assignment = getAssignmentForSlot(this.draft, slot.id);
        const state = inspectPartSoundSlot(definition, assignment, {
            audio: this.audio,
            signalForge: this.signalForge
        });
        this.assignmentBody.replaceChildren();
        const copy = this.document.createElement('div');
        copy.className = `part-sound-assignment-state is-${state.status}`;
        const step = this.document.createElement('strong');
        step.textContent = '1. choose this slot';
        const detail = this.document.createElement('span');
        detail.textContent = `${slot.label}: ${state.label} // ${state.detail}`.toLowerCase();
        copy.append(step, detail);
        const actions = this.document.createElement('div');
        actions.className = 'part-sound-assignment-actions';
        actions.append(
            button(this.document, 'listen to slot', () => this.previewSlot(slot.id), 'is-cyan'),
            button(this.document, 'use built-in default', () => this.assignSlot(slot.id, null), 'is-danger')
        );
        if (this.currentSound) {
            actions.appendChild(button(
                this.document,
                `3. use ${this.currentSound.name} for slot`,
                () => this.assignSlot(slot.id, { source: 'signal-forge', soundId: this.currentSound.id }),
                'is-pink'
            ));
        }
        const steps = this.document.createElement('div');
        steps.className = 'part-sound-assignment-steps';
        const choose = this.document.createElement('div');
        choose.textContent = '2. listen or choose/create a sound in the library';
        steps.append(choose, copy);
        this.assignmentBody.append(steps, actions);
    }

    renderSavedSounds() {
        this.library.replaceChildren();
        const sounds = [...(this.signalForge?.sounds?.values?.() || [])]
            .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        if (sounds.length === 0) {
            const empty = this.document.createElement('div');
            empty.className = 'part-sound-empty';
            empty.textContent = 'no saved sounds yet.';
            this.library.appendChild(empty);
            return;
        }
        for (const sound of sounds) {
            const row = this.document.createElement('div');
            row.className = `part-sound-library-row${sound.id === this.currentSound?.id ? ' is-current' : ''}`;
            const copy = this.document.createElement('div');
            const name = this.document.createElement('strong');
            name.textContent = sound.name || sound.id;
            const detail = this.document.createElement('small');
            detail.textContent = `${Number(sound.duration || 0).toFixed(3)}s`;
            copy.append(name, detail);
            const actions = this.document.createElement('div');
            const listen = button(this.document, 'listen', () => this.previewSaved(sound.id), 'is-cyan');
            const use = button(this.document, 'use for slot', () => this.assignSlot(this.activeSlotId, { source: 'signal-forge', soundId: sound.id }), 'is-pink');
            const duplicate = button(this.document, 'duplicate + edit', () => this.duplicateSaved(sound.id), 'is-amber');
            use.disabled = !this.activeSlotId;
            use.title = this.activeSlotId ? 'use this sound for the chosen slot' : 'choose a slot first';
            actions.append(listen, use, duplicate);
            row.append(copy, actions);
            this.library.appendChild(row);
        }
    }

    async duplicateSaved(soundId) {
        const sound = this.signalForge?.sounds?.get?.(soundId);
        if (!sound) return;
        if (typeof this.signalForge?.duplicateSound !== 'function') {
            this.setStatus('duplicate is unavailable in this Signal Forge runtime.');
            return null;
        }
        try {
            const copy = await this.signalForge.duplicateSound(soundId);
            await this.loadOwnedSound(copy, 'duplicated');
            return copy;
        } catch (error) {
            this.setStatus(`duplicate failed: ${error.message}`);
            return null;
        }
    }

    async loadOwnedSound(sound, action = 'loaded') {
        this.currentSound = sound;
        this.composerOwnsSound = true;
        this.composerDirty = false;
        this.recipe = structuredClone(sound.recipe);
        this.nameInput.value = sound.name;
        await this.refreshRecipe(false);
        this.render();
        this.setStatus(`${action} ${sound.name}. save sound changes this copy only.`);
    }

    assignSlot(slotId, assignment) {
        if (!slotId) return;
        this.draft = withPartSoundAssignment(this.draft, slotId, assignment);
        this.onChange?.(cloneDraft(this.draft), { part: this.part, slotId });
        this.render();
        this.setStatus(`${slotId}: assignment staged. save part commits it; save all promotes it.`);
    }

    previewSlot(slotId) {
        const slot = this.draft?.slots?.find(entry => entry.id === slotId);
        const definition = getPartLabSoundSlots(this.part).find(entry => entry.id === slotId);
        if (!slot || !definition) return false;
        const assignment = getAssignmentForSlot(this.draft, slotId);
        const state = inspectPartSoundSlot(definition, assignment, {
            audio: this.audio,
            signalForge: this.signalForge
        });
        if (!state.soundName) {
            this.setStatus(`${slotId}: no playable sound is available.`);
            return false;
        }
        this.audio?.stopPreview?.();
        const voice = state.source === 'signal-forge'
            ? this.signalForge?.previewSaved?.(assignment.soundId)
            : this.audio?.previewSound?.(state.soundName);
        if (!voice) {
            this.setStatus(`${slotId}: preview failed.`);
            return false;
        }
        this.setStatus(`previewing ${slotId}: ${state.label}.`);
        return true;
    }

    previewSaved(soundId) {
        const sound = this.signalForge?.sounds?.get?.(soundId);
        if (!sound || !this.signalForge.previewSaved(soundId)) return false;
        this.setStatus(`previewing saved sound: ${sound.name}.`);
        return true;
    }

    renderParameters(parameters) {
        this.parameterGrid.replaceChildren();
        const usable = parameters.filter(item => CONTROL_KEYS.has(item.key));
        for (const group of PARAMETER_GROUPS) {
            const entries = usable.filter(param => group.keys.has(param.key));
            if (!entries.length) continue;
            const section = this.document.createElement('details');
            section.className = 'part-sound-param-group';
            const summary = this.document.createElement('summary');
            summary.textContent = group.label;
            section.appendChild(summary);
            for (const param of entries) section.appendChild(this.makeParameterRow(param));
            this.parameterGrid.appendChild(section);
        }
        const grouped = new Set(PARAMETER_GROUPS.flatMap(group => [...group.keys]));
        const ungrouped = usable.filter(param => !grouped.has(param.key));
        if (ungrouped.length) {
            const section = this.document.createElement('details');
            section.className = 'part-sound-param-group';
            const summary = this.document.createElement('summary');
            summary.textContent = 'other controls';
            section.appendChild(summary);
            for (const param of ungrouped) section.appendChild(this.makeParameterRow(param));
            this.parameterGrid.appendChild(section);
        }
    }

    makeParameterRow(param) {
        const row = this.document.createElement('div');
        row.className = 'part-sound-param';
        const label = this.document.createElement('label');
        const name = this.document.createElement('span');
        const value = this.document.createElement('span');
        name.textContent = param.label;
        value.textContent = `${param.value}${param.unit || ''}`;
        label.append(name, value);
        let input;
        if (param.type === 'boolean') {
            input = this.document.createElement('input');
            input.type = 'checkbox';
            input.checked = param.value;
        } else if (param.type === 'enum') {
            input = this.document.createElement('select');
            for (const [entryValue, entryLabel] of Object.entries(param.values || {})) {
                input.appendChild(option(this.document, entryValue, String(entryLabel).toLowerCase()));
            }
            input.value = param.value;
        } else {
            input = this.document.createElement('input');
            input.type = 'range';
            input.min = param.min;
            input.max = param.max;
            input.step = param.step === 'any' ? 'any' : param.step;
            input.value = param.value;
        }
        input.oninput = () => {
            const next = param.type === 'boolean'
                ? input.checked
                : (param.type === 'enum' ? input.value : Number(input.value));
            this.recipe = { ...this.recipe, [param.key]: next };
            this.composerDirty = true;
            value.textContent = `${next}${param.unit || ''}`;
            this.updateComposerState(true);
            this.scheduleRender();
        };
        row.append(label, input);
        return row;
    }

    async refreshRecipe(autoPreview = false) {
        if (!this.recipe) return;
        this.renderParameters(await this.adapter.describe(this.recipe));
        await this.renderSound();
        if (autoPreview) this.previewDraft();
    }

    scheduleRender() {
        const generation = ++this.renderGeneration;
        clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(async () => {
            if (generation !== this.renderGeneration || !this.opened) return;
            await this.renderSound();
        }, 80);
    }

    async renderSound() {
        if (!this.recipe) return;
        const generation = ++this.renderGeneration;
        this.setStatus('synthesizing...');
        try {
            const rendered = await this.adapter.render(this.recipe);
            if (generation !== this.renderGeneration || !this.opened) return;
            if (rendered.duration > 5) throw new Error('sound is longer than 5 seconds');
            this.rendered = rendered;
            this.drawWaveform(rendered.samples);
            const clipping = rendered.peak > 1 ? ' // clipping' : '';
            this.meter.textContent = `${rendered.duration.toFixed(3)}s // ${rendered.sampleRate}hz // peak ${rendered.peak.toFixed(3)}${clipping}`;
            this.meter.classList.toggle('is-clipping', rendered.peak > 1);
            this.setStatus('draft rendered.');
            this.updateComposerState();
        } catch (error) {
            this.setStatus(`render failed: ${error.message}`);
        }
    }

    drawWaveform(samples) {
        const ctx = this.waveCanvas.getContext('2d');
        const { width, height } = this.waveCanvas;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#010405';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#123b40';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.strokeStyle = '#4dffb8';
        ctx.beginPath();
        const stride = Math.max(1, Math.floor(samples.length / width));
        for (let x = 0; x < width; x++) {
            let min = 1;
            let max = -1;
            const start = x * stride;
            for (let index = start; index < Math.min(samples.length, start + stride); index++) {
                min = Math.min(min, samples[index]);
                max = Math.max(max, samples[index]);
            }
            ctx.moveTo(x, (1 - max) * height / 2);
            ctx.lineTo(x, (1 - min) * height / 2);
        }
        ctx.stroke();
    }

    previewDraft() {
        if (!this.rendered || !this.signalForge) return false;
        const buffer = this.signalForge.createAudioBuffer(this.rendered);
        this.audio?.preview?.(buffer);
        this.setStatus(`previewing draft: ${this.nameInput.value || 'untitled'}.`);
        return true;
    }

    async saveGenerated({ forceNew = false, reason = 'saved' } = {}) {
        if (!this.rendered || !this.signalForge) return null;
        const name = this.nameInput.value.trim();
        if (!name) {
            this.setStatus('give the generated sound a name first.');
            this.nameInput.focus();
            return null;
        }
        try {
            const canUpdateOwned = !forceNew && this.composerOwnsSound && this.currentSound?.id;
            this.currentSound = canUpdateOwned && typeof this.signalForge.updateRendered === 'function'
                ? await this.signalForge.updateRendered({
                    id: this.currentSound.id,
                    name,
                    recipe: this.recipe,
                    rendered: this.rendered
                })
                : await this.signalForge.saveRendered({
                    name,
                    recipe: this.recipe,
                    rendered: this.rendered
                });
            this.composerOwnsSound = true;
            this.composerDirty = false;
            this.render();
            this.setStatus(`${reason}: ${this.currentSound.name} is now in the saved sound library. use for slot when ready.`);
            return this.currentSound;
        } catch (error) {
            this.setStatus(`save generated sound failed: ${error.message}`);
            return null;
        }
    }

    async newFromPreset() {
        try {
            this.recipe = await this.adapter.create(this.presetSelect.value);
            this.nameInput.value = `${this.part.id} ${this.activeSlotId || 'sound'} preset`.toLowerCase();
            this.currentSound = null;
            this.composerOwnsSound = false;
            this.composerDirty = true;
            await this.refreshRecipe(false);
            await this.saveGenerated({ forceNew: true, reason: 'new preset saved' });
        } catch (error) {
            this.setStatus(`preset failed: ${error.message}`);
        }
    }

    async mutate() {
        if (!this.recipe) return;
        try {
            this.recipe = await this.adapter.mutate(this.recipe);
            this.nameInput.value = `${this.currentSound?.name || this.part.id} variant`.toLowerCase();
            this.currentSound = null;
            this.composerOwnsSound = false;
            this.composerDirty = true;
            await this.refreshRecipe(false);
            await this.saveGenerated({ forceNew: true, reason: 'mutated sound saved' });
        } catch (error) {
            this.setStatus(`mutate failed: ${error.message}`);
        }
    }

    updateComposerState(dirty = this.composerDirty) {
        if (!this.editorState || !this.nameInput) return;
        this.editorState.textContent = this.currentSound
            ? `${this.composerOwnsSound ? 'composer copy' : 'shared library sound'}: ${this.currentSound.name}${dirty ? ' // unsaved changes' : ''} // save sound updates only this copy`
            : `new unsaved draft${dirty ? ' // changed' : ''} // save sound creates a library entry`;
    }

    setStatus(message) {
        if (this.status) this.status.textContent = String(message).toLowerCase();
    }

    updateButtons() {
        const hasSlots = Boolean(this.draft?.slots?.length);
        for (const element of [this.cancelButton, this.saveButton, this.saveNextButton]) {
            if (element) element.disabled = this.busy || (element !== this.cancelButton && !hasSlots);
        }
    }

    async commit(advance) {
        if (this.busy || !this.draft) return;
        this.busy = true;
        this.updateButtons();
        const draft = cloneDraft(this.draft);
        try {
            await this.onSave?.(draft, {
                action: advance ? 'save-next' : 'save',
                part: this.part
            });
            if (advance && this.onNext) {
                const next = await this.onNext(draft, { part: this.part });
                this.close();
                if (next?.part) this.open(next.part, { draft: next.draft });
                return;
            }
            this.close();
        } catch (error) {
            this.setStatus(`save failed: ${error.message}`);
            this.busy = false;
            this.updateButtons();
        }
    }
}
