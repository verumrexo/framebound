import { Enemy } from '../../shared/entities/Enemy.js';
import { Projectile } from '../../shared/entities/Projectile.js';
import { Ship } from '../../shared/entities/Ship.js';
import { PartsLibrary } from '../../shared/parts/Part.js';

export const PART_LAB_REVIEW_STATUS = Object.freeze({
    UNTESTED: 'untested',
    GOOD: 'good',
    NEEDS_WORK: 'needs-work'
});

export const PART_LAB_ENEMY_DART_INTERVAL = 2;
export const PART_LAB_NOTE_LIMIT = 240;

const PART_LAB_STATE_KEYS = Object.freeze([
    'playerShip',
    'enemies',
    'bosses',
    'projectiles',
    'asteroids',
    'lootCrates',
    'shipwrecks',
    'drones',
    'decoys',
    'itemPickups',
    'xpOrbs',
    'goldOrbs',
    'hpOrbs',
    'portals',
    'damageNumbers',
    'explosions',
    'notifications',
    'shopItems',
    'treasureChests',
    'vaultChests',
    'currentRoom',
    'x',
    'y',
    'vx',
    'vy',
    'rotation',
    'running',
    'paused',
    'isGameOver',
    'isSpectating',
    'mouseDownLastFrame',
    'coreSpinAngle',
    'dashCooldown',
    'dashMaxCooldown',
    'dashActiveTimer',
    'dashDuration',
    'dashPower',
    'score',
    'gold',
    'xp',
    'level',
    'xpToNext',
    'floor',
    'fullscreenMapOpen',
    'isTainted'
]);

const PART_LAB_ARRAY_KEYS = Object.freeze([
    'enemies',
    'bosses',
    'projectiles',
    'asteroids',
    'lootCrates',
    'shipwrecks',
    'drones',
    'decoys',
    'itemPickups',
    'xpOrbs',
    'goldOrbs',
    'hpOrbs',
    'portals',
    'damageNumbers',
    'explosions',
    'notifications',
    'shopItems',
    'treasureChests',
    'vaultChests'
]);

function cleanNote(note) {
    return String(note ?? '').trim().slice(0, PART_LAB_NOTE_LIMIT);
}

function assertReviewStatus(status) {
    if (
        status !== PART_LAB_REVIEW_STATUS.GOOD &&
        status !== PART_LAB_REVIEW_STATUS.NEEDS_WORK
    ) {
        throw new RangeError(`invalid part lab review status: ${status}`);
    }
}

function partIdsFrom(library) {
    return Object.keys(library || {}).filter(id => library[id]);
}

function modulo(value, length) {
    return ((value % length) + length) % length;
}

function isEditableTarget(target) {
    const tagName = String(target?.tagName || '').toLowerCase();
    return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable === true
    );
}

function placementCandidates() {
    const result = [];
    for (let radius = 1; radius <= 8; radius++) {
        for (let x = -radius; x <= radius; x++) {
            result.push({ x, y: -radius });
            result.push({ x, y: radius });
        }
        for (let y = -radius + 1; y < radius; y++) {
            result.push({ x: -radius, y });
            result.push({ x: radius, y });
        }
    }
    return result;
}

function isNonStackable(definition) {
    return (
        definition?.stackable === false ||
        definition?.nonStackable === true ||
        definition?.maxCopies === 1 ||
        definition?.stats?.maxCopies === 1
    );
}

/**
 * Build the deliberately boring test loadout used by the simulation.
 * Ship.addPart remains the authority for footprint and adjacency rules.
 */
