import { PartsLibrary } from '../parts/Part.js';

export const ENEMY_TIERS = Object.freeze(['basic', 'specialist', 'elite', 'bastard']);
export const ENCOUNTER_ROLES = Object.freeze(['standard', 'miniboss', 'boss']);
export const ENEMY_MOVEMENT_STYLES = Object.freeze([
    'approach', 'hold', 'orbit', 'strafe', 'retreat', 'flank'
]);
export const ENEMY_SPECIAL_ACTIONS = Object.freeze([
    'none', 'support', 'deployer', 'mine-layer', 'rammer',
    'stealth-ambush', 'disabler', 'shield-anchor', 'phase-switch'
]);

const DEFAULT_BEHAVIOR = Object.freeze({
    movementStyle: 'approach',
    orbitDirection: 'either',
    preferredMinRange: 220,
    preferredMaxRange: 360,
    speed: 120,
    acceleration: 520,
    turnRate: 3,
    aggression: 0.65,
    patience: 0.45,
    dodgeChance: 0.35,
    dodgeStrength: 0.7,
    dodgeReaction: 0.24,
    dodgeLookahead: 0.8,
    aimPrediction: 0.55,
    aimAccuracy: 0.88,
    burstSize: 3,
    burstPause: 0.75,
    targetPriority: 'nearest',
    allySpacing: 86,
    formation: 'loose',
    cohesion: 0.35,
    panicHp: 0.22,
    berserkHp: 0.18,
    specialAction: 'none'
});

const TIER_STATS = Object.freeze({
    basic: { maxHp: 70, speed: 125, acceleration: 520, turnRate: 3.2, damageMultiplier: 0.55 },
    specialist: { maxHp: 150, speed: 115, acceleration: 440, turnRate: 2.7, damageMultiplier: 0.68 },
    elite: { maxHp: 290, speed: 130, acceleration: 460, turnRate: 2.9, damageMultiplier: 0.82 },
    bastard: { maxHp: 780, speed: 105, acceleration: 360, turnRate: 2.2, damageMultiplier: 1 }
});

