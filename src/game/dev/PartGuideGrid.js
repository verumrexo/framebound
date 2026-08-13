import {
    PART_DESIGN_OVERLAP,
    PART_DESIGN_RESOLUTION
} from './PartDesignDocument.js';

export const GUIDE_GRID_MODES = Object.freeze([
    Object.freeze({ id: 'regular', label: 'regular · every pixel' }),
    Object.freeze({ id: 'every-4', label: 'emphasize every 4' }),
    Object.freeze({ id: 'every-8', label: 'emphasize every 8' }),
    Object.freeze({ id: 'cell', label: 'cell boundaries · 16px' })
]);

const GUIDE_GRID_IDS = new Set(GUIDE_GRID_MODES.map(mode => mode.id));

export function normalizeGuideGridMode(value) {
    return GUIDE_GRID_IDS.has(value) ? value : 'regular';
}

export function guideLineWeight(index, length, mode = 'regular', {
    resolution = PART_DESIGN_RESOLUTION,
    overlap = PART_DESIGN_OVERLAP
} = {}) {
    const normalized = normalizeGuideGridMode(mode);
    const atEdge = index === 0 || index === length;
    if (atEdge) return 2;
    if (normalized === 'regular') return 1;
    if (normalized === 'cell') {
        const stride = Math.max(1, resolution - overlap);
        const cellCount = Math.max(1, Math.round((length - overlap) / stride));
        // Overlapped cells have two boundaries around their shared pixel:
        // cell i starts at i * stride, while cell i - 1 ends one pixel later.
        // For a 31px two-cell raster that means x=15 and x=16.
        for (let cell = 1; cell < cellCount; cell++) {
            if (index === cell * stride || index === cell * stride + overlap) return 2;
        }
        return 0;
    }
    const stride = normalized === 'every-4' ? 4 : 8;
    return index % stride === 0 ? 2 : 1;
}

export function isGuideLineVisible(index, length, mode = 'regular', options = {}) {
    return guideLineWeight(index, length, mode, options) > 0;
}
