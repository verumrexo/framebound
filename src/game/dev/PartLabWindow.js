import { PartsLibrary, PartType } from '../../shared/parts/Part.js';
import { partDefinitionToDesign } from '../systems/Designer.js';
import { PartSoundEditorWindow } from './PartSoundEditorWindow.js';
import { getPartLabSoundSlots } from './PartSoundBindings.js';
import {
    PartLabSimulationController,
    PART_LAB_REVIEW_STATUS
} from './PartLabSimulation.js';
import {
    applyPartLabSoundOverrides,
    applyVisualDesignOverride,
    buildPartLabManifest,
    serializePartLabManifest
} from './PartLabManifest.js';
import {
    getPartLabDraftState,
    PartLabDraftStore
} from './PartLabDraftStore.js';
import { PartLabNativeBridge, downloadPartLabManifest } from './PartLabNativeBridge.js';

const TYPE_LABELS = Object.freeze({
    [PartType.HULL]: 'hull',
    [PartType.WEAPON]: 'weapon',
    [PartType.THRUSTER]: 'thruster',
    [PartType.ACCELERANT]: 'accelerant',
    [PartType.ROCKET_BAY]: 'rocket bay',
    [PartType.BOOSTER]: 'booster',
    [PartType.DRONE]: 'drone',
    [PartType.UTILITY]: 'utility',
    [PartType.CORE]: 'core',
    [PartType.SHIELD]: 'shield'
});

export function getPartLabCatalogRows(partsLibrary = PartsLibrary, {
    query = '',
    type = 'all',
    store = null
} = {}) {
    const needle = String(query || '').trim().toLowerCase();
    return Object.entries(partsLibrary || {})
        .filter(([id, part]) => {
            const haystack = `${id} ${part.name || ''} ${part.description || ''} ${part.type || ''}`.toLowerCase();
            return (!needle || haystack.includes(needle)) && (type === 'all' || part.type === type);
        })
        .sort(([, a], [, b]) => String(a.name || '').localeCompare(String(b.name || '')))
        .map(([id, part]) => ({
            id,
            name: String(part.name || id).toLowerCase(),
            description: String(part.description || 'no description').toLowerCase(),
            type: part.type || 'unknown',
            typeLabel: TYPE_LABELS[part.type] || part.type || 'unknown',
            state: getPartLabDraftState(store?.get?.(id)),
            draft: store?.get?.(id) || null
        }));
}

function isEditableTarget(target) {
    const tag = String(target?.tagName || '').toLowerCase();
    return target?.isContentEditable || ['input', 'textarea', 'select', 'button'].includes(tag);
}

function button(documentRef, label, action, className = '') {
    const element = documentRef.createElement('button');
    element.type = 'button';
    element.className = `part-lab-button ${className}`.trim();
    element.textContent = label;
    element.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        action();
    });
    return element;
}

export class PartLabWindow {
    constructor(game, {
        documentRef = globalThis.document,
        partsLibrary = PartsLibrary,
        store = null,
        bridge = new PartLabNativeBridge()
    } = {}) {
        this.game = game;
        this.document = documentRef;
        this.partsLibrary = partsLibrary;
        this.bridge = bridge;
        this.store = store || new PartLabDraftStore({ partsLibrary });
        this.active = false;
        this.wasPaused = null;
        this.closing = false;
        this.statusMessage = '';
        this.baselineVisuals = {};
        this.partSoundEventKeys = new Set(
            Object.entries(partsLibrary).flatMap(([partId, part]) => getPartLabSoundSlots({ ...part, id: part.id || partId })
                .map(slot => `part:${part.id || partId}:${slot.eventSlot}`))
        );
        this.baselineBindings = new Map();
        this.baselineBindingsCaptured = false;
        this.stagedSoundEventKeys = new Set();
        for (const entry of Object.values(this.store.state.parts || {})) {
            for (const slot of entry.sound?.slots || []) {
                if (slot.eventKey) this.stagedSoundEventKeys.add(slot.eventKey);
            }
        }

        for (const [id, definition] of Object.entries(partsLibrary)) {
            try { this.baselineVisuals[id] = partDefinitionToDesign(id, definition); } catch { /* malformed content is validated elsewhere */ }
        }

        this.applyStoredVisualDrafts();

        this.soundEditor = new PartSoundEditorWindow(game, {
            signalForge: game?.signalForge,
            audio: game?.audio,
            partsLibrary,
            documentRef
        });
        this.simulation = new PartLabSimulationController({
            game,
            partsLibrary,
            documentRef,
            review: this.store.getReviews(),
            onReviewChange: (partId, review) => {
                if (review.status === PART_LAB_REVIEW_STATUS.UNTESTED) this.store.setNotes(partId, review.notes);
                else this.store.saveReview(partId, review.status, review.notes);
                this.renderCatalog();
            },
            onExit: () => { if (!this.closing) this.open(); }
        });
        if (game) {
            game.partLabSimulation = this.simulation;
            game.partLabWindow = this;
        }
        this.build();
        this.store.subscribe(() => this.renderCatalog());
        if (game?.loadingPromise) {
            const applyLoadedSoundState = () => {
                this.captureBaselineSoundBindings();
                this.applyStoredSoundDrafts();
            };
            game.loadingPromise.then(applyLoadedSoundState).catch(applyLoadedSoundState);
        } else {
            this.captureBaselineSoundBindings();
            this.applyStoredSoundDrafts();
        }
    }

