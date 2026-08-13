export const PART_RASTER_TOOLS = Object.freeze([
    'pencil', 'eraser', 'line', 'box', 'box-fill', 'fill'
]);

export function drawRasterStroke(pixels, width, height, tool, start, end, color, symmetry = {}) {
    const next = [...pixels];
    const paint = tool === 'eraser' ? 0 : color;
    const transforms = symmetryTransforms(width, height, symmetry);
    const seen = new Set();

    for (const transform of transforms) {
        const transformedStart = transform(start);
        const transformedEnd = transform(end);
        const operationKey = `${transformedStart.x},${transformedStart.y}:${transformedEnd.x},${transformedEnd.y}`;
        if (seen.has(operationKey)) continue;
        seen.add(operationKey);
        drawRasterStrokeOnce(next, width, height, tool, transformedStart, transformedEnd, paint);
    }
    return next;
}

function drawRasterStrokeOnce(pixels, width, height, tool, start, end, paint) {
    if (tool === 'fill') {
        floodFill(pixels, width, height, end.x, end.y, paint);
        return;
    }
    if (tool === 'line' || tool === 'pencil' || tool === 'eraser') {
        for (const point of rasterLine(start, end)) setPixel(pixels, width, height, point.x, point.y, paint);
        return;
    }
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        if (tool === 'box-fill' || x === minX || x === maxX || y === minY || y === maxY) {
            setPixel(pixels, width, height, x, y, paint);
        }
    }
}

function symmetryTransforms(width, height, symmetry = {}) {
    const leftRight = Boolean(symmetry.leftRight ?? symmetry.horizontal);
    const topBottom = Boolean(symmetry.topBottom ?? symmetry.vertical);
    const transforms = [point => ({ x: point.x, y: point.y })];
    if (leftRight) transforms.push(point => ({ x: width - 1 - point.x, y: point.y }));
    if (topBottom) transforms.push(point => ({ x: point.x, y: height - 1 - point.y }));
    if (leftRight && topBottom) transforms.push(point => ({ x: width - 1 - point.x, y: height - 1 - point.y }));
    return transforms;
}

export function rasterLine(start, end) {
    let x0 = Math.round(start.x);
    let y0 = Math.round(start.y);
    const x1 = Math.round(end.x);
    const y1 = Math.round(end.y);
    const points = [];
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
        points.push({ x: x0, y: y0 });
        if (x0 === x1 && y0 === y1) break;
        const twice = error * 2;
        if (twice >= dy) { error += dy; x0 += sx; }
        if (twice <= dx) { error += dx; y0 += sy; }
    }
    return points;
}

export function floodFill(pixels, width, height, x, y, replacement) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return pixels;
    const target = pixels[y * width + x];
    if (target === replacement) return pixels;
    const queue = [[x, y]];
    while (queue.length) {
        const [px, py] = queue.pop();
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const index = py * width + px;
        if (pixels[index] !== target) continue;
        pixels[index] = replacement;
        queue.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
    }
    return pixels;
}

export class RasterHistory {
    constructor(initial, limit = 80) {
        this.limit = limit;
        this.past = [];
        this.present = [...initial];
        this.future = [];
    }

    commit(pixels) {
        if (samePixels(this.present, pixels)) return this.present;
        this.past.push(this.present);
        if (this.past.length > this.limit) this.past.shift();
        this.present = [...pixels];
        this.future = [];
        return this.present;
    }

    undo() {
        if (!this.past.length) return this.present;
        this.future.push(this.present);
        this.present = this.past.pop();
        return [...this.present];
    }

    redo() {
        if (!this.future.length) return this.present;
        this.past.push(this.present);
        this.present = this.future.pop();
        return [...this.present];
    }
}

// part designer history stores the raster and the layer's geometry in the
// same snapshot. keeping this separate from RasterHistory preserves the
// small raster-only helper for other callers while making editor actions
// impossible to desynchronise.
export class LayerHistory {
    constructor(initial, limit = 80) {
        this.limit = limit;
        this.past = [];
        this.present = cloneHistoryValue(initial);
        this.future = [];
    }

    commit(snapshot) {
        if (sameHistoryValue(this.present, snapshot)) return cloneHistoryValue(this.present);
        this.past.push(cloneHistoryValue(this.present));
        if (this.past.length > this.limit) this.past.shift();
        this.present = cloneHistoryValue(snapshot);
        this.future = [];
        return cloneHistoryValue(this.present);
    }

    undo() {
        if (!this.past.length) return cloneHistoryValue(this.present);
        this.future.push(cloneHistoryValue(this.present));
        this.present = this.past.pop();
        return cloneHistoryValue(this.present);
    }

    redo() {
        if (!this.future.length) return cloneHistoryValue(this.present);
        this.past.push(cloneHistoryValue(this.present));
        this.present = this.future.pop();
        return cloneHistoryValue(this.present);
    }
}

function setPixel(pixels, width, height, x, y, value) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < width && y < height) pixels[y * width + x] = value;
}

function samePixels(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneHistoryValue(value) {
    if (Array.isArray(value)) return value.map(cloneHistoryValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneHistoryValue(entry)]));
    }
    return value;
}

function sameHistoryValue(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameHistoryValue(value, right[index]));
    }
    if (left && typeof left === 'object' || right && typeof right === 'object') {
        if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        return leftKeys.length === rightKeys.length && leftKeys.every(key => Object.hasOwn(right, key) && sameHistoryValue(left[key], right[key]));
    }
    return false;
}
