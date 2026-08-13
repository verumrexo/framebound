import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';
import {
    ENCOUNTER_ROLES,
    ENEMY_MOVEMENT_STYLES,
    ENEMY_SPECIAL_ACTIONS,
    ENEMY_TIERS,
    normalizeEnemyBlueprint,
    validateCombatReadyBlueprint
} from '../../shared/enemies/EnemyBlueprints.js';
import { EntityRenderer } from '../renderers/EntityRenderer.js';
import { EnemyLabDraftStore } from './EnemyLabDraftStore.js';
import { buildEnemyLabManifest, serializeEnemyLabManifest } from './EnemyLabManifest.js';
import { downloadEnemyLabManifest, EnemyLabNativeBridge } from './EnemyLabNativeBridge.js';
import { EnemyLabSimulation } from './EnemyLabSimulation.js';

const field = (label, input, help = '') => `<label class="enemy-lab-field"><span>${label}${help ? `<i title="${help}">?</i>` : ''}</span>${input}</label>`;
const numberInput = (key, min, max, step = 1) => `<input type="number" data-field="${key}" min="${min}" max="${max}" step="${step}">`;
const selectInput = (key, values) => `<select data-field="${key}">${values.map(value => `<option value="${value}">${value.replaceAll('-', ' ')}</option>`).join('')}</select>`;

export class EnemyLabWindow {
    constructor(game = null, { standalone = false } = {}) {
        this.game = game;
        this.standalone = standalone;
        this.store = new EnemyLabDraftStore();
        this.bridge = new EnemyLabNativeBridge();
        this.selectedId = Object.keys(this.store.enemies)[0];
        this.selectedPartId = 'core';
        this.rotation = 0;
        this.zoom = 1;
        this.tool = 'place';
        this.undo = [];
        this.redo = [];
        this.create();
    }