    build() {
        if (!this.document?.body) return;
        this.overlay = this.document.createElement('div');
        this.overlay.id = 'part-lab-window';
        this.overlay.className = 'part-lab-overlay';
        this.overlay.tabIndex = -1;
        this.overlay.innerHTML = `
            <main class="part-lab-panel" role="dialog" aria-modal="true" aria-label="part lab">
                <header class="part-lab-header">
                    <div><div class="ui-kicker">development frame tools</div><h2>part lab</h2></div>
                    <div class="part-lab-header-copy">edit one part, test it, then promote everything together.</div>
                    <button class="part-lab-close" type="button" aria-label="close">×</button>
                </header>
                <div class="part-lab-toolbar">
                    <input class="part-lab-search" type="search" placeholder="search parts" aria-label="search parts">
                    <select class="part-lab-type" aria-label="filter by type"></select>
                    <button class="part-lab-button" data-action="untested" type="button">next untested</button>
                    <button class="part-lab-button" data-action="dirty" type="button">next dirty</button>
                    <span class="part-lab-count" role="status"></span>
                </div>
                <section class="part-lab-list" aria-live="polite"></section>
                <footer class="part-lab-footer">
                    <span class="part-lab-status" role="status"></span>
                    <button class="part-lab-button part-lab-reset" data-action="reset" type="button">reset drafts</button>
                    <button class="part-lab-button part-lab-save-all" data-action="save-all" type="button">save all</button>
                </footer>
            </main>
        `;
        this.search = this.overlay.querySelector('.part-lab-search');
        this.type = this.overlay.querySelector('.part-lab-type');
        this.list = this.overlay.querySelector('.part-lab-list');
        this.count = this.overlay.querySelector('.part-lab-count');
        this.status = this.overlay.querySelector('.part-lab-status');
        this.overlay.querySelector('.part-lab-close').onclick = () => this.close();
        this.search.oninput = () => this.renderCatalog();
        this.type.onchange = () => this.renderCatalog();
        this.overlay.querySelector('[data-action="untested"]').onclick = () => this.openSimulation(this.nextMatching(id => isPartLabReviewUntested(this.store.get(id))));
        this.overlay.querySelector('[data-action="dirty"]').onclick = () => this.openSimulation(this.nextMatching(id => Boolean(this.store.get(id)?.visual || this.store.get(id)?.sound)));
        this.overlay.querySelector('[data-action="reset"]').onclick = () => this.resetDrafts();
        this.overlay.querySelector('[data-action="save-all"]').onclick = () => this.saveAll();
        ['pointerdown', 'mousedown', 'mouseup', 'click', 'contextmenu', 'wheel'].forEach(type => {
            this.overlay.addEventListener(type, event => event.stopPropagation());
        });
        this.document.body.appendChild(this.overlay);
        this.populateTypeFilter();
    }

    populateTypeFilter() {
        if (!this.type) return;
        const types = [...new Set(Object.values(this.partsLibrary).map(part => part.type))].sort();
        const makeOption = (label, value) => {
            const option = this.document.createElement('option');
            option.value = value;
            option.textContent = label;
            return option;
        };
        this.type.replaceChildren(
            makeOption('all types', 'all'),
            ...types.map(value => makeOption(TYPE_LABELS[value] || value, value))
        );
    }

    open() {
        if (!this.overlay) return this;
        if (this.wasPaused === null) this.wasPaused = Boolean(this.game?.paused);
        this.active = true;
        this.game && (this.game.paused = true);
        this.game?.input?.resetActiveState?.();
        this.overlay.classList.add('is-open');
        this.renderCatalog();
        this.overlay.focus();
        return this;
    }