const CONCEPTS = [
    ['nail', 'nail', 'basic', 'standard', 'an honest chaser that fires short bursts, dodges once, then commits again. basic tier: predictable alone, dangerous when ignored.', { movementStyle: 'approach' }],
    ['skipjack', 'skipjack', 'basic', 'standard', 'a fragile skirmisher that cuts left and right while shooting. basic tier: easy to kill, annoying to line up.', { movementStyle: 'strafe', dodgeChance: 0.5 }],
    ['midge', 'midge', 'basic', 'standard', 'a tiny fighter that circles close and keeps poking. basic tier: weak, but it lives in your blind spot.', { movementStyle: 'orbit', preferredMinRange: 120, preferredMaxRange: 230 }],
    ['bruiser', 'bruiser', 'basic', 'standard', 'a slow chunky brawler that walks into medium range and stays there. basic tier: simple, durable, and hard to shove aside.', { movementStyle: 'hold', speed: 85 }],
    ['longshot', 'longshot', 'basic', 'standard', 'a patient shooter that backs away and telegraphs long shots. basic tier: harmless up close, painful when left far away.', { movementStyle: 'retreat', preferredMinRange: 620, preferredMaxRange: 900, patience: 0.8 }],
    ['ramjaw', 'ramjaw', 'basic', 'standard', 'it lines up a very obvious ram and must recover after missing. basic tier: dodge the charge or eat the whole ship.', { movementStyle: 'approach', specialAction: 'rammer', preferredMinRange: 40, preferredMaxRange: 150 }],
    ['buckshot', 'buckshot', 'basic', 'standard', 'a shotgun bully that rushes in, blasts, then backs out. basic tier: scary for one second and vulnerable afterward.', { movementStyle: 'strafe', preferredMinRange: 90, preferredMaxRange: 190, burstSize: 2 }],
    ['volley', 'volley', 'basic', 'standard', 'a middle-range gunboat that fires measured bursts instead of spraying forever. basic tier: fair pressure with clear breathing room.', { movementStyle: 'hold', burstSize: 5, burstPause: 1.2 }],
    ['sentry', 'sentry', 'basic', 'standard', 'it stops to shoot accurately, then relocates when threatened. basic tier: punish it while it is planting its feet.', { movementStyle: 'hold', aimAccuracy: 0.97, patience: 0.75 }],
    ['hound', 'hound', 'basic', 'standard', 'a relentless hunter that picks the weakest ship and hates letting go. basic tier: protect wounded teammates or it will finish them.', { movementStyle: 'approach', targetPriority: 'weakest', aggression: 0.9 }],
    ['wasp', 'wasp', 'basic', 'standard', 'a wide flanker that tries to attack from your side. basic tier: fragile pressure that punishes tunnel vision.', { movementStyle: 'flank', speed: 160 }],
    ['picket', 'picket', 'basic', 'standard', 'a simple formation fighter that stays near its friends. basic tier: weak alone, tidy and stubborn in a pack.', { movementStyle: 'hold', formation: 'line', cohesion: 0.8 }],
    ['lobber', 'lobber', 'basic', 'standard', 'it keeps its distance and throws slow explosives into your path. basic tier: move early or get boxed in.', { movementStyle: 'retreat', preferredMinRange: 480, preferredMaxRange: 720 }],
    ['flea', 'flea', 'basic', 'standard', 'a nervous little dodger with almost no staying power. basic tier: hard to hit, very easy to kill when caught.', { movementStyle: 'strafe', speed: 190, dodgeChance: 0.8, dodgeStrength: 1 }],
    ['undertow', 'undertow', 'basic', 'standard', 'a slow pressure ship that quietly pushes you out of safe space. basic tier: not flashy, but it makes every other enemy worse.', { movementStyle: 'approach', speed: 75, aggression: 0.8 }],
    ['sapper', 'sapper', 'specialist', 'standard', 'a mine layer that blocks the route you wanted to use. specialist tier: chase it carefully or fight inside its mess.', { movementStyle: 'retreat', specialAction: 'mine-layer' }],
    ['patcher', 'patcher', 'specialist', 'standard', 'a repair ship that keeps damaged enemies alive and runs when alone. specialist tier: kill the medic first, obviously.', { movementStyle: 'retreat', specialAction: 'support', targetPriority: 'ally-damaged' }],
    ['jammer', 'jammer', 'specialist', 'standard', 'a disabler that creates openings for its friends instead of winning alone. specialist tier: its team becomes nasty while you are shut down.', { movementStyle: 'hold', specialAction: 'disabler' }],
    ['nest', 'nest', 'specialist', 'standard', 'a drone carrier that avoids direct fights while filling space with helpers. specialist tier: the longer it lives, the busier the room gets.', { movementStyle: 'retreat', specialAction: 'deployer' }],
    ['shepherd', 'shepherd', 'specialist', 'standard', 'a command ship that pulls loose enemies into a clean formation. specialist tier: break it and the pack becomes easier to manage.', { movementStyle: 'hold', formation: 'wedge', cohesion: 1, specialAction: 'support' }],
    ['mirage', 'mirage', 'elite', 'miniboss', 'a stealth ambusher that hits hard and immediately disengages. elite tier: watch the warning, survive the strike, punish the escape.', { movementStyle: 'flank', specialAction: 'stealth-ambush', aggression: 0.85 }],
    ['aegis', 'aegis', 'elite', 'miniboss', 'a shield anchor that turns nearby enemies into a moving bunker. elite tier: go around it or crack the center.', { movementStyle: 'hold', specialAction: 'shield-anchor', formation: 'ring', cohesion: 1 }],
    ['switchblade', 'switchblade', 'elite', 'miniboss', 'a patient ranged fighter that becomes a close-range maniac at low health. elite tier: the second half is a different fight.', { movementStyle: 'retreat', specialAction: 'phase-switch', berserkHp: 0.5 }],
    ['executioner', 'executioner', 'elite', 'miniboss', 'a predictive hunter that focuses wounded ships and leads its shots. elite tier: heal or move unpredictably before it finishes you.', { movementStyle: 'flank', targetPriority: 'weakest', aimPrediction: 1, aimAccuracy: 0.98 }],
    ['corsair', 'corsair', 'elite', 'miniboss', 'an aggressive flanker that makes repeated attack runs instead of hugging you. elite tier: every pass is fair, fast, and mean.', { movementStyle: 'flank', aggression: 1, speed: 175 }],
    ['widowmaker', 'widowmaker', 'bastard', 'boss', 'a boss sniper that relocates after every shot. absolute bastard: standing still is consent to getting deleted.', { movementStyle: 'retreat', preferredMinRange: 750, preferredMaxRange: 1100, aimPrediction: 1, specialAction: 'phase-switch' }],
    ['grinder', 'grinder', 'bastard', 'boss', 'an armored boss rammer with a brutal charge and a long punishable recovery. absolute bastard: dodge late and become road paint.', { movementStyle: 'approach', preferredMinRange: 20, preferredMaxRange: 180, specialAction: 'rammer' }],
    ['choir', 'choir', 'bastard', 'boss', 'a command boss that coordinates, repairs, and empowers a whole pack. absolute bastard: the room stays organized until you silence it.', { movementStyle: 'hold', specialAction: 'support', formation: 'wedge', cohesion: 1 }],
    ['hive_tyrant', 'hive tyrant', 'bastard', 'boss', 'a boss carrier that deploys more drones as the fight gets desperate. absolute bastard: end it before the sky fills up.', { movementStyle: 'retreat', specialAction: 'deployer', panicHp: 0.45 }],
    ['black_sun', 'black sun', 'bastard', 'boss', 'a three-mood boss that zones, hunts, then goes feral near death. absolute bastard: learn each phase or repeat the lesson.', { movementStyle: 'hold', specialAction: 'phase-switch', panicHp: 0.6, berserkHp: 0.25 }]
];