    create() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'enemy-lab-window';
        this.overlay.className = 'enemy-lab-shell';
        this.overlay.innerHTML = `
            <header class="enemy-lab-topbar">
                <div><span class="enemy-lab-mark">enemy lab</span><small>build the threat. prove the threat.</small></div>
                <div class="enemy-lab-top-actions">
                    <span class="enemy-lab-status" role="status">ready</span>
                    <button class="is-simulate" data-action="simulate">simulate ship</button>
                    <button data-action="save">save draft</button>
                    <button class="is-primary" data-action="publish">save all to game</button>
                    <button data-action="close">close</button>
                </div>
            </header>
            <main class="enemy-lab-grid">
                <aside class="enemy-lab-roster">
                    <div class="enemy-lab-pane-head"><strong>roster</strong><span class="enemy-lab-count"></span></div>
                    <div class="enemy-lab-filter-row"><input type="search" placeholder="search ships" data-filter="search"><select data-filter="tier"><option value="">all tiers</option>${ENEMY_TIERS.map(value => `<option>${value}</option>`).join('')}</select></div>
                    <div class="enemy-lab-roster-actions"><button data-action="next-unfinished">next unfinished</button><button data-action="next-dirty">next dirty</button></div>
                    <div class="enemy-lab-list"></div>
                </aside>
                <section class="enemy-lab-workspace">
                    <div class="enemy-lab-canvas-head">
                        <div><strong class="enemy-lab-selected-name"></strong><small class="enemy-lab-description"></small></div>
                        <div class="enemy-lab-tools">
                            <button data-tool="place" class="is-selected">place</button><button data-tool="move">move</button><button data-tool="erase">erase</button>
                            <button data-action="rotate">rotate [r]</button><button data-action="undo">undo</button><button data-action="redo">redo</button>
                            <button data-action="zoom-out">−</button><span class="enemy-lab-zoom">100%</span><button data-action="zoom-in">+</button>
                            <button data-action="blank">blank</button><button data-action="reset">reset concept</button>
                        </div>
                    </div>
                    <div class="enemy-lab-stage"><canvas class="enemy-lab-canvas" width="900" height="660"></canvas><div class="enemy-lab-validation"></div></div>
                    <div class="enemy-lab-parts"><input type="search" placeholder="filter parts" data-parts-filter><div class="enemy-lab-parts-list"></div></div>
                </section>
                <aside class="enemy-lab-inspector">
                    <div class="enemy-lab-tabs"><button data-tab="identity" class="is-selected">identity</button><button data-tab="behavior">behavior</button><button data-tab="rewards">rewards</button></div>
                    <div class="enemy-lab-form" data-panel="identity">
                        ${field('name', '<input data-field="name" maxlength="64">')}
                        ${field('what does it do?', '<textarea data-field="description" maxlength="320" rows="5"></textarea>')}
                        ${field('tier', selectInput('tier', ENEMY_TIERS))}
                        ${field('encounter role', selectInput('encounterRole', ENCOUNTER_ROLES))}
                        <div class="enemy-lab-pair">${field('first floor', numberInput('floor.min', 1, 99))}${field('last floor', numberInput('floor.max', 1, 99))}</div>
                        ${field('spawn weight', numberInput('spawnWeight', 0, 1000, .1), 'higher numbers make this ship more common among valid ships.')}
                        <label class="enemy-lab-ready"><input type="checkbox" data-field="combatReady"><span><b>combat ready</b><small>only ready ships can spawn in the game.</small></span></label>
                    </div>
                    <div class="enemy-lab-form" data-panel="behavior" hidden>
                        ${field('movement style', selectInput('behavior.movementStyle', ENEMY_MOVEMENT_STYLES), 'the main way this ship moves around its target.')}
                        ${field('special action', selectInput('behavior.specialAction', ENEMY_SPECIAL_ACTIONS), 'adds a tactical job such as healing, ramming, or changing phase.')}
                        <div class="enemy-lab-pair">${field('minimum range', numberInput('behavior.preferredMinRange', 0, 1800))}${field('maximum range', numberInput('behavior.preferredMaxRange', 20, 2400))}</div>
                        <div class="enemy-lab-pair">${field('top speed', numberInput('behavior.speed', 20, 500))}${field('acceleration', numberInput('behavior.acceleration', 40, 3000))}</div>
                        ${field('turn speed', numberInput('behavior.turnRate', .2, 12, .1))}
                        <div class="enemy-lab-pair">${field('aggression', numberInput('behavior.aggression', 0, 1, .05))}${field('patience', numberInput('behavior.patience', 0, 1, .05))}</div>
                        <div class="enemy-lab-pair">${field('dodge chance', numberInput('behavior.dodgeChance', 0, 1, .05))}${field('dodge force', numberInput('behavior.dodgeStrength', 0, 2, .05))}</div>
                        <div class="enemy-lab-pair">${field('reaction time', numberInput('behavior.dodgeReaction', .05, 1.5, .05))}${field('look ahead', numberInput('behavior.dodgeLookahead', .1, 2.5, .05))}</div>
                        <div class="enemy-lab-pair">${field('lead moving targets', numberInput('behavior.aimPrediction', 0, 1, .05))}${field('aim accuracy', numberInput('behavior.aimAccuracy', .2, 1, .05))}</div>
                        <div class="enemy-lab-pair">${field('shots per burst', numberInput('behavior.burstSize', 1, 20))}${field('pause after burst', numberInput('behavior.burstPause', 0, 5, .05))}</div>
                        ${field('target choice', selectInput('behavior.targetPriority', ['nearest', 'weakest', 'strongest', 'ally-damaged']))}
                        <div class="enemy-lab-pair">${field('ally spacing', numberInput('behavior.allySpacing', 20, 400))}${field('group pull', numberInput('behavior.cohesion', 0, 1, .05))}</div>
                        ${field('formation', selectInput('behavior.formation', ['loose', 'line', 'wedge', 'ring']))}
                        <div class="enemy-lab-pair">${field('panic below hp', numberInput('behavior.panicHp', 0, 1, .05))}${field('berserk below hp', numberInput('behavior.berserkHp', 0, 1, .05))}</div>
                    </div>
                    <div class="enemy-lab-form" data-panel="rewards" hidden>
                        ${field('base hp', numberInput('stats.maxHp', 1, 100000))}
                        ${field('damage scale', numberInput('stats.damageMultiplier', 0, 5, .05))}
                        <div class="enemy-lab-pair">${field('xp', numberInput('rewards.xp', 0, 100000))}${field('gold', numberInput('rewards.gold', 0, 10000))}</div>
                        <div class="enemy-lab-pair">${field('score', numberInput('rewards.score', 0, 1000000))}${field('drop pieces', numberInput('rewards.drops', 0, 100))}</div>
                    </div>
                </aside>
            </main>
            <section class="enemy-lab-sim" hidden>
                <header><div><strong>combat simulation</strong><small>real ship. real guns. real tactical brain.</small></div><div>
                    <button data-sim="group">1 vs 1</button><button data-sim="invincible">invincible: on</button><button data-sim="pause">pause</button>
                    <select data-sim="speed"><option value=".25">0.25x</option><option value=".5">0.5x</option><option selected value="1">1x</option></select>
                    <button data-sim="overlay">intent: on</button><button data-sim="reset">reset</button><button data-sim="next">next ship [n]</button><button data-sim="close">exit simulation</button>
                </div></header><canvas width="1200" height="700"></canvas>
            </section>
        `;
        document.body.appendChild(this.overlay);
        this.overlay.querySelector('[data-action="close"]').hidden = this.standalone;
        this.canvas = this.overlay.querySelector('.enemy-lab-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.simulation = new EnemyLabSimulation(this.overlay.querySelector('.enemy-lab-sim canvas'));
        this.bind();
        this.select(this.selectedId);
        this.renderParts();
        this.draw();
    }

