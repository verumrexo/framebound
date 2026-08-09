import { CanvasSurface } from './CanvasSurface.js';

/** Transparent, native-resolution canvas. It deliberately bypasses WebGL. */
export class HudSurface extends CanvasSurface {
    constructor(canvas, viewport) {
        super(canvas, viewport);
    }
}
