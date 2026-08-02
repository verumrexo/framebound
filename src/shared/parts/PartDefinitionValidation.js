import { PartType } from './PartDefinitions.js';

const PART_TYPES = new Set(Object.values(PartType));
const WEAPON_GROUPS = new Set(['velocity', 'laser', 'rocket', 'utility']);

/** @param {unknown} library */
export function validatePartsLibrary(library) {
    if (!isRecord(library)) {
        throw new TypeError('parts library must be an object');
    }

    for (const [libraryId, definition] of Object.entries(library)) {
        validatePartDefinition(libraryId, definition);
    }
    return true;
}

/**
 * @param {string} libraryId
 * @param {unknown} definition
 */
export function validatePartDefinition(libraryId, definition) {
    if (!isRecord(definition)) {
        throw new TypeError(`part ${libraryId} must be an object`);
    }
    if (definition.id !== libraryId) {
        throw new TypeError(`part ${libraryId} has a mismatched id`);
    }
    if (
        typeof definition.name !== 'string' ||
        definition.name.trim().length === 0
    ) {
        throw new TypeError(`part ${libraryId} must have a name`);
    }
    if (
        typeof definition.type !== 'string' ||
        !PART_TYPES.has(definition.type)
    ) {
        throw new TypeError(`part ${libraryId} has an unknown type`);
    }
    if (!positiveInteger(definition.width) || !positiveInteger(definition.height)) {
        throw new TypeError(`part ${libraryId} has invalid dimensions`);
    }
    if (!isRecord(definition.stats)) {
        throw new TypeError(`part ${libraryId} must have stats`);
    }

    validateStatValues(libraryId, definition.stats);
    requireNonNegativeNumber(libraryId, definition.stats, 'hp');
    requireNonNegativeNumber(libraryId, definition.stats, 'mass');

    if (definition.type === PartType.WEAPON) {
        requireNonNegativeNumber(libraryId, definition.stats, 'damage');
        if (!positiveNumber(definition.stats.cooldown)) {
            throw new TypeError(`weapon ${libraryId} must have a positive cooldown`);
        }
        if (
            definition.stats.weaponGroup !== undefined &&
            (
                typeof definition.stats.weaponGroup !== 'string' ||
                !WEAPON_GROUPS.has(definition.stats.weaponGroup)
            )
        ) {
            throw new TypeError(`weapon ${libraryId} has an unknown group`);
        }
    }

    return true;
}

/**
 * @param {string} libraryId
 * @param {Record<string, unknown>} stats
 */
function validateStatValues(libraryId, stats) {
    for (const [key, value] of Object.entries(stats)) {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new TypeError(`part ${libraryId} has a non-finite ${key} stat`);
        }
        if (isRecord(value)) {
            for (const nested of Object.values(value)) {
                if (typeof nested !== 'number' || !Number.isFinite(nested)) {
                    throw new TypeError(`part ${libraryId} has invalid ${key} config`);
                }
            }
        }
    }
}

/**
 * @param {string} libraryId
 * @param {Record<string, unknown>} stats
 * @param {string} key
 */
function requireNonNegativeNumber(libraryId, stats, key) {
    if (!nonNegativeNumber(stats[key])) {
        throw new TypeError(`part ${libraryId} must have a non-negative ${key}`);
    }
}

/** @param {unknown} value */
function positiveInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** @param {unknown} value */
function positiveNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** @param {unknown} value */
function nonNegativeNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
