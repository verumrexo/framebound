import {
    DEFAULT_PROJECTILE_LOOK,
    DEFAULT_PROJECTILE_TRAIL,
    normalizeProjectileLook,
    normalizeProjectileTrail
} from '../../shared/combat/ProjectileVisuals.js';

const FORMAT = 'framebound-part-design';
const VERSION = 1;
const MAX_NAME_LENGTH = 64;
const MAX_NOTES_LENGTH = 2000;
const DRONE_GRID = Object.freeze({ width: 8, height: 8 });
const DRONE_BLUEPRINT_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const SUPPORTED_FOOTPRINTS = new Set(['1x1', '1x2', '2x2', '2x4']);
const SUPPORTED_TYPES = new Set([
    'hull',
    'weapon',
    'thruster',
    'accelerant',
    'rocket_bay',
    'booster',
    'drone',
    'shield'
]);

export const PART_DESIGN_FORMAT = FORMAT;
export const PART_DESIGN_VERSION = VERSION;

export function gridDimensions(width, height) {
    assertFootprint(width, height);
    return {
        width: width * 8 - (width - 1),
        height: height * 8 - (height - 1)
    };
}

export function createBlankPartDesign({
    name = 'my part',
    type = 'hull',
    width = 1,
    height = 1
} = {}) {
    const grid = gridDimensions(width, height);
    return {
        format: FORMAT,
        version: VERSION,
        name,
        type,
        footprint: { width, height },
        grid,
        layers: {
            base: new Array(grid.width * grid.height).fill(0),
            turret: null
        },
        anchors: {
            base: null,
            turret: null
        },
        barrel: null,
        rotationOffset: 0,
        projectileLook: DEFAULT_PROJECTILE_LOOK,
        projectileTrail: DEFAULT_PROJECTILE_TRAIL,
        drone: null,
        stats: {},
        notes: ''
    };
}

export function parsePartDesign(text) {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('part design is empty');
    }

    let value;
    try {
        value = JSON.parse(text);
    } catch {
        throw new Error('part design must be valid json');
    }
    return normalizePartDesign(value);
}

export function serializePartDesign(value) {
    return JSON.stringify(normalizePartDesign(value), null, 2);
}

export function normalizePartDesign(value) {
    if (!isPlainObject(value)) {
        throw new Error('part design must be an object');
    }
    if (value.format !== FORMAT || value.version !== VERSION) {
        throw new Error('unsupported part design format');
    }

    const name = cleanText(value.name, MAX_NAME_LENGTH, 'part name');
    const type = cleanText(value.type, 32, 'part type');
    if (!SUPPORTED_TYPES.has(type)) {
        throw new Error(`unsupported part type: ${type}`);
    }

    const footprint = value.footprint;
    if (!isPlainObject(footprint)) {
        throw new Error('part footprint is missing');
    }
    const width = footprint.width;
    const height = footprint.height;
    const grid = gridDimensions(width, height);

    if (
        !isPlainObject(value.grid) ||
        value.grid.width !== grid.width ||
        value.grid.height !== grid.height
    ) {
        throw new Error('part grid does not match its footprint');
    }

    if (!isPlainObject(value.layers)) {
        throw new Error('part layers are missing');
    }
    const expectedLength = grid.width * grid.height;
    const base = normalizePixels(value.layers.base, expectedLength, 'base');
    const turret = value.layers.turret === null || value.layers.turret === undefined
        ? null
        : normalizePixels(value.layers.turret, expectedLength, 'turret');

    if (turret && type !== 'weapon') {
        throw new Error('turret art requires weapon type');
    }

    const anchors = isPlainObject(value.anchors) ? value.anchors : {};
    const baseAnchor = normalizePoint(
        anchors.base,
        grid.width,
        grid.height,
        'base anchor'
    );
    const turretAnchor = normalizePoint(
        anchors.turret,
        grid.width,
        grid.height,
        'turret anchor'
    );
    const barrel = normalizePoint(
        value.barrel,
        grid.width,
        grid.height,
        'barrel'
    );

    if ((turretAnchor || barrel) && !turret) {
        throw new Error('turret anchor and barrel require turret art');
    }

    const rotationOffset = Number(value.rotationOffset ?? 0);
    if (!Number.isFinite(rotationOffset)) {
        throw new Error('rotation offset must be finite');
    }

    const projectileLook = normalizeProjectileLook(value.projectileLook);
    const projectileTrail = normalizeProjectileTrail(value.projectileTrail);
    const drone = normalizeDroneVisual(value.drone, type);

    const stats = normalizeJsonObject(value.stats ?? {}, 'stats');
    const notes = cleanOptionalText(value.notes, MAX_NOTES_LENGTH, 'notes');

    return {
        format: FORMAT,
        version: VERSION,
        name,
        type,
        footprint: { width, height },
        grid,
        layers: { base, turret },
        anchors: {
            base: baseAnchor,
            turret: turretAnchor
        },
        barrel,
        rotationOffset,
        projectileLook,
        projectileTrail,
        drone,
        stats,
        notes
    };
}