export function createPartLabTestShip(
    partId,
    {
        partsLibrary = PartsLibrary,
        ShipClass = Ship,
        requestedCopies = 2
    } = {}
) {
    const definition = partsLibrary?.[partId];
    if (!definition) throw new Error(`unknown part lab part: ${partId}`);

    const ship = new ShipClass();
    if (!(ship.parts instanceof Map) || typeof ship.addPart !== 'function') {
        throw new TypeError('part lab ShipClass must expose parts and addPart()');
    }

    ship.parts.clear();
    const coreAdded = ship.addPart(0, 0, 'core', 0);
    if (!coreAdded) throw new Error('part lab could not place the test core');

    const copyLimit = isNonStackable(definition)
        ? Math.min(1, requestedCopies)
        : requestedCopies;
    const placements = [];
    if (definition.type !== 'core' && partId !== 'core') {
        for (const candidate of placementCandidates()) {
            if (placements.length >= copyLimit) break;
            const placed = ship.addPart(candidate.x, candidate.y, partId, 0);
            if (placed) placements.push({ ...candidate, rotation: 0 });
        }
    }

    ship.recalculateStats?.();
    ship.hp = ship.maxHp;
    ship.isDead = false;
    ship.x = 0;
    ship.y = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.rotation = 0;
    ship.partLabCopiesAdded = placements.length;
    ship.partLabRequestedCopies = requestedCopies;
    ship.partLabPlacementNote = placements.length === requestedCopies
        ? ''
        : `placed ${placements.length}/${requestedCopies} copies; footprint or stacking rules limited the loadout`;

    return {
        ship,
        placements,
        copiesAdded: placements.length,
        requestedCopies
    };
}

/**
 * Small deterministic timer so cadence behavior can be tested without a Game.
 */
export class PartLabEnemyDartCadence {
    constructor(interval = PART_LAB_ENEMY_DART_INTERVAL) {
        if (!Number.isFinite(interval) || interval <= 0) {
            throw new RangeError('part lab dart interval must be positive');
        }
        this.interval = interval;
        this.elapsed = 0;
    }

    reset() {
        this.elapsed = 0;
    }

    update(dt, fire) {
        if (!Number.isFinite(dt) || dt <= 0) return 0;
        this.elapsed += dt;
        let fired = 0;
        while (this.elapsed >= this.interval) {
            this.elapsed -= this.interval;
            fire();
            fired++;
        }
        return fired;
    }
}

export function capturePartLabGameState(game) {
    const values = {};
    for (const key of PART_LAB_STATE_KEYS) values[key] = game[key];
    const input = game.input;
    const camera = game.camera;
    const audio = game.audio;
    return {
        values,
        weaponStaggerTimers: game.weaponSystem
            ? { ...game.weaponSystem.staggerTimers }
            : null,
        projectileClock: game.projectileSystem?.projectileClock,
        weaponRandom: game.weaponSystem?.random,
        projectileRandom: game.projectileSystem?.random,
        abilityState: game.abilitySystem
            ? {
                selectedIndex: game.abilitySystem.selectedIndex,
                decoySerial: game.abilitySystem.decoySerial
            }
            : null,
        cameraState: camera ? { ...camera } : null,
        inputState: input
            ? {
                active: input.active,
                keys: input.keys instanceof Set ? new Set(input.keys) : null,
                keysPressed: input.keysPressed instanceof Set ? new Set(input.keysPressed) : null,
                mouse: input.mouse ? { ...input.mouse } : null
            }
            : null,
        telemetry: cloneCombatTelemetry(game.combatTelemetry),
        audioEventBindings: cloneMap(audio?.eventBindings),
        audioRecentPlays: cloneMap(audio?.recentPlays, value => ({ ...value })),
        audioMissingSoundWarnings: audio?.missingSoundWarnings instanceof Set
            ? new Set(audio.missingSoundWarnings)
            : null
    };
}

