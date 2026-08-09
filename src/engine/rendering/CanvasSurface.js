function configureContext(ctx, viewport) {
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
}

/** A 2d surface with a logical coordinate system and a native physical buffer. */
export class CanvasSurface {
    constructor(canvas, viewport) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.ctx = canvas.getContext('2d');
    }

    resize() {
        this.canvas.width = this.viewport.physicalWidth;
        this.canvas.height = this.viewport.physicalHeight;
        configureContext(this.ctx, this.viewport);
    }

    clear(color = 'transparent') {
        const { width, height } = this.viewport;
        this.ctx.save();
        this.ctx.setTransform(this.viewport.dpr, 0, 0, this.viewport.dpr, 0, 0);
        if (color === 'transparent') {
            this.ctx.clearRect(0, 0, width, height);
        } else {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, 0, width, height);
        }
        this.ctx.restore();
    }
}
