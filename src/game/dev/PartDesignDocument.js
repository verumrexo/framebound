import {
    DEFAULT_PROJECTILE_LOOK,
    DEFAULT_PROJECTILE_TRAIL,
    normalizeProjectileLook,
    normalizeProjectileTrail
} from '../../shared/combat/ProjectileVisuals.js';

const FORMAT = 'framebound-part-design';
const VERSION = 2;
const LEGACY_VERSION = 1;
const RESOLUTION = 16;
const OVERLAP = 1;
const LEGACY_V2_OVERLAP = 2;
const MAX_NAME_LENGTH = 64;
const MAX_NOTES_LENGTH = 2000;
const MAX_PALETTE_COLORS = 16;
const BLUEPRINT_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const SUPPORTED_FOOTPRINTS = new Set(['1x1', '1x2', '2x1', '2x2', '2x4', '4x2']);
const SUPPORTED_BASE_FOOTPRINTS = new Set(['1x1', '1x2', '2x2', '2x4']);
const SUPPORTED_TYPES = new Set([
    'hull', 'weapon', 'thruster', 'accelerant', 'rocket_bay', 'booster',
    'drone', 'shield', 'utility', 'core'
]);
const DEFAULT_PALETTE = Object.freeze([
    '#26d426', '#333333', '#f2f5ff', '#4a9eff',
    '#ff9944', '#b56cff', '#00ffff', '#ff4f78'
]);

export const PART_DESIGN_FORMAT = FORMAT;
export const PART_DESIGN_VERSION = VERSION;
export const PART_DESIGN_RESOLUTION = RESOLUTION;
export const PART_DESIGN_OVERLAP = OVERLAP;
export const PART_DESIGN_DEFAULT_PALETTE = DEFAULT_PALETTE;

export function gridDimensions(
    width,
    height,
    resolution = RESOLUTION,
    overlap = resolution === RESOLUTION ? OVERLAP : 1
) {
    assertFootprint(width, height, resolution === RESOLUTION ? SUPPORTED_FOOTPRINTS : SUPPORTED_BASE_FOOTPRINTS);
    return {
        width: width * resolution - (width - 1) * overlap,
        height: height * resolution - (height - 1) * overlap
    };
}

export function createBlankPartDesign({
    name = 'my part',
    type = 'hull',
    width = 1,
    height = 1,
    turretWidth = width,
    turretHeight = height,
    palette = DEFAULT_PALETTE
} = {}) {
    assertFootprint(width, height, SUPPORTED_BASE_FOOTPRINTS);
    const grid = gridDimensions(width, height);
    const turretGrid = gridDimensions(turretWidth, turretHeight);
    return {
        format: FORMAT,
        version: VERSION,
        resolution: RESOLUTION,
        name,
        type,
        footprint: { width, height },
        grid,
        turretFootprint: { width: turretWidth, height: turretHeight },
        turretGrid,
        palette: [...palette],
        layers: {
            base: new Array(grid.width * grid.height).fill(0),
            turret: null
        },
        anchors: {
            base: null,
            turret: null
        },
        muzzles: [],
        projectileLook: DEFAULT_PROJECTILE_LOOK,
        projectileTrail: DEFAULT_PROJECTILE_TRAIL,
        coreEffect: null,
        drone: null,
        stats: {},
        notes: ''
    };
}

export function parsePartDesign(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('part design is empty');
    let value;
    try { value = JSON.parse(text); } catch { throw new Error('part design must be valid json'); }
    return normalizePartDesign(value);
}

export function serializePartDesign(value) {
    return JSON.stringify(normalizePartDesign(value), null, 2);
}

