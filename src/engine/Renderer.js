export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Graphics settings
        this.smoothingEnabled = false;
        this.pixelatedCSS = true;
        this.resolutionScale = 1.0; // 0.25 to 1.0
        this.pixelSize = 1; // Default back to 1 per user request
        this.needsResize = false;

        // Offscreen buffer for resolution scaling
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = 1; // High DPI disabled due to coordinate mismatches

        // Logical size comes from the CSS layout
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;

        // Physical buffer size
        this.canvas.width = Math.floor(this.width * dpr);
        this.canvas.height = Math.floor(this.height * dpr);

        // Force CSS size to match the logical size exactly
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';

        // Scale context
        this.ctx.scale(dpr, dpr);

        // Resize offscreen canvas based on resolution scale
        this.offscreenCanvas.width = Math.floor(this.width * this.resolutionScale);
        this.offscreenCanvas.height = Math.floor(this.height * this.resolutionScale);

        // Apply current smoothing setting
        this.ctx.imageSmoothingEnabled = this.smoothingEnabled;
        this.offscreenCtx.imageSmoothingEnabled = this.smoothingEnabled;
    }

    setSmoothing(enabled) {
        this.smoothingEnabled = enabled;
        this.ctx.imageSmoothingEnabled = enabled;
        this.offscreenCtx.imageSmoothingEnabled = enabled;
    }

    setPixelation(enabled) {
        this.pixelatedCSS = enabled;
        this.canvas.style.imageRendering = enabled ? 'pixelated' : 'auto';
    }

    setResolutionScale(scale) {
        this.resolutionScale = Math.max(0.1, Math.min(1.0, scale));
        this.needsResize = true; // Defer resize to next frame to avoid breaking current draw
    }

    setPixelSize(size) {
        this.pixelSize = Math.max(1, Math.min(16, Math.floor(size)));
    }

    // Get the active drawing context (offscreen if scaling, main otherwise)
    getDrawContext() {
        if (this.resolutionScale < 1.0) {
            return this.offscreenCtx;
        }
        return this.ctx;
    }

    // Get scaled dimensions for drawing
    getScaledWidth() {
        return this.resolutionScale < 1.0 ? this.offscreenCanvas.width : this.width;
    }

    getScaledHeight() {
        return this.resolutionScale < 1.0 ? this.offscreenCanvas.height : this.height;
    }

    clear(color = '#000') {
        if (this.needsResize) {
            this.resize();
            this.needsResize = false;
        }

        if (this.resolutionScale < 1.0) {
            // Clear offscreen
            this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.offscreenCtx.fillStyle = color;
            this.offscreenCtx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        } else {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    // Call at end of frame to blit offscreen buffer to main canvas
    present() {
        if (this.resolutionScale < 1.0) {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.imageSmoothingEnabled = false; // Nearest neighbor upscale
            this.ctx.drawImage(
                this.offscreenCanvas,
                0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height,
                0, 0, this.width, this.height
            );
        }

        // Apply mosaic pixelation effect
        if (this.pixelSize > 1) {
            this.applyMosaic();
        }
    }

    applyMosaic() {
        const sw = Math.ceil(this.width / this.pixelSize);
        const sh = Math.ceil(this.height / this.pixelSize);

        // Draw smaller version to offscreen then scale back (Nearest Neighbor)
        this.offscreenCanvas.width = sw;
        this.offscreenCanvas.height = sh;
        this.offscreenCtx.imageSmoothingEnabled = false;
        this.offscreenCtx.drawImage(this.canvas, 0, 0, this.width, this.height, 0, 0, sw, sh);

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.offscreenCanvas, 0, 0, sw, sh, 0, 0, this.width, this.height);
    }

    withCamera(camera, drawOperation) {
        const ctx = this.getDrawContext();
        const scale = this.resolutionScale < 1.0 ? this.resolutionScale : 1.0;

        ctx.save();
        if (camera.zoom) {
            ctx.scale(camera.zoom * scale, camera.zoom * scale);
        } else if (scale !== 1.0) {
            ctx.scale(scale, scale);
        }
        ctx.translate(-camera.x, -camera.y);
        drawOperation();
        ctx.restore();
    }

    drawRect(x, y, w, h, color) {
        const ctx = this.getDrawContext();
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    }

    drawCircle(x, y, radius, color) {
        const ctx = this.getDrawContext();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
        const ctx = this.getDrawContext();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}