export function restorePartLabGameState(game, snapshot) {
    if (!snapshot?.values) return;
    for (const key of PART_LAB_STATE_KEYS) game[key] = snapshot.values[key];
    if (game.weaponSystem && snapshot.weaponStaggerTimers) {
        game.weaponSystem.staggerTimers = { ...snapshot.weaponStaggerTimers };
    }
    if (game.projectileSystem) {
        game.projectileSystem.projectileClock = snapshot.projectileClock;
    }
    if (game.weaponSystem && snapshot.weaponRandom !== undefined) {
        game.weaponSystem.random = snapshot.weaponRandom;
    }
    if (game.projectileSystem && snapshot.projectileRandom !== undefined) {
        game.projectileSystem.random = snapshot.projectileRandom;
    }
    if (game.abilitySystem && snapshot.abilityState) {
        game.abilitySystem.selectedIndex = snapshot.abilityState.selectedIndex;
        game.abilitySystem.decoySerial = snapshot.abilityState.decoySerial;
    }
    if (game.camera && snapshot.cameraState) Object.assign(game.camera, snapshot.cameraState);
    if (game.input && snapshot.inputState) {
        game.input.active = snapshot.inputState.active;
        if (snapshot.inputState.keys && game.input.keys instanceof Set) {
            game.input.keys.clear();
            for (const key of snapshot.inputState.keys) game.input.keys.add(key);
        }
        if (snapshot.inputState.keysPressed && game.input.keysPressed instanceof Set) {
            game.input.keysPressed.clear();
            for (const key of snapshot.inputState.keysPressed) game.input.keysPressed.add(key);
        }
        if (snapshot.inputState.mouse && game.input.mouse) {
            Object.assign(game.input.mouse, snapshot.inputState.mouse);
        }
    }
    if (game.combatTelemetry?.byPlayer && snapshot.telemetry) {
        restoreMap(game.combatTelemetry.byPlayer, snapshot.telemetry);
    }
    if (game.audio) {
        restoreMap(game.audio.eventBindings, snapshot.audioEventBindings);
        restoreMap(game.audio.recentPlays, snapshot.audioRecentPlays);
        if (game.audio.missingSoundWarnings instanceof Set && snapshot.audioMissingSoundWarnings) {
            game.audio.missingSoundWarnings.clear();
            for (const name of snapshot.audioMissingSoundWarnings) game.audio.missingSoundWarnings.add(name);
        }
    }
}

function makePartLabEnemy(
    x,
    y,
    {
        EnemyClass = Enemy,
        random = () => 0.5
    } = {}
) {
    const enemy = new EnemyClass(
        x,
        y,
        'patcher',
        1,
        random,
        'part_lab_test_enemy',
        { allowDraft: true }
    );

    // Keep the real Enemy movement and hit logic, but remove every normal
    // weapon route. The adapter below owns the single deterministic dart.
    enemy.isWarpingIn = false;
    enemy.warpTimer = 0;
    enemy.behaviorProfile.movementStyle = 'orbit';
    enemy.behaviorProfile.preferredMinRange = 500;
    enemy.behaviorProfile.preferredMaxRange = 650;
    enemy.engagementDist = 600;
    enemy.detectionDist = Number.POSITIVE_INFINITY;
    enemy.speed = 40;
    enemy.turnRate = 0.8;
    enemy.circleDirection = 1;
    enemy.weaponCooldowns = [];
    enemy.shootRate = 0;
    enemy.projectileType = null;
    enemy.shootCooldown = Number.POSITIVE_INFINITY;
    enemy.maxHp = 10_000;
    enemy.hp = enemy.maxHp;
    enemy.isDead = false;
    return enemy;
}

function clearSimulationArrays(game) {
    for (const key of PART_LAB_ARRAY_KEYS) game[key] = [];
}

function cloneMap(map, cloneValue = value => value) {
    return map instanceof Map
        ? new Map([...map].map(([key, value]) => [key, cloneValue(value)]))
        : null;
}

function cloneCombatTelemetry(telemetry) {
    if (!telemetry?.byPlayer) return null;
    return cloneMap(telemetry.byPlayer, entries => cloneMap(entries, value => ({ ...value })));
}

function restoreMap(target, snapshot) {
    if (!(target instanceof Map) || !(snapshot instanceof Map)) return;
    target.clear();
    for (const [key, value] of snapshot) target.set(key, value);
}

/**
 * Live adapter. It swaps only the transient world references, then delegates
 * aiming, weapon fire, projectile movement, collisions, and enemy movement to
 * the game's existing systems.
 */