function clamp(value, min, max, fallback) {
    return Number.isFinite(Number(value))
        ? Math.min(max, Math.max(min, Number(value)))
        : fallback;
}

function choice(value, choices, fallback) {
    return choices.includes(value) ? value : fallback;
}

function createDraft([id, name, tier, encounterRole, description, tuning]) {
    const stats = TIER_STATS[tier];
    return normalizeEnemyBlueprint({
        id,
        name,
        tier,
        encounterRole,
        description,
        combatReady: false,
        floor: { min: tier === 'basic' ? 1 : tier === 'specialist' ? 2 : tier === 'elite' ? 3 : 4, max: 99 },
        spawnWeight: tier === 'basic' ? 10 : tier === 'specialist' ? 5 : tier === 'elite' ? 2 : 1,
        parts: [],
        stats: { ...stats, radiusTiles: tier === 'bastard' ? 4 : tier === 'elite' ? 2.6 : 1.6, detectionDist: 1400 },
        behavior: { ...DEFAULT_BEHAVIOR, ...stats, ...tuning },
        rewards: tier === 'bastard'
            ? { xp: 500, gold: 25, score: 1000, drops: 10 }
            : tier === 'elite'
                ? { xp: 80, gold: 4, score: 150, drops: 4 }
                : tier === 'specialist'
                    ? { xp: 30, gold: 2, score: 50, drops: 3 }
                    : { xp: 20, gold: 1, score: 10, drops: 2 }
    });
}

export const BASE_ENEMY_BLUEPRINTS = Object.freeze(Object.fromEntries(
    CONCEPTS.map(concept => {
        const draft = createDraft(concept);
        return [draft.id, Object.freeze(draft)];
    })
));

let runtimeBlueprints = BASE_ENEMY_BLUEPRINTS;
export let EnemyBlueprints = runtimeBlueprints;

