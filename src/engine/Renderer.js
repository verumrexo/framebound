export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Graphics settings
        this.smoothingEnabled = false;
        this.pixelatedCSS = true;
        this.resolutionScale = 1.0; // 0.25 to 1.0
        this.crtEffect = false;
        this.ditherEffect = false;
        this.chromaticAberration = false;

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
        this.resize();
    }

    setCRTEffect(enabled) {
        this.crtEffect = enabled;
        const scanlines = document.getElementById('scanlines');
        const crtOverlay = document.getElementById('crt-overlay');

        if (enabled) {
            // Enable scanlines
            if (scanlines) scanlines.style.display = 'block';

            // Create CRT overlay if it doesn't exist
            if (!crtOverlay) {
                const overlay = document.createElement('div');
                overlay.id = 'crt-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    pointer-events: none;
                    z-index: 9998;
                    background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%);
                    mix-blend-mode: multiply;
                `;
                document.body.appendChild(overlay);
            } else {
                crtOverlay.style.display = 'block';
            }

            // Add slight barrel distortion via CSS
            this.canvas.style.transform = 'perspective(1000px) rotateX(1deg)';
            this.canvas.style.borderRadius = '8px';
        } else {
            if (crtOverlay) crtOverlay.style.display = 'none';
            this.canvas.style.transform = 'none';
            this.canvas.style.borderRadius = '0';
        }
    }

    setChromaticAberration(enabled) {
        this.chromaticAberration = enabled;
        // Applied during render if enabled
    }

    setDitherEffect(enabled) {
        this.ditherEffect = enabled;
        // Applied during render if enabled
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

        // Apply dither effect (simple posterization)
        if (this.ditherEffect) {
            this.applyDither();
        }

        // Apply chromatic aberration
        if (this.chromaticAberration) {
            this.applyChromaticAberration();
        }
    }

    applyDither() {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        const levels = 8; // Color levels per channel (lower = more retro)
        const factor = 255 / (levels - 1);

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / factor) * factor;     // R
            data[i + 1] = Math.round(data[i + 1] / factor) * factor; // G
            data[i + 2] = Math.round(data[i + 2] / factor) * factor; // B
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    applyChromaticAberration() {
        // Simple RGB offset effect
        const offset = 2;
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        const copy = new Uint8ClampedArray(data);

        for (let y = 0; y < this.height; y++) {
            for (let x = offset; x < this.width - offset; x++) {
                const i = (y * this.width + x) * 4;
                const iLeft = (y * this.width + (x - offset)) * 4;
                const iRight = (y * this.width + (x + offset)) * 4;

                data[i] = copy[iLeft];       // R from left
                data[i + 2] = copy[iRight + 2]; // B from right
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
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