    close() {
        if (this.simulation.active) {
            this.simulation.stop();
            return;
        }
        this.closing = true;
        try {
            if (this.game?.designer?.active) this.game.designer.close();
            if (this.soundEditor.opened) this.soundEditor.close({ cancelled: true });
            this.active = false;
            this.overlay?.classList.remove('is-open');
            if (this.game && this.wasPaused !== null) this.game.paused = this.wasPaused;
            this.wasPaused = null;
            this.game?.input?.resetActiveState?.();
        } finally {
            this.closing = false;
        }
    }

    hideCatalog() {
        this.active = false;
        this.overlay?.classList.remove('is-open');
    }

    renderCatalog() {
        if (!this.list) return;
        const rows = getPartLabCatalogRows(this.partsLibrary, {
            query: this.search?.value,
            type: this.type?.value || 'all',
            store: this.store
        });
        this.count.textContent = `${rows.length}/${Object.keys(this.partsLibrary).length} parts`;
        this.list.replaceChildren(...rows.map(row => this.renderRow(row)));
        this.setStatus(this.statusMessage);
    }

    renderRow(row) {
        const card = this.document.createElement('article');
        card.className = 'part-lab-card';
        const copy = this.document.createElement('div');
        copy.className = 'part-lab-card-copy';
        const title = this.document.createElement('strong');
        title.textContent = row.name;
        const meta = this.document.createElement('small');
        meta.textContent = `${row.id} // ${row.typeLabel}`;
        const description = this.document.createElement('p');
        description.textContent = row.description;
        copy.append(title, meta, description);
        const badges = this.document.createElement('div');
        badges.className = 'part-lab-badges';
        const badge = this.document.createElement('span');
        badge.className = `part-lab-badge is-${row.state}`;
        badge.textContent = row.state;
        badges.appendChild(badge);
        const actions = this.document.createElement('div');
        actions.className = 'part-lab-card-actions';
        actions.append(
            button(this.document, 'visual', () => this.openVisual(row.id)),
            button(this.document, 'sound', () => this.openSound(row.id)),
            button(this.document, 'simulate', () => this.openSimulation(row.id), 'is-accent')
        );
        if (row.draft) actions.appendChild(button(this.document, 'discard', () => this.discard(row.id), 'is-danger'));
        card.append(copy, badges, actions);
        return card;
    }

    openVisual(partId) {
        const part = this.partsLibrary[partId];
        if (!part) return;
        this.hideCatalog();
        this.game.designer.openPart(partId, {
            draft: this.store.get(partId)?.visual || undefined,
            fallbackDefinition: part,
            onDraftChange: design => this.stageVisual(partId, design),
            onStagedSave: design => this.stageVisual(partId, design),
            onNext: () => {
                const next = this.nextPartId(partId);
                if (next) this.openVisual(next);
            },
            onClose: () => { if (!this.closing) this.open(); }
        });
    }

    async openSound(partId) {
        const part = this.partsLibrary[partId];
        if (!part) return;
        this.hideCatalog();
        try { await this.game?.loadingPromise; } catch { /* editor still shows missing states */ }
        if (this.active) return;
        this.soundEditor.open(part, {
            draft: this.store.get(partId)?.sound || undefined,
            onChange: draft => this.stageSound(partId, draft),
            onSave: (draft, meta) => {
                this.stageSound(partId, draft);
                if (meta?.action === 'save' && !this.closing) this.open();
            },
            onNext: () => {
                const next = this.nextPartId(partId);
                return next ? { part: this.partsLibrary[next], draft: this.store.get(next)?.sound || undefined } : null;
            },
            onCancel: () => { if (!this.closing) this.open(); }
        });
    }

    openSimulation(partId) {
        if (!partId) return;
        this.hideCatalog();
        this.simulation.start(partId);
    }

    stageVisual(partId, design) {
        this.store.saveVisual(partId, design);
        applyVisualDesignOverride(this.partsLibrary[partId], design);
        this.setStatus(`${partId}: visual draft autosaved.`);
    }

    stageSound(partId, draft) {
        this.store.saveSound(partId, draft);
        for (const slot of draft?.slots || []) {
            if (slot.eventKey) this.stagedSoundEventKeys.add(slot.eventKey);
        }
        applyPartLabSoundOverrides(buildPartLabManifest(this.store.state), this.game.audio);
        this.setStatus(`${partId}: sound draft autosaved.`);
    }

    applyStoredVisualDrafts() {
        for (const [partId, entry] of Object.entries(this.store.state.parts)) {
            if (entry.visual && this.partsLibrary[partId]) {
                try { applyVisualDesignOverride(this.partsLibrary[partId], entry.visual); } catch { /* normalize already filtered bad drafts */ }
            }
        }
    }