export function normalizeEnemyBlueprint(value, partsLibrary = PartsLibrary) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('enemy blueprint must be an object');
    }
    const id = String(value.id || '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) throw new Error('enemy blueprint has an invalid id');
    const tier = choice(value.tier, ENEMY_TIERS, 'basic');
    const encounterRole = choice(value.encounterRole, ENCOUNTER_ROLES, tier === 'bastard' ? 'boss' : 'standard');
    const parts = Array.isArray(value.parts) ? value.parts.map(part => {
        if (!part || !Object.hasOwn(partsLibrary, part.partId) ||
            ![part.x, part.y, part.rotation].every(Number.isInteger)) {
            throw new Error(`enemy blueprint ${id} has invalid part geometry`);
        }
        return { x: part.x, y: part.y, partId: part.partId, rotation: ((part.rotation % 4) + 4) % 4 };
    }) : [];
    if (parts.length > 64) throw new Error(`enemy blueprint ${id} has too many parts`);
    const floorMin = Math.round(clamp(value.floor?.min, 1, 99, 1));
    const floorMax = Math.round(clamp(value.floor?.max, floorMin, 99, 99));
    const sourceBehavior = value.behavior || {};
    const sourceStats = value.stats || {};
    const behavior = {
        movementStyle: choice(sourceBehavior.movementStyle, ENEMY_MOVEMENT_STYLES, DEFAULT_BEHAVIOR.movementStyle),
        orbitDirection: choice(sourceBehavior.orbitDirection, ['left', 'right', 'either'], 'either'),
        preferredMinRange: clamp(sourceBehavior.preferredMinRange, 0, 1800, DEFAULT_BEHAVIOR.preferredMinRange),
        preferredMaxRange: clamp(sourceBehavior.preferredMaxRange, 20, 2400, DEFAULT_BEHAVIOR.preferredMaxRange),
        speed: clamp(sourceBehavior.speed, 20, 500, sourceStats.speed || DEFAULT_BEHAVIOR.speed),
        acceleration: clamp(sourceBehavior.acceleration, 40, 3000, sourceStats.acceleration || DEFAULT_BEHAVIOR.acceleration),
        turnRate: clamp(sourceBehavior.turnRate, 0.2, 12, sourceStats.turnRate || DEFAULT_BEHAVIOR.turnRate),
        aggression: clamp(sourceBehavior.aggression, 0, 1, DEFAULT_BEHAVIOR.aggression),
        patience: clamp(sourceBehavior.patience, 0, 1, DEFAULT_BEHAVIOR.patience),
        dodgeChance: clamp(sourceBehavior.dodgeChance, 0, 1, DEFAULT_BEHAVIOR.dodgeChance),
        dodgeStrength: clamp(sourceBehavior.dodgeStrength, 0, 2, DEFAULT_BEHAVIOR.dodgeStrength),
        dodgeReaction: clamp(sourceBehavior.dodgeReaction, 0.05, 1.5, DEFAULT_BEHAVIOR.dodgeReaction),
        dodgeLookahead: clamp(sourceBehavior.dodgeLookahead, 0.1, 2.5, DEFAULT_BEHAVIOR.dodgeLookahead),
        aimPrediction: clamp(sourceBehavior.aimPrediction, 0, 1, DEFAULT_BEHAVIOR.aimPrediction),
        aimAccuracy: clamp(sourceBehavior.aimAccuracy, 0.2, 1, DEFAULT_BEHAVIOR.aimAccuracy),
        burstSize: Math.round(clamp(sourceBehavior.burstSize, 1, 20, DEFAULT_BEHAVIOR.burstSize)),
        burstPause: clamp(sourceBehavior.burstPause, 0, 5, DEFAULT_BEHAVIOR.burstPause),
        targetPriority: choice(sourceBehavior.targetPriority, ['nearest', 'weakest', 'strongest', 'ally-damaged'], 'nearest'),
        allySpacing: clamp(sourceBehavior.allySpacing, 20, 400, DEFAULT_BEHAVIOR.allySpacing),
        formation: choice(sourceBehavior.formation, ['loose', 'line', 'wedge', 'ring'], 'loose'),
        cohesion: clamp(sourceBehavior.cohesion, 0, 1, DEFAULT_BEHAVIOR.cohesion),
        panicHp: clamp(sourceBehavior.panicHp, 0, 1, DEFAULT_BEHAVIOR.panicHp),
        berserkHp: clamp(sourceBehavior.berserkHp, 0, 1, DEFAULT_BEHAVIOR.berserkHp),
        specialAction: choice(sourceBehavior.specialAction, ENEMY_SPECIAL_ACTIONS, 'none')
    };
    if (behavior.preferredMaxRange < behavior.preferredMinRange) {
        behavior.preferredMaxRange = behavior.preferredMinRange;
    }
    const stats = {
        maxHp: clamp(sourceStats.maxHp, 1, 100000, TIER_STATS[tier].maxHp),
        radiusTiles: clamp(sourceStats.radiusTiles, 0.4, 12, 1.6),
        speed: behavior.speed,
        acceleration: behavior.acceleration,
        turnRate: behavior.turnRate,
        detectionDist: clamp(sourceStats.detectionDist, 100, 5000, 1400),
        damageMultiplier: clamp(sourceStats.damageMultiplier, 0, 5, TIER_STATS[tier].damageMultiplier)
    };
    const rewards = {
        xp: Math.round(clamp(value.rewards?.xp, 0, 100000, 20)),
        gold: Math.round(clamp(value.rewards?.gold, 0, 10000, 1)),
        score: Math.round(clamp(value.rewards?.score, 0, 1000000, 10)),
        drops: Math.round(clamp(value.rewards?.drops, 0, 100, 2))
    };
    const normalized = {
        id,
        name: String(value.name || id).trim().slice(0, 64) || id,
        tier,
        encounterRole,
        description: String(value.description || '').trim().slice(0, 320),
        combatReady: Boolean(value.combatReady),
        floor: { min: floorMin, max: floorMax },
        spawnWeight: clamp(value.spawnWeight, 0, 1000, 1),
        parts,
        stats,
        behavior,
        rewards,
        weaponAimLock: Boolean(value.weaponAimLock)
    };
    if (normalized.combatReady) {
        const validation = validateCombatReadyBlueprint(normalized, partsLibrary);
        if (!validation.valid) throw new Error(`enemy blueprint ${id} is not combat ready: ${validation.errors.join(', ')}`);
    }
    return normalized;
}

