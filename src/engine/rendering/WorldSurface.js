import { CanvasSurface } from './CanvasSurface.js';

/** Hidden 2d source. Only this canvas is ever uploaded to the compositor. */
export class WorldSurface extends CanvasSurface {
    constructor(viewport, { canvas = document.createElement('canvas') } = {}) {
        super(canvas, viewport);
        canvas.className = 'world-source-surface';
        canvas.setAttribute?.('aria-hidden', 'true');
    }

    resize() {
        this.canvas.width = this.viewport.worldSourceWidth;
        this.canvas.height = this.viewport.worldSourceHeight;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.setTransform(
            this.viewport.worldLogicalScale,
            0,
            0,
            this.viewport.worldLogicalScale,
            this.viewport.worldSourceInsetX,
            this.viewport.worldSourceInsetY
        );
    }

    clear(color = '#000') {
        const {
            width,
            height,
            worldLogicalScale,
            worldSourceInsetX,
            worldSourceInsetY
        } = this.viewport;
        this.ctx.save();
        this.ctx.setTransform(
            worldLogicalScale,
            0,
            0,
            worldLogicalScale,
            worldSourceInsetX,
            worldSourceInsetY
        );
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.restore();
    }
}