    open() {
        this.overlay.hidden = false;
        this.overlay.classList.add('is-open');
        if (this.game) this.game.paused = true;
        this.draw();
    }

    close() {
        if (this.standalone) return;
        this.overlay.classList.remove('is-open');
        this.overlay.hidden = true;
        this.simulation.stop();
        if (this.game) this.game.paused = false;
    }

    bind() {
        this.overlay.addEventListener('click', event => {
            const roster = event.target.closest('[data-enemy-id]');
            if (roster) return this.select(roster.dataset.enemyId);
            const part = event.target.closest('[data-part-id]');
            if (part) { this.selectedPartId = part.dataset.partId; this.renderParts(); return; }
            const tab = event.target.closest('[data-tab]');
            if (tab) return this.showTab(tab.dataset.tab);
            const tool = event.target.closest('[data-tool]');
            if (tool) { this.tool = tool.dataset.tool; this.syncTools(); return; }
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action) this.action(action);
            const sim = event.target.closest('[data-sim]')?.dataset.sim;
            if (sim) this.simAction(sim, event.target);
        });
        this.overlay.addEventListener('input', event => {
            if (event.target.matches('[data-filter]')) return this.renderRoster();
            if (event.target.matches('[data-parts-filter]')) return this.renderParts();
            if (event.target.matches('[data-field]')) this.readForm();
        });
        this.overlay.querySelector('[data-sim="speed"]').addEventListener('change', event => {
            this.simulation.speed = Number(event.target.value) || 1;
        });
        this.canvas.addEventListener('contextmenu', event => event.preventDefault());
        this.canvas.addEventListener('pointerdown', event => this.editAt(event));
        window.addEventListener('keydown', event => {
            if (!this.overlay.classList.contains('is-open') || /input|textarea|select/i.test(event.target?.tagName)) return;
            if (event.code === 'KeyR') this.action('rotate');
            if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') this.action(event.shiftKey ? 'redo' : 'undo');
            if (event.code === 'KeyN' && !this.overlay.querySelector('.enemy-lab-sim').hidden) this.simAction('next');
        });
    }

    select(id) {
        if (!this.store.enemies[id]) return;
        this.selectedId = id;
        this.entry = this.store.get(id);
        this.undo = [];
        this.redo = [];
        this.writeForm();
        this.renderRoster();
        this.draw();
    }

    writeForm() {
        for (const input of this.overlay.querySelectorAll('[data-field]')) {
            const value = getPath(this.entry, input.dataset.field);
            if (input.type === 'checkbox') input.checked = Boolean(value);
            else input.value = value ?? '';
        }
        this.overlay.querySelector('.enemy-lab-selected-name').textContent = this.entry.name;
        this.overlay.querySelector('.enemy-lab-description').textContent = this.entry.description;
        this.validate();
    }

    readForm() {
        this.remember();
        for (const input of this.overlay.querySelectorAll('[data-field]')) {
            const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
            setPath(this.entry, input.dataset.field, value);
        }
        try {
            if (this.entry.combatReady && !validateCombatReadyBlueprint(this.entry).valid) {
                this.entry.combatReady = false;
            }
            this.entry = normalizeEnemyBlueprint(this.entry);
        } catch (error) {
            this.status(error.message, true);
            return;
        }
        this.store.set(this.entry);
        this.writeForm();
        this.renderRoster();
    }

    renderRoster() {
        const search = this.overlay.querySelector('[data-filter="search"]').value.toLowerCase();
        const tier = this.overlay.querySelector('[data-filter="tier"]').value;
        const rows = Object.values(this.store.enemies).filter(entry => (!tier || entry.tier === tier) &&
            `${entry.name} ${entry.description}`.toLowerCase().includes(search));
        this.overlay.querySelector('.enemy-lab-count').textContent = `${rows.length}/30`;
        this.overlay.querySelector('.enemy-lab-list').innerHTML = rows.map(entry => {
            const validity = validateCombatReadyBlueprint(entry);
            return `<button data-enemy-id="${entry.id}" class="enemy-lab-card ${entry.id === this.selectedId ? 'is-selected' : ''}">
                <span><b>${entry.name}</b><small>${entry.description}</small></span>
                <em><i class="tier-${entry.tier}">${entry.tier}</i><i>${entry.floor.min}–${entry.floor.max}</i><i class="${entry.combatReady ? 'is-ready' : validity.valid ? 'is-valid' : 'is-invalid'}">${entry.combatReady ? 'ready' : validity.valid ? 'valid draft' : 'unfinished'}</i>${this.store.isDirty(entry.id) ? '<i class="is-dirty">dirty</i>' : ''}</em>
            </button>`;
        }).join('');
    }

    renderParts() {
        const search = this.overlay.querySelector('[data-parts-filter]').value.toLowerCase();
        this.overlay.querySelector('.enemy-lab-parts-list').innerHTML = Object.entries(PartsLibrary)
            .filter(([, def]) => `${def.name} ${def.type}`.toLowerCase().includes(search))
            .map(([id, def]) => `<button data-part-id="${id}" class="${this.selectedPartId === id ? 'is-selected' : ''}" title="${def.description || def.name}"><canvas width="54" height="54" data-preview="${id}"></canvas><span>${def.name}</span><small>${def.width}×${def.height} · ${def.type}</small></button>`).join('');
        for (const canvas of this.overlay.querySelectorAll('[data-preview]')) {
            const def = PartsLibrary[canvas.dataset.preview];
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            const sprite = def.baseSprite || def.sprite;
            sprite.draw(ctx, 27, 27, 0, .5, .5);
            if (def.type === 'weapon') def.sprite.draw(ctx, 27, 27, def.rotationOffset || 0);
        }
    }

    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        ctx.fillStyle = '#05090d'; ctx.fillRect(0, 0, width, height);
        const stride = TILE_SIZE * this.zoom;
        const cx = width / 2; const cy = height / 2;
        ctx.strokeStyle = 'rgba(85,230,255,.09)'; ctx.lineWidth = 1;
        for (let x = cx % stride; x < width; x += stride) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for (let y = cy % stride; y < height; y += stride) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(105,255,220,.35)';
        ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx + 18, cy); ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy + 18); ctx.stroke();
        ctx.fillStyle = '#6cffdf'; ctx.font = '11px ui-monospace, monospace'; ctx.fillText('front →', width - 82, cy - 10);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(this.zoom, this.zoom);
        EntityRenderer.drawEnemy({ ctx, drawRect: (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); } }, {
            x: 0, y: 0, rotation: 0, rotationOffset: 0, isDead: false, isWarpingIn: false,
            shipParts: this.entry.parts, aimAngle: 0, hp: 1, maxHp: 1,
            weaponCooldowns: [], frozenTimer: 0, freezeMeter: 0, empTimer: 0, hackTimer: 0
        });
        ctx.restore();
    }

    editAt(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round(((event.clientX - rect.left) * this.canvas.width / rect.width - this.canvas.width / 2) / (TILE_SIZE * this.zoom));
        const y = Math.round(((event.clientY - rect.top) * this.canvas.height / rect.height - this.canvas.height / 2) / (TILE_SIZE * this.zoom));
        const existing = findPartAt(this.entry.parts, x, y);
        if (event.button === 2 || this.tool === 'erase') {
            if (existing) { this.remember(); this.entry.parts = this.entry.parts.filter(part => part !== existing); this.commitEdit(); }
            return;
        }
        if (this.tool === 'move' && existing) {
            this.moving = { ...existing };
            this.remember();
            this.entry.parts = this.entry.parts.filter(part => part !== existing);
            this.selectedPartId = existing.partId;
            this.rotation = existing.rotation;
            this.tool = 'place';
            this.commitEdit();
            return;
        }
        if (this.tool === 'place' && !existing && canPlace(this.entry.parts, x, y, this.selectedPartId, this.rotation)) {
            this.remember();
            this.entry.parts.push({ x, y, partId: this.selectedPartId, rotation: this.rotation });
            this.commitEdit();
        }
    }

    commitEdit() {
        if (this.entry.combatReady && !validateCombatReadyBlueprint(this.entry).valid) {
            this.entry.combatReady = false;
        }
        this.entry = normalizeEnemyBlueprint(this.entry);
        this.store.set(this.entry);
        this.renderRoster();
        this.validate();
        this.draw();
    }

    validate() {
        const result = validateCombatReadyBlueprint(this.entry);
        const box = this.overlay.querySelector('.enemy-lab-validation');
        box.className = `enemy-lab-validation ${result.valid ? 'is-valid' : 'is-invalid'}`;
        box.textContent = result.valid ? 'assembly valid · safe to mark combat ready' : result.errors.join(' · ');
        const ready = this.overlay.querySelector('[data-field="combatReady"]');
        ready.disabled = !result.valid && !this.entry.combatReady;
        return result;
    }

    remember() {
        const snapshot = JSON.stringify(this.entry);
        if (this.undo.at(-1) !== snapshot) this.undo.push(snapshot);
        if (this.undo.length > 80) this.undo.shift();
        this.redo = [];
    }

    action(action) {
        if (action === 'close') return this.close();
        if (action === 'rotate') { this.rotation = (this.rotation + 1) % 4; return this.status(`rotation ${this.rotation * 90}°`); }
        if (action === 'zoom-in' || action === 'zoom-out') {
            this.zoom = Math.max(.5, Math.min(2, this.zoom + (action === 'zoom-in' ? .25 : -.25)));
            this.overlay.querySelector('.enemy-lab-zoom').textContent = `${Math.round(this.zoom * 100)}%`; return this.draw();
        }
        if (action === 'blank' || action === 'reset') {
            this.remember();
            this.entry = action === 'reset' ? this.store.reset(this.selectedId) : { ...this.entry, combatReady: false, parts: [] };
            this.commitEdit(); this.writeForm(); return;
        }
        if (action === 'undo' || action === 'redo') {
            const source = action === 'undo' ? this.undo : this.redo;
            const target = action === 'undo' ? this.redo : this.undo;
            const snapshot = source.pop();
            if (!snapshot) return;
            target.push(JSON.stringify(this.entry));
            this.entry = JSON.parse(snapshot); this.commitEdit(); this.writeForm(); return;
        }
        if (action === 'save') {
            this.store.set(this.entry); this.store.save(this.selectedId); this.renderRoster(); return this.status('draft saved locally');
        }
        if (action === 'publish') return this.publish();
        if (action === 'simulate') return this.simulate();
        if (action === 'next-unfinished' || action === 'next-dirty') {
            const ids = Object.keys(this.store.enemies); const start = ids.indexOf(this.selectedId);
            const predicate = action === 'next-dirty' ? id => this.store.isDirty(id) : id => !this.store.enemies[id].combatReady;
            for (let offset = 1; offset <= ids.length; offset++) { const id = ids[(start + offset) % ids.length]; if (predicate(id)) return this.select(id); }
        }
    }

    async publish() {
        try {
            this.store.set(this.entry); this.store.saveAll();
            const raw = serializeEnemyLabManifest(buildEnemyLabManifest(this.store.enemies));
            if (this.bridge.available) await this.bridge.promote(raw); else downloadEnemyLabManifest(raw);
            this.renderRoster(); this.status(this.bridge.available ? 'all ships saved to the game' : 'enemy lab file downloaded');
        } catch (error) { this.status(error.message, true); }
    }

    simulate() {
        if (!this.entry.parts.length) return this.status('add at least one part before simulating', true);
        const panel = this.overlay.querySelector('.enemy-lab-sim');
        panel.hidden = false;
        this.simulation.start(this.entry);
    }

    simAction(action, button) {
        if (action === 'close') { this.simulation.stop(); this.overlay.querySelector('.enemy-lab-sim').hidden = true; return; }
        if (action === 'reset') return this.simulation.reset();
        if (action === 'next') { this.action('next-unfinished'); return this.simulation.start(this.entry); }
        if (action === 'group') { this.simulation.group = !this.simulation.group; button.textContent = this.simulation.group ? 'group test' : '1 vs 1'; return this.simulation.reset(); }
        if (action === 'invincible') { this.simulation.invincible = !this.simulation.invincible; button.textContent = `invincible: ${this.simulation.invincible ? 'on' : 'off'}`; return; }
        if (action === 'pause') { this.simulation.paused = !this.simulation.paused; button.textContent = this.simulation.paused ? 'resume' : 'pause'; return; }
        if (action === 'overlay') { this.simulation.overlays = !this.simulation.overlays; button.textContent = `intent: ${this.simulation.overlays ? 'on' : 'off'}`; }
    }

    showTab(name) {
        for (const button of this.overlay.querySelectorAll('[data-tab]')) button.classList.toggle('is-selected', button.dataset.tab === name);
        for (const panel of this.overlay.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== name;
    }

    syncTools() {
        for (const button of this.overlay.querySelectorAll('[data-tool]')) button.classList.toggle('is-selected', button.dataset.tool === this.tool);
    }

    status(message, error = false) {
        const status = this.overlay.querySelector('.enemy-lab-status');
        status.textContent = message; status.classList.toggle('is-error', error);
    }
}

function getPath(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
function setPath(object, path, value) { const keys = path.split('.'); const last = keys.pop(); const parent = keys.reduce((item, key) => item[key] ||= {}, object); parent[last] = value; }
function rotatedSize(def, rotation) { return rotation % 2 ? { width: def.height, height: def.width } : { width: def.width, height: def.height }; }
function partCells(part) { const size = rotatedSize(PartsLibrary[part.partId], part.rotation); const cells = []; for (let x = 0; x < size.width; x++) for (let y = 0; y < size.height; y++) cells.push(`${part.x + x},${part.y + y}`); return cells; }
function findPartAt(parts, x, y) { const key = `${x},${y}`; return parts.find(part => partCells(part).includes(key)); }
function canPlace(parts, x, y, partId, rotation) { const occupied = new Set(parts.flatMap(partCells)); const candidate = { x, y, partId, rotation }; return !partCells(candidate).some(cell => occupied.has(cell)); }