export function normalizePartDesign(value) {
    if (!isPlainObject(value)) throw new Error('part design must be an object');
    if (value.format !== FORMAT) throw new Error('unsupported part design format');
    if (value.version === LEGACY_VERSION) return normalizeLegacyPartDesign(value);
    if (value.version !== VERSION) throw new Error('unsupported part design format');

    // v2 shipped briefly with a two-authored-pixel seam. Normalize those
    // documents in memory when they are opened or saved; the source draft is
    // not rewritten until the caller explicitly persists it.
    value = migrateLegacyV2Overlap(value);

    const name = cleanText(value.name, MAX_NAME_LENGTH, 'part name');
    const type = cleanText(value.type, 32, 'part type');
    if (!SUPPORTED_TYPES.has(type)) throw new Error(`unsupported part type: ${type}`);
    if (value.resolution !== RESOLUTION) throw new Error(`part resolution must be ${RESOLUTION}`);

    const footprint = normalizeFootprint(value.footprint, 'part footprint', SUPPORTED_BASE_FOOTPRINTS);
    const grid = gridDimensions(footprint.width, footprint.height);
    assertGrid(value.grid, grid, 'part grid');
    const turretFootprint = normalizeFootprint(
        value.turretFootprint || footprint,
        'turret footprint',
        SUPPORTED_FOOTPRINTS
    );
    const turretGrid = gridDimensions(turretFootprint.width, turretFootprint.height);
    assertGrid(value.turretGrid || turretGrid, turretGrid, 'turret grid');

    const palette = normalizePalette(value.palette);
    if (!isPlainObject(value.layers)) throw new Error('part layers are missing');
    const base = normalizePixels(value.layers.base, grid.width * grid.height, palette.length, 'base');
    const turret = value.layers.turret === null || value.layers.turret === undefined
        ? null
        : normalizePixels(value.layers.turret, turretGrid.width * turretGrid.height, palette.length, 'turret');
    if (turret && type !== 'weapon') throw new Error('turret art requires weapon type');

    const anchors = isPlainObject(value.anchors) ? value.anchors : {};
    const baseAnchor = normalizePoint(anchors.base, grid, 'base mount');
    const turretAnchor = normalizePoint(anchors.turret, turretGrid, 'turret pivot');
    const muzzles = normalizePoints(value.muzzles || [], turretGrid, 'muzzle', 16);
    if ((turretAnchor || muzzles.length) && !turret) {
        throw new Error('turret pivot and muzzles require turret art');
    }

    const coreEffect = Object.hasOwn(value, 'coreEffect')
        ? normalizeRasterVisual(value.coreEffect, 'core effect', null)
        : undefined;
    const drone = normalizeDroneVisual(value.drone, type);

    return {
        format: FORMAT,
        version: VERSION,
        resolution: RESOLUTION,
        name,
        type,
        footprint,
        grid,
        turretFootprint,
        turretGrid,
        palette,
        layers: { base, turret },
        anchors: { base: baseAnchor, turret: turretAnchor },
        muzzles,
        projectileLook: normalizeProjectileLook(value.projectileLook),
        projectileTrail: normalizeProjectileTrail(value.projectileTrail),
        ...(coreEffect === undefined ? {} : { coreEffect }),
        drone,
        stats: normalizeJsonObject(value.stats ?? {}, 'stats'),
        notes: cleanOptionalText(value.notes, MAX_NOTES_LENGTH, 'notes')
    };
}

