// @ts-check

import { Sprite } from '../../engine/Sprite.js';
import { PartDef, PartType } from './PartDefinitions.js';

const CARRIER_COLORS = Object.freeze({ 1: '#26d426', 2: '#333333' });

/**
 * Convert an authored 0/1/2 row set into the flat sprite format used by the
 * runtime. The batch files intentionally stay data-only where possible, but
 * this adapter also accepts the older worker output forms while they are
 * being folded into the shared catalog.
 *
 * @param {string[]} rows
 * @returns {number[]}
 */
function rowsToPixels(rows) {
    return rows.flatMap(row => [...row].map(Number));
}

/**
 * @param {unknown} value
 * @returns {value is Sprite}
 */
function isSprite(value) {
    return value instanceof Sprite || Boolean(
        value && typeof value === 'object' &&
        Array.isArray(value.data) &&
        Number.isInteger(value.width) && Number.isInteger(value.height)
    );
}

/**
 * @param {unknown} value
 * @returns {string[] | null}
 */
function readRows(value) {
    if (!value || typeof value !== 'object') return null;
    const record = /** @type {Record<string, unknown>} */ (value);
    const rows = record.spriteRows || record.droneRows ||
        record.deployedDroneSilhouette || record.droneSilhouette;
    if (Array.isArray(rows)) return rows;
    if (isSprite(record.sprite)) {
        const sprite = /** @type {Sprite} */ (record.sprite);
        return Array.from({ length: sprite.height }, (_, row) =>
            sprite.data.slice(row * sprite.width, (row + 1) * sprite.width)
                .join('')
        );
    }
    return null;
}

/**
 * @param {unknown} spec
 * @returns {string[] | null}
 */
function readCarrierRows(spec) {
    if (!spec || typeof spec !== 'object') return null;
    const record = /** @type {Record<string, unknown>} */ (spec);
    const rows = record.spriteRows || record.carrierRows ||
        record.carrierSilhouette || record.carrier;
    if (Array.isArray(rows)) return rows;
    const silhouette = record.silhouette;
    if (silhouette && typeof silhouette === 'object') {
        const carrier = /** @type {Record<string, unknown>} */ (silhouette).carrier;
        if (Array.isArray(carrier)) return carrier;
    }
    return null;
}

/**
 * @param {unknown} spec
 * @param {string[]} rows
 * @param {Record<number, string>} colorMap
 * @returns {Sprite}
 */
function createSprite(spec, rows, colorMap) {
    if (isSprite(spec)) return /** @type {Sprite} */ (spec);
    const width = rows[0]?.length || 8;
    const height = rows.length;
    return new Sprite(rowsToPixels(rows), width, height, 4, colorMap);
}

/**
 * @param {unknown} spec
 * @returns {Sprite | null}
 */
export function createDroneSprite(
    spec,
    colorMap = { 1: '#00ffff', 2: '#177777' }
) {
    if (isSprite(spec)) return /** @type {Sprite} */ (spec);
    const rows = readRows(spec);
    return rows ? createSprite(spec, rows, colorMap) : null;
}

/**
 * @param {unknown} spec
 * @returns {Sprite | null}
 */
export function createCarrierSprite(spec) {
    if (isSprite(spec)) return /** @type {Sprite} */ (spec);
    if (spec && typeof spec === 'object') {
        const sprite = /** @type {Record<string, unknown>} */ (spec).sprite;
        if (isSprite(sprite)) return /** @type {Sprite} */ (sprite);
    }
    const rows = readCarrierRows(spec);
    return rows ? createSprite(spec, rows, CARRIER_COLORS) : null;
}

/**
 * @param {Record<string, unknown>} stats
 * @returns {Record<string, unknown>}
 */
function normalizeDroneStats(stats) {
    const normalized = { ...stats };
    const aliases = [
        ['spawnCooldown', 'droneSpawnCooldown'],
        ['capacity', 'droneCapacity'],
        ['damage', 'droneDamage'],
        ['attackCooldown', 'droneAttackCooldown']
    ];
    for (const [from, to] of aliases) {
        if (normalized[to] === undefined && normalized[from] !== undefined) {
            normalized[to] = normalized[from];
        }
        delete normalized[from];
    }
    return normalized;
}

