import {
    createPartSoundDraft,
    getAssignmentForSlot,
    getPartLabSoundSlots,
    inspectPartSoundSlot,
    listPartSoundChoices,
    parseSoundChoiceKey,
    serializePartSoundDraft,
    soundChoiceKey,
    withPartSoundAssignment
} from './PartSoundBindings.js';

export const PART_SOUND_EDITOR_INTRO = 'choose two sounds, preview them, and test the staged choices immediately. only save all promotes source changes.';

function appendOption(documentRef, select, value, label, { disabled = false } = {}) {
    const entry = documentRef.createElement('option');
    entry.value = value;
    entry.textContent = label;
    entry.disabled = disabled;
    select.appendChild(entry);
    return entry;
}

function appendChoiceGroup(documentRef, select, label, choices) {
    if (choices.length === 0) return;
    const group = documentRef.createElement('optgroup');
    group.label = label;
    for (const choice of choices) {
        const availability = choice.available ? '' : ' // missing';
        appendOption(documentRef, group, choice.choiceKey, `${choice.label}${availability}`, {
            disabled: !choice.available
        });
    }
    select.appendChild(group);
}

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

/**
 * Minimal, desktop-dev-only editor for the two semantic sounds attached to a
 * single part. The editor stages data and reports it through onSave; it never
 * calls SignalForgeRuntime.bind/unbind and never writes source files.
 */
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
        documentRef = globalThis.document
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
        this.overlay = null;
        this.part = null;
        this.draft = null;
        this.opened = false;
        this.wasPaused = false;
        this.busy = false;
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * @param {string|object} partOrId
     * @param {{ draft?: object, onSave?: Function, onChange?: Function, onCancel?: Function, onClose?: Function, onNext?: Function }} options
     */
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
        this.busy = false;
        this.wasPaused = Boolean(this.game?.paused);
        this.game && (this.game.paused = true);
        this.game?.input?.resetActiveState?.();

        if (!this.overlay) this.build();
        this.opened = true;
        this.overlay.classList.add('is-open');
        this.overlay.setAttribute('aria-label', `${part.name || part.id} sound editor`);
        this.overlay.addEventListener('keydown', this.handleKeyDown);
        this.render();
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
            const firstSlot = this.draft?.slots?.[0];
            if (firstSlot) this.previewSlot(firstSlot.id);
        }
    }

    build() {
        const overlay = this.document.createElement('div');
        overlay.id = 'part-sound-editor';
        overlay.tabIndex = -1;
        overlay.innerHTML = `
            <section class="part-sound-dialog" role="dialog" aria-modal="true">
                <header class="part-sound-header">
                    <div class="part-sound-title">
                        <strong></strong>
                        <small>part sound lab</small>
                    </div>
                    <button class="part-sound-close" type="button" aria-label="close">×</button>
                </header>
                <div class="part-sound-body">
                    <p class="part-sound-intro">${PART_SOUND_EDITOR_INTRO}</p>
                    <div class="part-sound-slots"></div>
                </div>
                <footer class="part-sound-footer">
                    <span class="part-sound-status" role="status"></span>
                    <button type="button" data-action="cancel">cancel</button>
                    <button type="button" data-action="save-next">save + next</button>
                    <button type="button" data-action="save">save</button>
                </footer>
            </section>
        `;

        this.title = overlay.querySelector('.part-sound-title strong');
        this.slotsElement = overlay.querySelector('.part-sound-slots');
        this.status = overlay.querySelector('.part-sound-status');
        this.closeButton = overlay.querySelector('.part-sound-close');
        this.cancelButton = overlay.querySelector('[data-action="cancel"]');
        this.saveNextButton = overlay.querySelector('[data-action="save-next"]');
        this.saveButton = overlay.querySelector('[data-action="save"]');
        this.closeButton.onclick = () => this.close({ cancelled: true });
        this.cancelButton.onclick = () => this.close({ cancelled: true });
        this.saveButton.onclick = () => this.commit(false);
        this.saveNextButton.onclick = () => this.commit(true);

        for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'contextmenu', 'wheel']) {
            overlay.addEventListener(type, event => event.stopPropagation());
        }
        this.document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    render() {
        if (!this.draft || !this.overlay) return;
        this.title.textContent = this.part.name || this.part.id;
        this.slotsElement.replaceChildren();
        const choices = listPartSoundChoices({ audio: this.audio, signalForge: this.signalForge });
        for (const slot of this.draft.slots) {
            this.slotsElement.appendChild(this.renderSlot(slot, choices));
        }
        this.setStatus('staged changes are local to this lab.');
        this.updateButtons();
    }

    renderSlot(slot, choices) {
        const assignment = getAssignmentForSlot(this.draft, slot.id);
        const definition = getPartLabSoundSlots(this.part).find(entry => entry.id === slot.id) || slot;
        const state = inspectPartSoundSlot(definition, assignment, {
            audio: this.audio,
            signalForge: this.signalForge
        });
        const card = this.document.createElement('article');
        card.className = 'part-sound-slot';

        const head = this.document.createElement('div');
        head.className = 'part-sound-slot-head';
        const label = this.document.createElement('strong');
        label.textContent = slot.label;
        head.appendChild(label);
        if (slot.optional) {
            const optional = this.document.createElement('span');
            optional.className = 'part-sound-optional';
            optional.textContent = 'optional';
            head.appendChild(optional);
        }
        card.appendChild(head);

        const stateRow = this.document.createElement('div');
        stateRow.className = `part-sound-state is-${state.status}`;
        const badge = this.document.createElement('strong');
        badge.textContent = state.status;
        const stateCopy = this.document.createElement('span');
        stateCopy.textContent = `${state.label} // ${state.detail}`;
        stateRow.append(badge, stateCopy);
        card.appendChild(stateRow);

        const select = this.document.createElement('select');
        select.setAttribute('aria-label', `${slot.label} sound`);
        appendOption(this.document, select, '', `use default // ${slot.fallback}`);
        appendChoiceGroup(
            this.document,
            select,
            'public runtime sounds',
            choices.filter(choice => choice.source === 'runtime')
        );
        appendChoiceGroup(
            this.document,
            select,
            'saved Signal Forge sounds',
            choices.filter(choice => choice.source === 'signal-forge')
        );

        const currentKey = assignment ? soundChoiceKey(assignment) : '';
        if (currentKey && !choices.some(choice => choice.choiceKey === currentKey)) {
            appendOption(this.document, select, currentKey, `${state.label} // missing`, { disabled: true });
        }
        select.value = currentKey;
        select.onchange = () => {
            const nextAssignment = parseSoundChoiceKey(select.value);
            this.draft = withPartSoundAssignment(this.draft, slot.id, nextAssignment);
            this.onChange?.(cloneDraft(this.draft), { part: this.part, slotId: slot.id });
            this.render();
            this.previewSlot(slot.id);
        };
        card.appendChild(select);

        const actions = this.document.createElement('div');
        actions.className = 'part-sound-slot-actions';
        const preview = this.document.createElement('button');
        preview.type = 'button';
        preview.textContent = 'preview';
        preview.onclick = () => this.previewSlot(slot.id);
        const clear = this.document.createElement('button');
        clear.type = 'button';
        clear.textContent = 'clear assignment';
        clear.onclick = () => {
            this.draft = withPartSoundAssignment(this.draft, slot.id, null);
            this.onChange?.(cloneDraft(this.draft), { part: this.part, slotId: slot.id });
            this.render();
        };
        actions.append(preview, clear);
        card.appendChild(actions);
        return card;
    }

    previewSlot(slotId) {
        const draftSlot = this.draft?.slots?.find(slot => slot.id === slotId);
        const definition = getPartLabSoundSlots(this.part).find(slot => slot.id === slotId);
        if (!draftSlot || !definition) return false;
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
        let voice = null;
        if (state.source === 'signal-forge') {
            voice = this.signalForge?.previewSaved?.(assignment.soundId);
        } else {
            voice = this.audio?.previewSound?.(state.soundName);
        }
        if (!voice) {
            this.setStatus(`${slotId}: preview failed.`);
            return false;
        }
        this.setStatus(`previewing ${slotId}: ${state.label}.`);
        return true;
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

    setStatus(message) {
        if (this.status) this.status.textContent = String(message).toLowerCase();
    }

    updateButtons() {
        for (const button of [this.cancelButton, this.saveButton, this.saveNextButton]) {
            if (button) button.disabled = this.busy;
        }
    }
}