export function upgradeLegacyPartDesign(value) {
    const legacy = value?.version === LEGACY_VERSION
        ? normalizeLegacyPartDesign(value)
        : normalizeLegacyPartDesign(JSON.parse(serializePartDesign(value)));
    const upgraded = createBlankPartDesign({
        name: legacy.name,
        type: legacy.type,
        width: legacy.footprint.width,
        height: legacy.footprint.height,
        palette: ['#26d426', '#333333']
    });
    // 2x upscaling produces the historical v2 30/58 seam. Let the same
    // non-destructive v2 migration below expand it to the current 31/61
    // contract before the upgraded document is returned.
    upgraded.grid = gridDimensions(
        legacy.footprint.width,
        legacy.footprint.height,
        RESOLUTION,
        LEGACY_V2_OVERLAP
    );
    upgraded.turretGrid = { ...upgraded.grid };
    upgraded.layers.base = upscalePixels2x(legacy.layers.base, legacy.grid);
    if (legacy.layers.turret) {
        upgraded.layers.turret = upscalePixels2x(legacy.layers.turret, legacy.grid);
        upgraded.anchors.turret = scalePoint(legacy.anchors.turret, 2);
        const barrel = legacy.barrel;
        if (barrel) upgraded.muzzles = [scalePoint(barrel, 2)];
    }
    upgraded.anchors.base = scalePoint(legacy.anchors.base, 2);
    upgraded.projectileLook = legacy.projectileLook;
    upgraded.projectileTrail = legacy.projectileTrail;
    upgraded.stats = clone(legacy.stats);
    upgraded.notes = legacy.notes;
    if (legacy.coreEffect) {
        upgraded.coreEffect = {
            resolution: RESOLUTION,
            grid: { width: RESOLUTION, height: RESOLUTION },
            palette: [legacy.coreEffect.color],
            layers: { base: upscalePixels2x(legacy.coreEffect.layers.base, { width: 8, height: 8 }) }
        };
    }
    if (legacy.drone) {
        upgraded.drone = {
            blueprintId: legacy.drone.blueprintId,
            resolution: RESOLUTION,
            grid: { width: RESOLUTION, height: RESOLUTION },
            palette: ['#00ffff', '#177777'],
            layers: { base: upscalePixels2x(legacy.drone.layers.base, { width: 8, height: 8 }) },
            projectileLook: legacy.drone.projectileLook,
            projectileTrail: legacy.drone.projectileTrail
        };
    }
    return normalizePartDesign(upgraded);
}

function normalizeLegacyPartDesign(value) {
    const name = cleanText(value.name, MAX_NAME_LENGTH, 'part name');
    const type = cleanText(value.type, 32, 'part type');
    const allowedLegacyTypes = new Set([...SUPPORTED_TYPES].filter(entry => entry !== 'utility' && entry !== 'core'));
    if (!allowedLegacyTypes.has(type)) throw new Error(`unsupported part type: ${type}`);
    const footprint = normalizeFootprint(value.footprint, 'part footprint', SUPPORTED_BASE_FOOTPRINTS);
    const grid = gridDimensions(footprint.width, footprint.height, 8);
    assertGrid(value.grid, grid, 'part grid');
    if (!isPlainObject(value.layers)) throw new Error('part layers are missing');
    const base = normalizePixels(value.layers.base, grid.width * grid.height, 2, 'base');
    const turret = value.layers.turret === null || value.layers.turret === undefined
        ? null
        : normalizePixels(value.layers.turret, grid.width * grid.height, 2, 'turret');
    if (turret && type !== 'weapon') throw new Error('turret art requires weapon type');
    const anchors = isPlainObject(value.anchors) ? value.anchors : {};
    const baseAnchor = normalizePoint(anchors.base, grid, 'base anchor');
    const turretAnchor = normalizePoint(anchors.turret, grid, 'turret anchor');
    const barrel = normalizePoint(value.barrel, grid, 'barrel');
    if ((turretAnchor || barrel) && !turret) throw new Error('turret anchor and barrel require turret art');
    const rotationOffset = Number(value.rotationOffset ?? 0);
    if (!Number.isFinite(rotationOffset)) throw new Error('rotation offset must be finite');
    const coreEffect = Object.hasOwn(value, 'coreEffect') ? normalizeLegacyCoreEffect(value.coreEffect) : undefined;
    return {
        format: FORMAT,
        version: LEGACY_VERSION,
        name,
        type,
        footprint,
        grid,
        layers: { base, turret },
        anchors: { base: baseAnchor, turret: turretAnchor },
        barrel,
        rotationOffset,
        projectileLook: normalizeProjectileLook(value.projectileLook),
        projectileTrail: normalizeProjectileTrail(value.projectileTrail),
        ...(coreEffect === undefined ? {} : { coreEffect }),
        drone: normalizeLegacyDrone(value.drone, type),
        stats: normalizeJsonObject(value.stats ?? {}, 'stats'),
        notes: cleanOptionalText(value.notes, MAX_NOTES_LENGTH, 'notes')
    };
}

