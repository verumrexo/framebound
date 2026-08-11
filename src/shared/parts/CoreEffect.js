import { Sprite } from '../../engine/Sprite.js';

export const CORE_EFFECT_GRID = Object.freeze({ width: 8, height: 8 });
export const DEFAULT_CORE_EFFECT_COLOR = '#55ccff';
export const CORE_EFFECT_PIXELS = Object.freeze([
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 0, 1, 1, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0
]);

const CORE_EFFECT_COLOR = /^#[0-9a-fA-F]{6}$/;

export function createCoreEffectSprite(
    color = DEFAULT_CORE_EFFECT_COLOR,
    pixels = CORE_EFFECT_PIXELS,
    scale = 4
) {
    if (!CORE_EFFECT_COLOR.test(color)) throw new Error('core effect color must be #RRGGBB');
    if (!Array.isArray(pixels) || pixels.length !== 64 || pixels.some(pixel => pixel !== 0 && pixel !== 1)) {
        throw new Error('core effect pixels must be 64 binary values');
    }
    return new Sprite([...pixels], CORE_EFFECT_GRID.width, CORE_EFFECT_GRID.height, scale, { 1: color });
}

export function coreEffectRotation(baseRotation = 0, now = Date.now()) {
    return baseRotation + ((now % 10000) * 0.003);
}

export function coreEffectFromSprite(sprite) {
    if (!sprite || sprite.width !== CORE_EFFECT_GRID.width || sprite.height !== CORE_EFFECT_GRID.height) {
        throw new Error('core effect sprite must be 8x8');
    }
    const pixels = Array.from({ length: 64 }, (_, index) => sprite.data[index]);
    if (pixels.some(pixel => pixel !== 0 && pixel !== 1)) {
        throw new Error('core effect sprite contains invalid pixels');
    }
    const color = sprite.colorMap?.[1];
    if (typeof color !== 'string' || !CORE_EFFECT_COLOR.test(color)) {
        throw new Error('core effect sprite has an invalid color');
    }
    return {
        grid: { ...CORE_EFFECT_GRID },
        layers: { base: pixels },
        color: color.toLowerCase()
    };
}