export function createPartLabLiveRuntimeAdapter(
    game,
    {
        partsLibrary = PartsLibrary,
        ShipClass = Ship,
        EnemyClass = Enemy,
        random = () => 0.5,
        enemyDartDamage = 3,
        enemyDartSpeed = 400,
        enemyDartType = 'bullet'
    } = {}
) {
    let simulation = null;

    const spawnEnemyDart = () => {
        if (!simulation) return null;
        const angle = Math.atan2(
            game.y - simulation.enemy.y,
            game.x - simulation.enemy.x
        );
        const payload = {
            x: simulation.enemy.x,
            y: simulation.enemy.y,
            angle,
            type: enemyDartType,
            speed: enemyDartSpeed,
            damage: enemyDartDamage
        };
        if (typeof game.spawnEnemyProjectile === 'function') {
            return game.spawnEnemyProjectile(payload);
        }
        const projectile = new Projectile(
            payload.x,
            payload.y,
            payload.angle,
            payload.type,
            payload.speed,
            'enemy',
            payload.damage,
            null,
            random
        );
        game.projectiles.push(projectile);
        return projectile;
    };

    const resetPart = partId => {
        const loadout = createPartLabTestShip(partId, {
            partsLibrary,
            ShipClass
        });
        const enemy = makePartLabEnemy(600, 0, { EnemyClass, random });

        clearSimulationArrays(game);
        game.playerShip = loadout.ship;
        game.enemies.push(enemy);
        game.currentRoom = null;
        game.x = 0;
        game.y = 0;
        game.vx = 0;
        game.vy = 0;
        game.rotation = 0;
        game.running = true;
        game.paused = false;
        game.isGameOver = false;
        game.isSpectating = false;
        game.mouseDownLastFrame = false;
        if (game.weaponSystem) {
            game.weaponSystem.staggerTimers = {};
            game.weaponSystem.random = random;
        }
        if (game.projectileSystem) {
            game.projectileSystem.projectileClock = 0;
            game.projectileSystem.random = random;
        }

        simulation = {
            partId,
            enemy,
            loadout,
            dartCadence: new PartLabEnemyDartCadence()
        };
        return {
            partId,
            ship: loadout.ship,
            enemy,
            placements: loadout.placements,
            copiesAdded: loadout.copiesAdded,
            placementNote: loadout.ship.partLabPlacementNote
        };
    };

    return {
        captureState: () => capturePartLabGameState(game),
        startPart: resetPart,
        resetPart,
        update(dt, _state, context = {}) {
            if (!simulation || !Number.isFinite(dt) || dt <= 0) return null;
            const frameRuntime = context.frameRuntime || game.frameRuntime;
            if (!frameRuntime?.updatePartLabFrame) {
                throw new Error('part lab simulation needs FrameRuntimeSystem.updatePartLabFrame()');
            }
            const frame = frameRuntime.updatePartLabFrame(dt, {
                afterEnemyUpdate: () => simulation.dartCadence.update(dt, spawnEnemyDart)
            });
            return {
                partId: simulation.partId,
                enemy: simulation.enemy,
                ship: game.playerShip,
                projectileCount: game.projectiles.length,
                frame
            };
        },
        stop() {
            simulation = null;
        },
        restoreState: snapshot => restorePartLabGameState(game, snapshot),
        getScene: () => simulation
            ? {
                partId: simulation.partId,
                ship: game.playerShip,
                enemy: simulation.enemy,
                projectiles: game.projectiles
            }
            : null
    };
}

function makeButton(documentRef, label, onClick) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    button.style.cssText = [
        'background:#102a36',
        'border:1px solid #2bd9e8',
        'color:#d8fbff',
        'cursor:pointer',
        'font:600 12px system-ui,sans-serif',
        'padding:7px 10px'
    ].join(';');
    return button;
}