function normalizeLegacyCoreEffect(value) {
    if (value === null) return null;
    if (!isPlainObject(value)) throw new Error('core effect must be an object or null');
    const grid = { width: 8, height: 8 };
    assertGrid(value.grid, grid, 'core effect grid');
    if (!isPlainObject(value.layers)) throw new Error('core effect layers are missing');
    const color = normalizeColor(value.color, 'core effect color');
    return { grid, layers: { base: normalizePixels(value.layers.base, 64, 1, 'core effect base') }, color };
}

function normalizeLegacyDrone(value, type) {
    if (value === null || value === undefined) return null;
    if (type !== 'drone') throw new Error('drone visual requires drone type');
    if (!isPlainObject(value) || typeof value.blueprintId !== 'string' || !BLUEPRINT_ID.test(value.blueprintId)) {
        throw new Error('drone visual blueprint id is invalid');
    }
    const grid = { width: 8, height: 8 };
    assertGrid(value.grid, grid, 'drone visual grid');
    const layers = isPlainObject(value.layers) ? value.layers : {};
    return {
        blueprintId: value.blueprintId,
        grid,
        layers: { base: normalizePixels(layers.base, 64, 2, 'drone base') },
        projectileLook: normalizeProjectileLook(value.projectileLook),
        projectileTrail: normalizeProjectileTrail(value.projectileTrail)
    };
}

function normalizeRasterVisual(value, label, requiredId) {
    if (value === null) return null;
    if (!isPlainObject(value)) throw new Error(`${label} must be an object or null`);
    if (value.resolution !== RESOLUTION) throw new Error(`${label} resolution must be ${RESOLUTION}`);
    const grid = { width: RESOLUTION, height: RESOLUTION };
    assertGrid(value.grid, grid, `${label} grid`);
    const palette = normalizePalette(value.palette);
    if (!isPlainObject(value.layers)) throw new Error(`${label} layers are missing`);
    const result = {
        resolution: RESOLUTION,
        grid,
        palette,
        layers: { base: normalizePixels(value.layers.base, RESOLUTION * RESOLUTION, palette.length, `${label} base`) }
    };
    if (requiredId) result.blueprintId = requiredId;
    return result;
}

function normalizeDroneVisual(value, type) {
    if (value === null || value === undefined) return null;
    if (type !== 'drone') throw new Error('drone visual requires drone type');
    if (!isPlainObject(value) || typeof value.blueprintId !== 'string' || !BLUEPRINT_ID.test(value.blueprintId)) {
        throw new Error('drone visual blueprint id is invalid');
    }
    return {
        ...normalizeRasterVisual(value, 'drone visual', value.blueprintId),
        projectileLook: normalizeProjectileLook(value.projectileLook),
        projectileTrail: normalizeProjectileTrail(value.projectileTrail)
    };
}