export function normalizeDroneVisual(value, partType = 'drone') {
    if (value === null || value === undefined) return null;
    if (partType !== 'drone') throw new Error('drone visual requires drone type');
    if (!isPlainObject(value) || typeof value.blueprintId !== 'string' || !DRONE_BLUEPRINT_ID.test(value.blueprintId)) {
        throw new Error('drone visual blueprint id is invalid');
    }
    if (!isPlainObject(value.grid) || value.grid.width !== DRONE_GRID.width || value.grid.height !== DRONE_GRID.height) {
        throw new Error('drone visual grid must be 8x8');
    }
    const layers = isPlainObject(value.layers) ? value.layers : {};
    const pixels = normalizePixels(layers.base, DRONE_GRID.width * DRONE_GRID.height, 'drone base');
    return {
        blueprintId: value.blueprintId,
        grid: { ...DRONE_GRID },
        layers: { base: pixels },
        projectileLook: normalizeProjectileLook(value.projectileLook),
        projectileTrail: normalizeProjectileTrail(value.projectileTrail)
    };
}

function assertFootprint(width, height) {
    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        !SUPPORTED_FOOTPRINTS.has(`${width}x${height}`)
    ) {
        throw new Error(`unsupported part footprint: ${width}x${height}`);
    }
}

function normalizePixels(value, expectedLength, label) {
    if (!Array.isArray(value) || value.length !== expectedLength) {
        throw new Error(`${label} layer has the wrong pixel count`);
    }
    return value.map(pixel => {
        if (!Number.isInteger(pixel) || pixel < 0 || pixel > 2) {
            throw new Error(`${label} layer contains an invalid pixel`);
        }
        return pixel;
    });
}

function normalizePoint(value, maxX, maxY, label) {
    if (value === null || value === undefined) return null;
    if (!isPlainObject(value)) throw new Error(`${label} must be a point`);
    const x = Number(value.x);
    const y = Number(value.y);
    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x > maxX ||
        y > maxY ||
        !Number.isInteger(x * 2) ||
        !Number.isInteger(y * 2)
    ) {
        throw new Error(`${label} is outside the design grid`);
    }
    return { x, y };
}

function normalizeJsonObject(value, label) {
    if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
    return normalizeJsonValue(value, label);
}

function normalizeJsonValue(value, path) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error(`${path} must be finite`);
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry, index) =>
            normalizeJsonValue(entry, `${path}[${index}]`)
        );
    }
    if (isPlainObject(value)) {
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            if (!key || key.length > 64) throw new Error(`${path} has an invalid key`);
            result[key] = normalizeJsonValue(entry, `${path}.${key}`);
        }
        return result;
    }
    throw new Error(`${path} is not serializable`);
}

function cleanText(value, maxLength, label) {
    if (typeof value !== 'string') throw new Error(`${label} must be text`);
    const clean = value.trim();
    if (!clean || clean.length > maxLength) {
        throw new Error(`${label} must be 1-${maxLength} characters`);
    }
    return clean;
}

function cleanOptionalText(value, maxLength, label) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string' || value.length > maxLength) {
        throw new Error(`${label} must be at most ${maxLength} characters`);
    }
    return value;
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