/**
 * @param {Record<string, unknown>} spec
 * @returns {PartDef}
 */
export function createDronePartDefinition(spec) {
    const sprite = createCarrierSprite(spec);
    if (!sprite) throw new TypeError(`drone part ${String(spec.id)} has no sprite`);
    const partWidth = Number(spec.width);
    const partHeight = Number(spec.height);
    const expectedSpriteWidth = partWidth * 7 + 1;
    const expectedSpriteHeight = partHeight * 7 + 1;
    if (
        sprite.width !== expectedSpriteWidth ||
        sprite.height !== expectedSpriteHeight
    ) {
        throw new TypeError(
            `drone part ${String(spec.id)} sprite must be ` +
            `${expectedSpriteWidth}x${expectedSpriteHeight}`
        );
    }
    const definition = new PartDef(
        String(spec.id),
        String(spec.name),
        PartType.DRONE,
        sprite,
        normalizeDroneStats(/** @type {Record<string, unknown>} */ (spec.stats || {})),
        partWidth,
        partHeight
    );
    definition.baseSprite = sprite;
    definition.drawTurretInInventory = false;
    return definition;
}

/**
 * Normalize worker blueprint output into the runtime's one shape.
 *
 * @param {Record<string, unknown>} spec
 * @returns {Record<string, unknown>}
 */
export function normalizeDroneBlueprintSpec(spec) {
    const normalized = { ...spec };
    if (normalized.optimalDistance === undefined) {
        normalized.optimalDistance = normalized.optimalRange;
    }
    if (normalized.projectileLifetime === undefined) {
        normalized.projectileLifetime = normalized.lifetime;
    }
    if (normalized.spriteRows === undefined) {
        normalized.spriteRows = readRows(spec);
    }
    delete normalized.optimalRange;
    delete normalized.lifetime;
    delete normalized.attackCooldown;
    delete normalized.oneShot;
    delete normalized.droneRows;
    delete normalized.sprite;
    return normalized;
}

/**
 * @param {ReadonlyArray<Record<string, unknown>> | Record<string, Record<string, unknown>>} entries
 * @param {ReadonlyArray<Record<string, unknown>> | Record<string, Record<string, unknown>>} partEntries
 * @returns {Record<string, Record<string, unknown>>}
 */
export function indexDroneSpecs(entries, partEntries = []) {
    const iterable = Array.isArray(entries) ? entries : Object.values(entries);
    const blueprints = Object.fromEntries(iterable.map(spec => [
        String(spec.id), normalizeDroneBlueprintSpec(spec)
    ]));
    const parts = Array.isArray(partEntries)
        ? partEntries
        : Object.values(partEntries);
    for (const part of parts) {
        const stats = part.stats && typeof part.stats === 'object'
            ? /** @type {Record<string, unknown>} */ (part.stats)
            : {};
        const type = String(stats.droneType || '');
        const blueprint = blueprints[type];
        if (!blueprint || blueprint.spriteRows) continue;
        const rows = readRows(part);
        if (rows) blueprints[type] = { ...blueprint, spriteRows: rows };
    }
    return blueprints;
}

/**
 * @param {ReadonlyArray<Record<string, unknown>> | Record<string, Record<string, unknown>>} partSpecs
 * @param {ReadonlyArray<Record<string, unknown>> | Record<string, Record<string, unknown>>} blueprintSpecs
 * @returns {{ parts: Record<string, PartDef>, blueprints: Record<string, Record<string, unknown>> }}
 */
export function createDronePartCatalog(partSpecs, blueprintSpecs) {
    const partEntries = Array.isArray(partSpecs)
        ? partSpecs
        : Object.values(partSpecs);
    const parts = Object.fromEntries(partEntries.map(spec => [
        String(spec.id), createDronePartDefinition(spec)
    ]));
    return {
        parts,
        blueprints: indexDroneSpecs(blueprintSpecs, partEntries)
    };
}

export const DRONE_CARRIER_COLORS = CARRIER_COLORS;