function migrateLegacyV2Overlap(value) {
    const footprint = value.footprint;
    if (!isSupportedFootprint(footprint, SUPPORTED_BASE_FOOTPRINTS)) return value;

    const baseOldGrid = gridDimensions(
        footprint.width,
        footprint.height,
        RESOLUTION,
        LEGACY_V2_OVERLAP
    );
    const baseNewGrid = gridDimensions(footprint.width, footprint.height);
    const baseIsLegacy = sameGrid(value.grid, baseOldGrid);
    const baseIsCurrent = sameGrid(value.grid, baseNewGrid);
    if (!baseIsLegacy && baseIsCurrent) {
        // The base is already current, but a separately authored turret may
        // still be an old 30/58 document. Handle that below.
    } else if (!baseIsLegacy) {
        return value;
    }

    const turretFootprint = isSupportedFootprint(
        value.turretFootprint || footprint,
        SUPPORTED_FOOTPRINTS
    )
        ? (value.turretFootprint || footprint)
        : footprint;
    const turretOldGrid = gridDimensions(
        turretFootprint.width,
        turretFootprint.height,
        RESOLUTION,
        LEGACY_V2_OVERLAP
    );
    const turretNewGrid = gridDimensions(
        turretFootprint.width,
        turretFootprint.height
    );
    const turretIsLegacy = sameGrid(value.turretGrid, turretOldGrid) ||
        (!value.turretGrid && Array.isArray(value.layers?.turret) &&
            value.layers.turret.length === turretOldGrid.width * turretOldGrid.height);
    const needsBaseMigration = baseIsLegacy;
    const needsTurretMigration = turretIsLegacy;
    if (!needsBaseMigration && !needsTurretMigration) return value;

    const migrated = clone(value);
    if (needsBaseMigration) {
        migrated.grid = baseNewGrid;
        if (Array.isArray(migrated.layers?.base)) {
            migrated.layers.base = expandV2Raster(
                migrated.layers.base,
                baseOldGrid,
                footprint
            );
        }
        if (isPlainObject(migrated.anchors) && migrated.anchors.base) {
            migrated.anchors.base = migrateV2Point(
                migrated.anchors.base,
                baseOldGrid,
                baseNewGrid,
                footprint
            );
        }
    }
    if (needsTurretMigration) {
        migrated.turretGrid = turretNewGrid;
        if (Array.isArray(migrated.layers?.turret)) {
            migrated.layers.turret = expandV2Raster(
                migrated.layers.turret,
                turretOldGrid,
                turretFootprint
            );
        }
        if (isPlainObject(migrated.anchors) && migrated.anchors.turret) {
            migrated.anchors.turret = migrateV2Point(
                migrated.anchors.turret,
                turretOldGrid,
                turretNewGrid,
                turretFootprint
            );
        }
        if (Array.isArray(migrated.muzzles)) {
            migrated.muzzles = migrated.muzzles.map(point =>
                migrateV2Point(point, turretOldGrid, turretNewGrid, turretFootprint)
            );
        }
    }
    return migrated;
}

function expandV2Raster(pixels, oldGrid, footprint) {
    const seamColumns = seamPositions(footprint.width, RESOLUTION, LEGACY_V2_OVERLAP);
    const seamRows = seamPositions(footprint.height, RESOLUTION, LEGACY_V2_OVERLAP);
    const expanded = [];
    for (let y = 0; y < oldGrid.height; y++) {
        const row = [];
        for (let x = 0; x < oldGrid.width; x++) {
            const pixel = pixels[y * oldGrid.width + x];
            // The old seam already belongs to authored art. Duplicate its
            // nearest source pixel instead of inventing a transparent scar.
            if (seamColumns.has(x)) row.push(pixel);
            row.push(pixel);
        }
        expanded.push(...row);
        // As above, duplicate the completed source row so both axes remain
        // lossless for filled and patterned legacy rasters.
        if (seamRows.has(y)) expanded.push(...row);
    }
    return expanded;
}

function migrateV2Point(point, oldGrid, newGrid, footprint) {
    return {
        x: migrateV2Coordinate(point.x, oldGrid.width, newGrid.width, footprint.width),
        y: migrateV2Coordinate(point.y, oldGrid.height, newGrid.height, footprint.height)
    };
}

function migrateV2Coordinate(value, oldSize, newSize, tiles) {
    if (!Number.isFinite(value)) return value;
    if (Math.abs(value - oldSize / 2) < 1e-9) return newSize / 2;
    const seams = seamPositions(tiles, RESOLUTION, LEGACY_V2_OVERLAP);
    return value + [...seams].filter(seam => value >= seam).length;
}