export function createPartLabSimulationOverlay(controller, {
    documentRef = globalThis.document,
    container = documentRef?.body
} = {}) {
    if (!documentRef || !container) return null;

    const overlay = documentRef.createElement('div');
    overlay.tabIndex = -1;
    overlay.dataset.partLabSimulation = 'true';
    overlay.style.cssText = [
        'display:none',
        'position:fixed',
        'inset:16px 16px auto auto',
        'z-index:10000',
        'width:min(620px,calc(100vw - 32px))',
        'background:rgba(4,12,18,.96)',
        'border:1px solid #2bd9e8',
        'box-shadow:0 0 24px rgba(43,217,232,.25)',
        'color:#d8fbff',
        'font:13px system-ui,sans-serif',
        'padding:12px'
    ].join(';');

    const title = documentRef.createElement('div');
    title.style.cssText = 'font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px';
    const details = documentRef.createElement('div');
    details.style.cssText = 'color:#86b9c4;margin-bottom:10px';

    const controls = documentRef.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px';

    const notes = documentRef.createElement('textarea');
    notes.rows = 2;
    notes.maxLength = PART_LAB_NOTE_LIMIT;
    notes.placeholder = 'short note about this part';
    notes.style.cssText = 'box-sizing:border-box;width:100%;resize:vertical;background:#07141b;border:1px solid #2b5660;color:#d8fbff;padding:8px;font:13px system-ui,sans-serif';

    const previous = makeButton(documentRef, 'previous', () => controller.previous());
    const next = makeButton(documentRef, 'next [p]', () => controller.next());
    const nextUntested = makeButton(documentRef, 'next untested', () => controller.nextUntested());
    const good = makeButton(documentRef, 'good', () => controller.recordStatus('good', notes.value));
    const needsWork = makeButton(documentRef, 'needs work', () => controller.recordStatus('needs-work', notes.value));
    const saveNote = makeButton(documentRef, 'save note', () => controller.setNotes(notes.value));
    const exit = makeButton(documentRef, 'exit', () => controller.stop());
    controls.append(previous, next, nextUntested, good, needsWork, saveNote, exit);
    overlay.append(title, details, controls, notes);

    overlay.addEventListener('keydown', event => {
        if (isEditableTarget(event.target)) return;
        if (event.key.toLowerCase() !== 'p' || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        if (event.shiftKey) controller.previous();
        else controller.next();
    });

    overlay._partLabRender = state => {
        overlay.style.display = state.active ? 'block' : 'none';
        const name = state.partName || state.currentPartId || 'part lab';
        title.textContent = `part lab simulation // ${name}`;
        details.textContent = `${state.index + 1}/${state.totalParts} · ${state.status} · p next · shift+p previous`;
        notes.value = state.notes || '';
    };
    container.appendChild(overlay);
    return overlay;
}

export class PartLabSimulationController {
    constructor({
        game = null,
        partsLibrary = PartsLibrary,
        adapter = game ? createPartLabLiveRuntimeAdapter(game, { partsLibrary }) : null,
        documentRef = globalThis.document,
        autoMount = true,
        review = null,
        onReviewChange = null,
        onExit = null
    } = {}) {
        if (!adapter) throw new TypeError('part lab simulation requires a runtime adapter or game');
        this.partsLibrary = partsLibrary;
        this.partIds = partIdsFrom(partsLibrary);
        if (this.partIds.length === 0) throw new Error('part lab has no parts');
        this.adapter = adapter;
        this.documentRef = documentRef;
        this.autoMount = autoMount;
        this.review = review instanceof Map
            ? new Map(review)
            : new Map(Object.entries(review || {}));
        this.onReviewChange = onReviewChange;
        this.onExit = onExit;
        this.index = 0;
        this.currentPartId = null;
        this.scene = null;
        this.originalState = null;
        this.active = false;
        this.overlay = null;
        this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
    }

    start(partId = this.partIds[0]) {
        if (this.active) return this.selectPart(partId);
        this.assertPart(partId);
        this.originalState = this.adapter.captureState?.();
        this.active = true;
        globalThis.window?.addEventListener?.('keydown', this.handleGlobalKeyDown, true);
        try {
            this.selectPart(partId);
            if (this.autoMount && !this.overlay) this.mountOverlay();
            this.renderOverlay();
            return this.getState();
        } catch (error) {
            try {
                this.adapter.stop?.();
                this.adapter.restoreState?.(this.originalState);
            } catch {
                // Preserve the original start error; the live adapter remains
                // injectable so callers can surface a more useful failure.
            }
            this.active = false;
            this.originalState = null;
            globalThis.window?.removeEventListener?.('keydown', this.handleGlobalKeyDown, true);
            throw error;
        }
    }

    stop() {
        if (!this.active) return false;
        let error = null;
        try {
            this.adapter.stop?.();
        } catch (stopError) {
            error = stopError;
        } finally {
            try {
                this.adapter.restoreState?.(this.originalState);
            } catch (restoreError) {
                error ||= restoreError;
            }
            this.active = false;
            this.currentPartId = null;
            this.scene = null;
            this.originalState = null;
            globalThis.window?.removeEventListener?.('keydown', this.handleGlobalKeyDown, true);
            this.renderOverlay();
            this.onExit?.();
        }
        if (error) throw error;
        return true;
    }

    exit() {
        return this.stop();
    }

    update(dt) {
        if (!this.active) return null;
        const result = this.adapter.update?.(dt, this.getState());
        if (result !== undefined) this.scene = result;
        return result;
    }

    next() {
        return this.moveToIndex(this.index + 1);
    }

    previous() {
        return this.moveToIndex(this.index - 1);
    }

    nextUntested() {
        for (let offset = 1; offset <= this.partIds.length; offset++) {
            const index = modulo(this.index + offset, this.partIds.length);
            if (this.getReview(this.partIds[index]).status === PART_LAB_REVIEW_STATUS.UNTESTED) {
                return this.moveToIndex(index);
            }
        }
        return this.getState();
    }

    selectPart(partId) {
        this.assertPart(partId);
        if (!this.active) return this.start(partId);
        const index = this.partIds.indexOf(partId);
        const reset = this.adapter.resetPart || this.adapter.startPart;
        if (typeof reset !== 'function') throw new TypeError('part lab adapter must expose resetPart()');
        this.scene = reset.call(this.adapter, partId, this.getState());
        this.index = index;
        this.currentPartId = partId;
        this.renderOverlay();
        return this.getState();
    }

    recordStatus(status, notes = undefined, partId = this.currentPartId) {
        this.assertPart(partId);
        assertReviewStatus(status);
        const previous = this.getReview(partId);
        this.review.set(partId, {
            status,
            notes: notes === undefined ? previous.notes : cleanNote(notes)
        });
        this.onReviewChange?.(partId, this.getReview(partId));
        this.renderOverlay();
        return this.getReview(partId);
    }

    setNotes(notes, partId = this.currentPartId) {
        this.assertPart(partId);
        const previous = this.getReview(partId);
        this.review.set(partId, {
            status: previous.status || PART_LAB_REVIEW_STATUS.UNTESTED,
            notes: cleanNote(notes)
        });
        this.onReviewChange?.(partId, this.getReview(partId));
        this.renderOverlay();
        return this.getReview(partId);
    }

    getReview(partId) {
        this.assertPart(partId);
        return {
            status: this.review.get(partId)?.status || PART_LAB_REVIEW_STATUS.UNTESTED,
            notes: this.review.get(partId)?.notes || ''
        };
    }

    getParts() {
        return this.partIds.map(id => ({
            id,
            name: this.partsLibrary[id].name || id,
            type: this.partsLibrary[id].type || 'unknown',
            ...this.getReview(id)
        }));
    }

    getState() {
        const review = this.currentPartId
            ? this.getReview(this.currentPartId)
            : { status: PART_LAB_REVIEW_STATUS.UNTESTED, notes: '' };
        return {
            active: this.active,
            index: this.index,
            totalParts: this.partIds.length,
            currentPartId: this.currentPartId,
            partName: this.currentPartId
                ? this.partsLibrary[this.currentPartId].name || this.currentPartId
                : null,
            status: review.status,
            notes: review.notes,
            scene: this.scene
        };
    }

    mountOverlay(options = {}) {
        if (this.overlay) return this.overlay;
        this.overlay = createPartLabSimulationOverlay(this, {
            documentRef: options.documentRef || this.documentRef,
            container: options.container
                || options.documentRef?.body
                || this.documentRef?.body
        });
        this.renderOverlay();
        return this.overlay;
    }

    assertPart(partId) {
        if (!this.partIds.includes(partId)) throw new Error(`unknown part lab part: ${partId}`);
    }

    moveToIndex(index) {
        return this.selectPart(this.partIds[modulo(index, this.partIds.length)]);
    }

    renderOverlay() {
        this.overlay?._partLabRender?.(this.getState());
    }

    handleGlobalKeyDown(event) {
        if (!this.active || isEditableTarget(event.target)) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== 'p') return;
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) this.previous();
        else this.next();
    }
}