    applyStoredSoundDrafts() {
        try { applyPartLabSoundOverrides(buildPartLabManifest(this.store.state), this.game.audio); } catch { /* missing forge records are shown by the editor */ }
    }

    nextPartId(current) {
        const ids = Object.keys(this.partsLibrary);
        const start = Math.max(0, ids.indexOf(current));
        return ids[(start + 1) % ids.length] || null;
    }

    nextMatching(predicate) {
        const ids = Object.keys(this.partsLibrary);
        return ids.find(predicate) || ids[0] || null;
    }

    discard(partId) {
        if (!this.document.defaultView?.confirm?.(`discard ${partId} draft?`)) return;
        this.store.discard(partId);
        const baseline = this.baselineVisuals[partId];
        if (baseline) applyVisualDesignOverride(this.partsLibrary[partId], baseline);
        this.restoreStagedSoundBindings();
        this.setStatus(`${partId}: draft discarded.`);
    }

    resetDrafts() {
        if (!this.document.defaultView?.confirm?.('reset every part lab draft?')) return;
        this.store.reset();
        for (const [partId, design] of Object.entries(this.baselineVisuals)) {
            try { applyVisualDesignOverride(this.partsLibrary[partId], design); } catch { /* baseline was validated at construction */ }
        }
        this.restoreStagedSoundBindings();
        this.setStatus('all drafts reset.');
    }

    restoreStagedSoundBindings() {
        const eventKeys = new Set(this.stagedSoundEventKeys || []);
        for (const entry of Object.values(this.store.state.parts || {})) {
            for (const slot of entry.sound?.slots || []) {
                if (slot.eventKey) eventKeys.add(slot.eventKey);
            }
        }
        for (const eventKey of eventKeys) {
            const soundName = this.baselineBindings.get(eventKey);
            if (soundName) this.game.audio?.bindEvent?.(eventKey, soundName);
            else this.game.audio?.unbindEvent?.(eventKey);
        }
        this.applyStoredSoundDrafts();
    }

    captureBaselineSoundBindings() {
        this.baselineBindings.clear();
        for (const eventKey of this.partSoundEventKeys) {
            const soundName = this.game.audio?.getEventBinding?.(eventKey)
                || this.game.audio?.eventBindings?.get?.(eventKey);
            if (soundName) this.baselineBindings.set(eventKey, soundName);
        }
        this.baselineBindingsCaptured = true;
    }

    async saveAll() {
        const manifest = buildPartLabManifest(this.store.state);
        const raw = serializePartLabManifest(manifest);
        const timestamp = manifest.modifiedAt;
        try {
            await this.syncForgeBindings(manifest);
            if (this.bridge.available) {
                // Re-promote even an empty current binding set so clearing a
                // previously promoted Forge assignment really removes it.
                await this.game.signalForge.promote();
                await this.bridge.promote(raw);
                this.store.markPromoted(Object.keys(this.store.state.parts), timestamp);
                this.setStatus('saved. source files updated for the next build.');
            } else {
                const downloaded = downloadPartLabManifest(raw, this.document);
                if (!downloaded) throw new Error('manifest download failed');
                this.setStatus('manifest downloaded only. source files were not updated.');
                return { promoted: false, downloaded: true, timestamp };
            }
            return { promoted: true, downloaded: false, timestamp };
        } catch (error) {
            this.setStatus(`save all failed: ${String(error?.message || error).toLowerCase()}`);
        }
    }

    async syncForgeBindings(manifest) {
        const forge = this.game?.signalForge;
        if (!forge) return;
        for (const entry of manifest.sounds) {
            for (const slot of entry.slots) {
                const assignment = slot.assignment;
                if (assignment?.source === 'signal-forge') {
                    if (forge.sounds.has(assignment.soundId)) {
                        await forge.bind(slot.eventKey, assignment.soundId);
                    } else {
                        if (forge.getBinding(slot.eventKey)) await forge.unbind(slot.eventKey);
                        this.game.audio?.unbindEvent?.(slot.eventKey);
                    }
                } else {
                    if (forge.getBinding(slot.eventKey)) await forge.unbind(slot.eventKey);
                    this.game.audio?.unbindEvent?.(slot.eventKey);
                    if (assignment?.source === 'runtime') this.game.audio?.bindEvent?.(slot.eventKey, assignment.eventId);
                }
            }
        }
    }

    setStatus(message) {
        this.statusMessage = String(message || '').toLowerCase();
        if (this.status) this.status.textContent = this.statusMessage;
    }
}

export function isPartLabReviewUntested(entry) {
    return !entry?.review || entry.review.status === PART_LAB_REVIEW_STATUS.UNTESTED;
}