function seamPositions(tiles, resolution, overlap) {
    return new Set(Array.from(
        { length: Math.max(0, tiles - 1) },
        (_, index) => (index + 1) * (resolution - overlap)
    ));
}

function sameGrid(first, second) {
    return isPlainObject(first) && first.width === second.width && first.height === second.height;
}

function isSupportedFootprint(value, allowed) {
    return isPlainObject(value) &&
        Number.isInteger(value.width) &&
        Number.isInteger(value.height) &&
        allowed.has(`${value.width}x${value.height}`);
}

function normalizeFootprint(value, label, allowed) {
    if (!isPlainObject(value)) throw new Error(`${label} is missing`);
    assertFootprint(value.width, value.height, allowed);
    return { width: value.width, height: value.height };
}

function assertFootprint(width, height, allowed = SUPPORTED_FOOTPRINTS) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || !allowed.has(`${width}x${height}`)) {
        throw new Error(`unsupported part footprint: ${width}x${height}`);
    }
}

function assertGrid(value, expected, label) {
    if (!isPlainObject(value) || value.width !== expected.width || value.height !== expected.height) {
        throw new Error(`${label} does not match its footprint`);
    }
}

function normalizePalette(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PALETTE_COLORS) {
        throw new Error(`palette must contain 1-${MAX_PALETTE_COLORS} colors`);
    }
    return value.map((color, index) => normalizeColor(color, `palette color ${index + 1}`));
}

function normalizeColor(value, label) {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
        throw new Error(`${label} must be #RRGGBB`);
    }
    return value.toLowerCase();
}

function normalizePixels(value, expectedLength, maxIndex, label) {
    if (!Array.isArray(value) || value.length !== expectedLength) {
        throw new Error(`${label} layer has the wrong pixel count`);
    }
    return value.map(pixel => {
        if (!Number.isInteger(pixel) || pixel < 0 || pixel > maxIndex) {
            throw new Error(`${label} layer contains an invalid pixel`);
        }
        return pixel;
    });
}

function normalizePoints(value, grid, label, max) {
    if (!Array.isArray(value) || value.length > max) throw new Error(`${label}s must be a list of at most ${max}`);
    return value.map((point, index) => normalizePoint(point, grid, `${label} ${index + 1}`));
}

function normalizePoint(value, grid, label) {
    if (value === null || value === undefined) return null;
    if (!isPlainObject(value)) throw new Error(`${label} must be a point`);
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 ||
        x > grid.width || y > grid.height || !Number.isInteger(x * 2) || !Number.isInteger(y * 2)) {
        throw new Error(`${label} is outside the design grid`);
    }
    return { x, y };
}

function upscalePixels2x(pixels, grid) {
    const width = grid.width * 2;
    const height = grid.height * 2;
    const result = new Array(width * height).fill(0);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        const pixel = pixels[y * grid.width + x];
        const target = (y * 2) * width + x * 2;
        result[target] = pixel;
        result[target + 1] = pixel;
        result[target + width] = pixel;
        result[target + width + 1] = pixel;
    }
    return result;
}

function scalePoint(point, factor) {
    return point ? { x: point.x * factor, y: point.y * factor } : null;
}

function normalizeJsonObject(value, label) {
    if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
    return normalizeJsonValue(value, label);
}

function normalizeJsonValue(value, path) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error(`${path} must be finite`);
        return value;
    }
    if (Array.isArray(value)) return value.map((entry, index) => normalizeJsonValue(entry, `${path}[${index}]`));
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
    if (!clean || clean.length > maxLength) throw new Error(`${label} must be 1-${maxLength} characters`);
    return clean;
}

function cleanOptionalText(value, maxLength, label) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${label} must be at most ${maxLength} characters`);
    return value;
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