export function validateCombatReadyBlueprint(blueprint, partsLibrary = PartsLibrary) {
    const errors = [];
    if (!blueprint.parts?.length) errors.push('ship has no parts');
    const cores = blueprint.parts?.filter(part => partsLibrary[part.partId]?.type === 'core') || [];
    if (cores.length !== 1) errors.push('ship needs exactly one core');
    const meaningful = blueprint.parts?.some(part => {
        const type = partsLibrary[part.partId]?.type;
        return type === 'weapon' || type === 'drone' || type === 'shield';
    });
    if (!meaningful && !['support', 'disabler', 'mine-layer'].includes(blueprint.behavior?.specialAction)) {
        errors.push('ship needs a weapon, drone, shield, or active support role');
    }
    const occupied = new Map();
    for (const part of blueprint.parts || []) {
        const def = partsLibrary[part.partId];
        if (!def) continue;
        const rotated = part.rotation % 2 !== 0;
        const width = rotated ? def.height : def.width;
        const height = rotated ? def.width : def.height;
        for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
            const key = `${part.x + x},${part.y + y}`;
            if (occupied.has(key)) errors.push(`parts overlap at ${key}`);
            occupied.set(key, part);
        }
    }
    if (occupied.size > 0 && cores.length === 1) {
        const visited = new Set();
        const first = occupied.keys().next().value;
        const stack = [first];
        while (stack.length) {
            const key = stack.pop();
            if (visited.has(key)) continue;
            visited.add(key);
            const [x, y] = key.split(',').map(Number);
            for (const next of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
                if (occupied.has(next) && !visited.has(next)) stack.push(next);
            }
        }
        if (visited.size !== occupied.size) errors.push('every part must connect to the ship');
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function applyEnemyBlueprintManifest(manifest, partsLibrary = PartsLibrary) {
    const entries = Array.isArray(manifest?.enemies) ? manifest.enemies : [];
    const merged = { ...BASE_ENEMY_BLUEPRINTS };
    for (const entry of entries) {
        if (!Object.hasOwn(BASE_ENEMY_BLUEPRINTS, entry?.id)) throw new Error('enemy manifest contains an unknown id');
        merged[entry.id] = normalizeEnemyBlueprint(entry, partsLibrary);
    }
    runtimeBlueprints = Object.freeze(merged);
    EnemyBlueprints = runtimeBlueprints;
    return EnemyBlueprints;
}

export function resetEnemyBlueprintManifest() {
    runtimeBlueprints = BASE_ENEMY_BLUEPRINTS;
    EnemyBlueprints = runtimeBlueprints;
}

export function getEnemyBlueprint(type, { allowDraft = false } = {}) {
    const selected = runtimeBlueprints[type];
    if (!selected || (!allowDraft && !selected.combatReady)) return null;
    return structuredClone(selected);
}

export function validateEnemyBlueprints(blueprints = runtimeBlueprints, partsLibrary = PartsLibrary) {
    const entries = Object.entries(blueprints);
    if (entries.length !== 30) throw new Error('enemy catalog must contain exactly 30 ships');
    for (const [id, definition] of entries) {
        if (id !== definition.id) throw new Error(`enemy blueprint ${id} has a mismatched id`);
        normalizeEnemyBlueprint(definition, partsLibrary);
        if (!definition.description) throw new Error(`enemy blueprint ${id} has no description`);
    }
    return true;
}

validateEnemyBlueprints();
