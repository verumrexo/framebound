import { PartsLibrary } from '../../shared/parts/Part.js';
import { JfxrAdapter } from '../audio/JfxrAdapter.js';
import {
    SOUND_EVENTS,
    getPartSoundSlots,
    getSoundEvent,
    globalSoundEventKey,
    partSoundEventKey
} from '../audio/SoundEventRegistry.js';

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

function forgeButton(label, tone = 'mint') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = `signal-forge-button is-${tone}`;
    return button;
}

function makePanel(title, className = '') {
    const panel = document.createElement('section');
    panel.className = `signal-forge-panel ${className}`.trim();
    const heading = document.createElement('h2');
    heading.textContent = title;
    panel.appendChild(heading);
    return panel;
}

function makeField(labelText, control) {
    const label = document.createElement('label');
    label.className = 'signal-forge-field';
    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(text, control);
    return label;
}

function option(value, label = value) {
    const entry = document.createElement('option');
    entry.value = value;
    entry.textContent = label;
    return entry;
}

function isTextControl(target) {
    return target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement;
}

export class SignalForgeWindow {
    constructor(game, { adapter = new JfxrAdapter() } = {}) {
        this.game = game;
        this.adapter = adapter;
        this.recipe = null;
        this.rendered = null;
        this.currentSound = null;
        this.renderGeneration = 0;
        this.opened = false;
        this.wasPaused = false;
        this.overlay = null;
        this.selectedTargetKey = null;
        this.targetQuery = '';
        this.targetCategory = 'all';
        this.targetStatus = 'all';
        this.targets = [];
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    async open() {
        if (this.opened) return;
        this.opened = true;
        this.wasPaused = Boolean(this.game.paused);
        this.game.paused = true;
        this.game.input?.resetActiveState?.();
        if (!this.overlay) this.build();
        this.overlay.style.display = 'grid';
        this.overlay.addEventListener('keydown', this.handleKeyDown);
        this.overlay.focus();
        this.setStatus('loading jfxr...');

        try {
            const presets = await this.adapter.listPresets();
            this.presetSelect.replaceChildren(...presets.map(name => option(name)));
            this.presetSelect.value = 'laser/shoot';
            this.recipe = await this.adapter.create(this.presetSelect.value);
            this.nameInput.value = 'laser shoot';
            await this.refreshRecipe(false);
            this.targets = this.buildTargets();
            this.populateCategoryFilter();
            this.renderAll();
            this.updateComposerState();
            this.setStatus('ready. preview anything. missing sounds are marked in red.');
        } catch (error) {
            console.error('[Signal Forge] Failed to open:', error);
            this.setStatus(`failed: ${error.message}`);
        }
    }

    close() {
        if (!this.opened) return;
        this.opened = false;
        this.game.audio.stopPreview();
        this.overlay.style.display = 'none';
        this.overlay.removeEventListener('keydown', this.handleKeyDown);
        this.game.paused = this.wasPaused;
        this.game.input?.resetActiveState?.();
    }

    handleKeyDown(event) {
        event.stopPropagation();
        if (event.code === 'Escape') {
            event.preventDefault();
            this.close();
        } else if (event.code === 'Space' && !isTextControl(event.target)) {
            event.preventDefault();
            this.previewDraft();
        }
    }

    build() {
        const overlay = document.createElement('div');
        overlay.id = 'signal-forge';
        overlay.tabIndex = -1;
        overlay.innerHTML = `
            <header class="signal-forge-top">
                <div>
                    <div class="signal-forge-title">signal forge // jfxr</div>
                    <div class="signal-forge-subtitle">sound coverage and synthesis terminal</div>
                </div>
                <div class="signal-forge-coverage"></div>
                <div class="signal-forge-status"></div>
            </header>
            <main class="signal-forge-layout"></main>
        `;

        const layout = overlay.querySelector('.signal-forge-layout');
        const editor = document.createElement('div');
        const catalog = document.createElement('div');
        editor.className = 'signal-forge-column is-editor';
        catalog.className = 'signal-forge-column is-catalog';
        layout.append(editor, catalog);

        const generator = makePanel('sound editor', 'signal-forge-generator');
        const fields = document.createElement('div');
        fields.className = 'signal-forge-fields';
        this.nameInput = document.createElement('input');
        this.nameInput.placeholder = 'sound name';
        this.nameInput.maxLength = 64;
        this.presetSelect = document.createElement('select');
        fields.append(
            makeField('name', this.nameInput),
            makeField('starting preset', this.presetSelect)
        );
        generator.appendChild(fields);

        const controls = document.createElement('div');
        controls.className = 'signal-forge-actions';
        const generate = forgeButton('new from preset');
        const mutate = forgeButton('mutate', 'amber');
        const preview = forgeButton('preview draft [space]', 'cyan');
        const stop = forgeButton('stop audio', 'muted');
        this.saveButton = forgeButton('save new sound', 'pink');
        const handoff = forgeButton('handoff to codex', 'amber');
        const close = forgeButton('close [esc]', 'red');
        controls.append(generate, mutate, preview, stop, this.saveButton, handoff, close);
        generator.appendChild(controls);

        this.editorState = document.createElement('div');
        this.editorState.className = 'signal-forge-editor-state';
        generator.appendChild(this.editorState);
        this.waveCanvas = document.createElement('canvas');
        this.waveCanvas.width = 800;
        this.waveCanvas.height = 120;
        this.waveCanvas.className = 'signal-forge-wave';
        generator.appendChild(this.waveCanvas);
        this.meter = document.createElement('div');
        this.meter.className = 'signal-forge-meter';
        generator.appendChild(this.meter);
        editor.appendChild(generator);

        const parameters = makePanel('parameters', 'signal-forge-parameters-panel');
        this.parameterGrid = document.createElement('div');
        this.parameterGrid.className = 'signal-forge-params';
        parameters.appendChild(this.parameterGrid);
        editor.appendChild(parameters);

        const targets = makePanel('sound map', 'signal-forge-target-panel');
        const filters = document.createElement('div');
        filters.className = 'signal-forge-filters';
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'search';
        this.searchInput.placeholder = 'search parts and events';
        this.categorySelect = document.createElement('select');
        this.statusSelect = document.createElement('select');
        this.statusSelect.append(
            option('all', 'all sound states'),
            option('missing', 'missing only'),
            option('default', 'default only'),
            option('custom', 'custom only')
        );
        filters.append(this.searchInput, this.categorySelect, this.statusSelect);
        targets.appendChild(filters);

        this.selectionBar = document.createElement('div');
        this.selectionBar.className = 'signal-forge-selection';
        targets.appendChild(this.selectionBar);
        this.targetGrid = document.createElement('div');
        this.targetGrid.className = 'signal-forge-targets';
        targets.appendChild(this.targetGrid);
        catalog.appendChild(targets);

        const lower = document.createElement('div');
        lower.className = 'signal-forge-lower';
        const library = makePanel('saved sounds', 'signal-forge-library-panel');
        this.soundLibrary = document.createElement('div');
        this.soundLibrary.className = 'signal-forge-list';
        library.appendChild(this.soundLibrary);
        const bindings = makePanel('active overrides', 'signal-forge-bindings-panel');
        this.bindingList = document.createElement('div');
        this.bindingList.className = 'signal-forge-list';
        bindings.appendChild(this.bindingList);
        lower.append(library, bindings);
        catalog.appendChild(lower);

        this.status = overlay.querySelector('.signal-forge-status');
        this.coverage = overlay.querySelector('.signal-forge-coverage');
        generate.onclick = async () => {
            this.recipe = await this.adapter.create(this.presetSelect.value);
            this.nameInput.value = this.presetSelect.value.replace('/', ' ');
            this.currentSound = null;
            await this.refreshRecipe(true);
            this.updateComposerState();
        };
        mutate.onclick = async () => {
            this.recipe = await this.adapter.mutate(this.recipe);
            await this.refreshRecipe(true);
            this.updateComposerState(true);
        };
        preview.onclick = () => this.previewDraft();
        stop.onclick = () => this.game.audio.stopPreview();
        this.saveButton.onclick = () => this.save();
        handoff.onclick = () => this.handoff();
        close.onclick = () => this.close();
        this.nameInput.oninput = () => this.updateComposerState(true);
        this.searchInput.oninput = () => {
            this.targetQuery = this.searchInput.value.trim().toLowerCase();
            this.renderTargets();
        };
        this.categorySelect.onchange = () => {
            this.targetCategory = this.categorySelect.value;
            this.renderTargets();
        };
        this.statusSelect.onchange = () => {
            this.targetStatus = this.statusSelect.value;
            this.renderTargets();
        };

        ['pointerdown', 'mousedown', 'mouseup', 'click', 'contextmenu', 'wheel'].forEach(type => {
            overlay.addEventListener(type, event => event.stopPropagation());
        });
        document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    async handoff() {
        try {
            const synced = await this.game.signalForge.mirrorNative();
            if (!synced) throw new Error('open this from the desktop app');
            this.setStatus("pack saved. tell codex: 'sounds are ready'.");
        } catch (error) {
            this.setStatus(`handoff failed: ${error.message}`);
        }
    }

    buildTargets() {
        const soundParts = Object.values(PartsLibrary)
            .filter(part => getPartSoundSlots(part).length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
        const parts = soundParts.flatMap(part => getPartSoundSlots(part).map(slot => {
            const fallbackName = slot.fallback;
            const fallback = getSoundEvent(fallbackName);
            return {
                key: partSoundEventKey(part.id, slot.id),
                label: `${part.name.toLowerCase()} // ${slot.id}`,
                detail: `${part.stats.weaponGroup || part.type} part // ${slot.id}`,
                category: 'parts',
                fallbackName,
                fallbackLabel: fallback?.label || fallbackName.replaceAll('_', ' '),
                part
            };
        }));
        const events = SOUND_EVENTS.map(soundEvent => ({
            key: globalSoundEventKey(soundEvent.id),
            label: soundEvent.label,
            detail: `${soundEvent.category} // global event`,
            category: soundEvent.category,
            fallbackName: soundEvent.id,
            fallbackLabel: soundEvent.label,
            part: null
        }));
        return [...parts, ...events];
    }

    populateCategoryFilter() {
        const categories = [...new Set(this.targets.map(target => target.category))].sort();
        this.categorySelect.replaceChildren(
            option('all', 'all categories'),
            ...categories.map(category => option(category, category))
        );
        this.categorySelect.value = this.targetCategory;
    }

    inspectTarget(target) {
        return this.game.signalForge.inspectEvent(target.key, target.fallbackName);
    }

    renderAll() {
        this.renderTargets();
        this.renderBindings();
        this.renderLibrary();
    }

    renderCoverage() {
        const counts = { custom: 0, default: 0, missing: 0 };
        for (const target of this.targets) counts[this.inspectTarget(target).status] += 1;
        this.coverage.innerHTML = `
            <span class="is-custom">${counts.custom} custom</span>
            <span class="is-default">${counts.default} default</span>
            <span class="is-missing">${counts.missing} missing</span>
        `;
    }

    renderTargets() {
        this.renderCoverage();
        this.renderSelection();
        this.targetGrid.replaceChildren();
        const filtered = this.targets.filter(target => {
            const state = this.inspectTarget(target);
            const matchesCategory = this.targetCategory === 'all' || target.category === this.targetCategory;
            const matchesStatus = this.targetStatus === 'all' || state.status === this.targetStatus;
            const haystack = `${target.label} ${target.detail} ${target.fallbackLabel} ${target.key}`.toLowerCase();
            return matchesCategory && matchesStatus && (!this.targetQuery || haystack.includes(this.targetQuery));
        });

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'signal-forge-empty';
            empty.textContent = 'no targets match these filters.';
            this.targetGrid.appendChild(empty);
            return;
        }

        for (const target of filtered) {
            const state = this.inspectTarget(target);
            const card = document.createElement('article');
            card.className = `signal-forge-target is-${state.status}`;
            if (!target.part) card.classList.add('is-global');
            if (target.key === this.selectedTargetKey) card.classList.add('is-selected');
            if (target.part) {
                const canvas = document.createElement('canvas');
                canvas.width = 48;
                canvas.height = 48;
                this.drawPart(canvas, target.part);
                card.appendChild(canvas);
            }
            const body = document.createElement('div');
            body.className = 'signal-forge-target-body';
            const header = document.createElement('div');
            header.className = 'signal-forge-target-header';
            const name = document.createElement('strong');
            name.textContent = target.label;
            const badge = document.createElement('span');
            badge.className = `signal-forge-badge is-${state.status}`;
            badge.textContent = state.status;
            header.append(name, badge);
            const detail = document.createElement('small');
            detail.textContent = target.detail;
            const source = document.createElement('small');
            source.className = 'signal-forge-source';
            source.textContent = state.status === 'missing'
                ? `expected: ${target.fallbackLabel} // no audio loaded`
                : `playing: ${state.label}`;
            const actions = document.createElement('div');
            actions.className = 'signal-forge-card-actions';
            const listen = forgeButton('listen', 'cyan');
            listen.disabled = state.status === 'missing';
            listen.onclick = event => {
                event.stopPropagation();
                this.previewTarget(target);
            };
            const select = forgeButton(target.key === this.selectedTargetKey ? 'selected' : 'select');
            select.onclick = event => {
                event.stopPropagation();
                this.selectTarget(target.key);
            };
            actions.append(listen, select);
            body.append(header, detail, source, actions);
            card.appendChild(body);
            card.onclick = () => this.selectTarget(target.key);
            this.targetGrid.appendChild(card);
        }
    }

    selectTarget(eventKey) {
        this.selectedTargetKey = eventKey;
        this.renderTargets();
    }

    selectedTarget() {
        return this.targets.find(target => target.key === this.selectedTargetKey) || null;
    }

    renderSelection() {
        this.selectionBar.replaceChildren();
        const target = this.selectedTarget();
        if (!target) {
            this.selectionBar.innerHTML = '<span>select a target to preview, apply, or restore its sound.</span>';
            return;
        }
        const state = this.inspectTarget(target);
        const summary = document.createElement('div');
        summary.className = 'signal-forge-selection-copy';
        const title = document.createElement('strong');
        title.textContent = target.label;
        const detail = document.createElement('span');
        detail.textContent = `${state.status} // ${state.label}`;
        summary.append(title, detail);
        const listen = forgeButton('preview current', 'cyan');
        listen.disabled = state.status === 'missing';
        listen.onclick = () => this.previewTarget(target);
        const apply = forgeButton(this.currentSound ? `apply ${this.currentSound.name}` : 'save + apply draft', 'pink');
        apply.disabled = !this.rendered;
        apply.onclick = () => this.bindTarget(target.key);
        const restore = forgeButton('restore default', 'red');
        restore.disabled = state.status !== 'custom';
        restore.onclick = () => this.restoreTarget(target.key);
        this.selectionBar.append(summary, listen, apply, restore);
    }

    previewTarget(target) {
        if (this.game.signalForge.previewEvent(target.key, target.fallbackName)) {
            const state = this.inspectTarget(target);
            this.setStatus(`previewing ${target.label}: ${state.label}.`);
        } else {
            this.setStatus(`${target.label} has no sound. select it and apply a draft.`);
        }
    }

    async restoreTarget(eventKey) {
        await this.game.signalForge.unbind(eventKey);
        this.renderAll();
        this.setStatus(`restored ${eventKey} to its packaged default.`);
    }

    async refreshRecipe(autoPreview = false) {
        this.renderParameters(await this.adapter.describe(this.recipe));
        await this.renderSound();
        if (autoPreview) this.previewDraft();
    }

    renderParameters(parameters) {
        this.parameterGrid.replaceChildren();
        for (const param of parameters.filter(item => CONTROL_KEYS.has(item.key))) {
            const row = document.createElement('div');
            row.className = 'signal-forge-param';
            const label = document.createElement('label');
            const name = document.createElement('span');
            const value = document.createElement('span');
            name.textContent = param.label;
            value.textContent = `${param.value}${param.unit || ''}`;
            label.append(name, value);
            row.appendChild(label);

            let input;
            if (param.type === 'boolean') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = param.value;
            } else if (param.type === 'enum') {
                input = document.createElement('select');
                for (const [optionValue, optionLabel] of Object.entries(param.values || {})) {
                    input.appendChild(option(optionValue, String(optionLabel).toLowerCase()));
                }
                input.value = param.value;
            } else {
                input = document.createElement('input');
                input.type = 'range';
                input.min = param.min;
                input.max = param.max;
                input.step = param.step === 'any' ? 'any' : param.step;
                input.value = param.value;
            }
            input.dataset.key = param.key;
            input.oninput = () => {
                const next = param.type === 'boolean'
                    ? input.checked
                    : (param.type === 'enum' ? input.value : Number(input.value));
                this.recipe = { ...this.recipe, [param.key]: next };
                value.textContent = `${next}${param.unit || ''}`;
                this.updateComposerState(true);
                this.scheduleRender();
            };
            row.appendChild(input);
            this.parameterGrid.appendChild(row);
        }
    }

    scheduleRender() {
        const generation = ++this.renderGeneration;
        clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(async () => {
            if (generation !== this.renderGeneration) return;
            await this.renderSound();
        }, 80);
    }

    async renderSound() {
        const generation = ++this.renderGeneration;
        this.setStatus('synthesizing...');
        try {
            const rendered = await this.adapter.render(this.recipe);
            if (generation !== this.renderGeneration) return;
            if (rendered.duration > 5) throw new Error('sound is longer than 5 seconds');
            this.rendered = rendered;
            this.drawWaveform(rendered.samples);
            const clipping = rendered.peak > 1 ? ' // clipping' : '';
            this.meter.textContent = `${rendered.duration.toFixed(3)}s // ${rendered.sampleRate}hz // peak ${rendered.peak.toFixed(3)}${clipping}`;
            this.meter.classList.toggle('is-clipping', rendered.peak > 1);
            this.setStatus('draft rendered.');
            this.renderSelection();
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

    drawPart(canvas, part) {
        const source = part.sprite?.ctx?.canvas;
        if (!source) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const scale = Math.min(42 / source.width, 42 / source.height);
        const width = Math.max(1, Math.round(source.width * scale));
        const height = Math.max(1, Math.round(source.height * scale));
        ctx.drawImage(source, Math.round((48 - width) / 2), Math.round((48 - height) / 2), width, height);
    }

    previewDraft() {
        if (!this.rendered) return false;
        const buffer = this.game.signalForge.createAudioBuffer(this.rendered);
        this.game.audio.preview(buffer);
        this.setStatus(`previewing editor draft: ${this.nameInput.value || 'untitled'}.`);
        return true;
    }

    updateComposerState(dirty = false) {
        const editing = this.currentSound;
        this.saveButton.textContent = editing ? 'save changes' : 'save new sound';
        this.editorState.textContent = editing
            ? `editing saved sound: ${editing.name}${dirty ? ' // unsaved changes' : ''}`
            : `new unsaved draft${dirty ? ' // changed' : ''}`;
        if (this.selectionBar) this.renderSelection();
    }

    async save() {
        if (!this.rendered) return null;
        const name = this.nameInput.value.trim();
        if (!name) {
            this.setStatus('give the sound a name first.');
            this.nameInput.focus();
            return null;
        }
        try {
            this.currentSound = await this.game.signalForge.saveRendered({
                name,
                recipe: this.recipe,
                rendered: this.rendered,
                id: this.currentSound?.id || null
            });
            this.setStatus(`saved ${this.currentSound.name}. select a target and apply it.`);
            this.updateComposerState(false);
            this.renderAll();
            return this.currentSound;
        } catch (error) {
            this.setStatus(`save failed: ${error.message}`);
            return null;
        }
    }

    async bindTarget(eventKey) {
        const sound = this.currentSound || await this.save();
        if (!sound) return;
        try {
            await this.game.signalForge.bind(eventKey, sound.id);
            this.setStatus(`applied ${sound.name} to ${eventKey}.`);
            this.renderAll();
        } catch (error) {
            this.setStatus(`apply failed: ${error.message}`);
        }
    }

    renderBindings() {
        this.bindingList.replaceChildren();
        const bindings = [...this.game.signalForge.bindings.entries()].sort(([a], [b]) => a.localeCompare(b));
        if (bindings.length === 0) {
            this.bindingList.appendChild(this.emptyMessage('no custom overrides. everything uses defaults or is missing.'));
            return;
        }
        for (const [eventKey, soundId] of bindings) {
            const target = this.targets.find(entry => entry.key === eventKey);
            const sound = this.game.signalForge.sounds.get(soundId);
            const row = document.createElement('div');
            row.className = 'signal-forge-list-row';
            const copy = document.createElement('div');
            copy.className = 'signal-forge-list-copy';
            const label = document.createElement('strong');
            label.textContent = target?.label || eventKey;
            const detail = document.createElement('small');
            detail.textContent = sound?.name || soundId;
            copy.append(label, detail);
            const listen = forgeButton('listen', 'cyan');
            listen.onclick = () => {
                if (target) this.previewTarget(target);
            };
            const remove = forgeButton('restore', 'red');
            remove.onclick = () => this.restoreTarget(eventKey);
            row.append(copy, listen, remove);
            this.bindingList.appendChild(row);
        }
    }

    renderLibrary() {
        this.soundLibrary.replaceChildren();
        const sounds = [...this.game.signalForge.sounds.values()]
            .sort((a, b) => a.name.localeCompare(b.name));
        if (sounds.length === 0) {
            this.soundLibrary.appendChild(this.emptyMessage('no saved sounds. make one in the editor.'));
            return;
        }
        for (const sound of sounds) {
            const row = document.createElement('div');
            row.className = 'signal-forge-list-row';
            if (sound.id === this.currentSound?.id) row.classList.add('is-current');
            const copy = document.createElement('div');
            copy.className = 'signal-forge-list-copy';
            const label = document.createElement('strong');
            label.textContent = sound.name;
            const detail = document.createElement('small');
            const usage = [...this.game.signalForge.bindings.values()].filter(id => id === sound.id).length;
            detail.textContent = `${sound.duration.toFixed(3)}s // used by ${usage} target${usage === 1 ? '' : 's'}`;
            copy.append(label, detail);
            const listen = forgeButton('preview', 'cyan');
            const load = forgeButton('edit');
            const apply = forgeButton('apply', 'pink');
            apply.disabled = !this.selectedTargetKey;
            const remove = forgeButton('delete', 'red');
            listen.onclick = () => {
                if (this.game.signalForge.previewSaved(sound.id)) {
                    this.setStatus(`previewing saved sound: ${sound.name}.`);
                }
            };
            load.onclick = () => this.loadSound(sound);
            apply.onclick = async () => {
                this.currentSound = sound;
                await this.bindTarget(this.selectedTargetKey);
                this.updateComposerState(false);
            };
            remove.onclick = async () => {
                await this.game.signalForge.deleteSound(sound.id);
                if (this.currentSound?.id === sound.id) {
                    this.currentSound = null;
                    this.updateComposerState(false);
                }
                this.renderAll();
                this.setStatus(`deleted ${sound.name}. affected targets restored to default.`);
            };
            row.append(copy, listen, load, apply, remove);
            this.soundLibrary.appendChild(row);
        }
    }

    async loadSound(sound) {
        this.currentSound = sound;
        this.recipe = structuredClone(sound.recipe);
        this.nameInput.value = sound.name;
        await this.refreshRecipe(false);
        this.updateComposerState(false);
        this.renderLibrary();
        this.setStatus(`loaded ${sound.name} into the editor.`);
    }

    emptyMessage(message) {
        const empty = document.createElement('div');
        empty.className = 'signal-forge-empty';
        empty.textContent = message;
        return empty;
    }

    setStatus(message) {
        if (this.status) this.status.textContent = String(message).toLowerCase();
    }
}
