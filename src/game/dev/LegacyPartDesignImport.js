import { parsePartStatsLiteral } from './PartStatsParser.js';
import { createBlankPartDesign, normalizePartDesign } from './PartDesignDocument.js';

const SPRITE_PATTERN = /new Sprite\(\s*(\[[0-9,\s]+\])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*4\s*,\s*\{[^}]*\}(?:\s*,\s*([-0-9.]+)\s*,\s*([-0-9.]+))?\s*\)/g;

export function parseLegacyPartDesign(source) {
    if (typeof source !== 'string' || !source.trim()) {
        throw new Error('legacy part code is empty');
    }

    const sprites = [...source.matchAll(SPRITE_PATTERN)].map(match => ({
        pixels: JSON.parse(match[1]),
        width: Number(match[2]),
        height: Number(match[3]),
        anchor: match[4] === undefined
            ? null
            : { x: Number(match[4]) * Number(match[2]), y: Number(match[5]) * Number(match[3]) }
    }));
    if (sprites.length === 0) throw new Error('no sprite data found in legacy code');

    const definition = source.match(
        /new PartDef\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*PartType\.([A-Z_]+)/
    );
    const type = definition ? definition[2].toLowerCase() : sprites.length > 1 ? 'weapon' : 'hull';
    const isWeapon = type === 'weapon' && sprites.length > 1;
    const art = isWeapon ? sprites[0] : sprites.at(-1);
    const base = isWeapon ? sprites[1] : sprites.at(-1);
    const footprint = inferFootprint(source, art.width, art.height);
    const design = createBlankPartDesign({
        name: definition?.[1] || 'imported part',
        type,
        ...footprint
    });

    if (art.width !== design.grid.width || art.height !== design.grid.height) {
        throw new Error('legacy sprite dimensions do not match a supported footprint');
    }
    design.layers.base = [...base.pixels];
    design.anchors.base = base.anchor;
    if (isWeapon) {
        design.layers.turret = [...art.pixels];
        design.anchors.turret = art.anchor;
    }

    const stats = extractStats(source, footprint.width, footprint.height);
    design.stats = stats;
    const rotation = source.match(/rotationOffset\s*=\s*([-0-9.]+)/);
    design.rotationOffset = rotation ? Number(rotation[1]) : 0;

    if (isWeapon && stats.barrelPosition) {
        const pivot = design.anchors.turret || {
            x: design.grid.width / 2,
            y: design.grid.height / 2
        };
        design.barrel = {
            x: pivot.x + Number(stats.barrelPosition.x || 0) / 4,
            y: pivot.y + Number(stats.barrelPosition.y || 0) / 4
        };
    }

    return normalizePartDesign(design);
}

function inferFootprint(source, gridWidth, gridHeight) {
    const candidates = [...source.matchAll(/,\s*(1|2)\s*,\s*(1|2|4)\s*\)/g)];
    const last = candidates.at(-1);
    if (last) return { width: Number(last[1]), height: Number(last[2]) };
    const dimensions = new Map([
        ['8x8', { width: 1, height: 1 }],
        ['8x15', { width: 1, height: 2 }],
        ['15x15', { width: 2, height: 2 }],
        ['15x29', { width: 2, height: 4 }]
    ]);
    const footprint = dimensions.get(`${gridWidth}x${gridHeight}`);
    if (!footprint) throw new Error('unsupported legacy grid size');
    return footprint;
}

function extractStats(source, width, height) {
    const partDefIndex = source.indexOf('new PartDef(');
    if (partDefIndex < 0) return defaultStats(width, height);
    const sizePattern = new RegExp(`,\\s*${width}\\s*,\\s*${height}\\s*\\)`);
    const sizeMatch = sizePattern.exec(source.slice(partDefIndex));
    if (!sizeMatch) return defaultStats(width, height);
    const end = partDefIndex + sizeMatch.index;

    let depth = 0;
    for (let index = end - 1; index >= partDefIndex; index--) {
        if (source[index] === '}') depth++;
        if (source[index] !== '{') continue;
        depth--;
        if (depth !== 0) continue;
        const literal = source.slice(index, end).trim().replace(/,$/, '').trim();
        const parsed = parsePartStatsLiteral(literal);
        if (parsed) return parsed;
    }
    return defaultStats(width, height);
}

function defaultStats(width, height) {
    return { hp: 20 * width * height, mass: 2 * width * height };
}
