import { Viewport } from './rendering/Viewport.js';
import { WorldSurface } from './rendering/WorldSurface.js';
import { HudSurface } from './rendering/HudSurface.js';
import { WebGLCompositor } from './rendering/WebGLCompositor.js';

function findHudCanvas(worldCanvas) {
    return worldCanvas.parentElement?.querySelector?.('[data-render-surface="hud"]')
        || globalThis.document?.querySelector?.('#hudCanvas')
        || globalThis.document?.createElement?.('canvas');
}

/**
 * Game-facing rendering facade. World methods draw to an offscreen source;
 * HUD methods draw to a separate native-resolution canvas. Existing callers
 * keep using renderer.ctx, renderer.clear(), and renderer.present().
 */
export class Renderer {
    constructor(canvas, {
        hudCanvas = findHudCanvas(canvas),
        viewport = new Viewport(canvas),
        worldSurface = null,
        hudSurface = null,
        compositor = null,
        compositorOptions = {}
    } = {}) {
        this.canvas = canvas; // visible world compositor canvas, retained for legacy callers
        this.hudCanvas = hudCanvas;
        this.viewport = viewport;
        this.worldSurface = worldSurface || new WorldSurface(viewport);
        this.hudSurface = hudSurface || new HudSurface(hudCanvas, viewport);
        this.compositor = compositor || new WebGLCompositor(canvas, viewport, compositorOptions);
        this.resizeObservers = new Set();
        this.activeSurface = 'world';
        this.ctx = this.worldSurface.ctx;
        canvas.__frameboundViewport = viewport;
        this.resize();
        globalThis.window?.addEventListener?.('resize', () => this.resize());
    }

    resize() {
        this.canvas.style.width = '';
        this.canvas.style.height = '';
        this.viewport.resize();
        this.width = this.viewport.width;
        this.height = this.viewport.height;
        this.worldSurface.resize();
        this.hudSurface.resize();
        this.compositor.resize();
        const metrics = this.viewport.getRasterMetrics();
        if (this.canvas.dataset) {
            this.canvas.dataset.rasterScale = String(metrics.pixelScale);
            this.canvas.dataset.rasterLogical = metrics.logical;
            this.canvas.dataset.rasterPhysical = metrics.physical;
            this.canvas.dataset.rasterSource = metrics.source;
            this.canvas.dataset.rasterLogicalScale = String(metrics.logicalScale);
            this.canvas.dataset.rasterRemainder = metrics.remainder;
            this.canvas.dataset.rasterOffset = metrics.offset;
            this.canvas.dataset.rasterBackend = this.compositor.backend || 'fallback';
        }
        this.selectSurface(this.activeSurface);
        for (const observer of this.resizeObservers) observer(this.viewport);
    }

    onResize(observer) {
        this.resizeObservers.add(observer);
        return () => this.resizeObservers.delete(observer);
    }

    selectSurface(name) {
        this.activeSurface = name;
        this.ctx = name === 'hud' ? this.hudSurface.ctx : this.worldSurface.ctx;
        return this.ctx;
    }

    beginWorld() {
        return this.selectSurface('world');
    }

    beginHud() {
        return this.selectSurface('hud');
    }

    getDrawContext() {
        return this.ctx;
    }

    setBackgroundColor(color) {
        this.backgroundColor = color;
    }

    clear(color = '#000') {
        const clearColor = this.backgroundColor || color;
        const surface = this.activeSurface === 'hud' ? this.hudSurface : this.worldSurface;
        surface.clear(clearColor);
    }

    clearHud() {
        this.beginHud();
        this.hudSurface.clear();
    }

    // Legacy frame boundary: world source -> webgl compositor.
    present() {
        this.compositor.present(this.worldSurface.canvas);
    }

    withCamera(camera, drawOperation) {
        const ctx = this.getDrawContext();
        ctx.save();
        try {
            if (this.activeSurface === 'world') {
                const transform = this.viewport.getWorldCameraTransform(camera);
                ctx.setTransform(transform.scale, 0, 0, transform.scale, transform.x, transform.y);
            } else {
                if (camera.zoom) ctx.scale(camera.zoom, camera.zoom);
                ctx.translate(-camera.x, -camera.y);
            }
            drawOperation();
        } finally {
            ctx.restore();
        }
    }

    projectWorldToHud(worldX, worldY, camera) {
        return this.viewport.projectWorldToHud(worldX, worldY, camera);
    }

    withWorldOverlay(camera, drawOperation) {
        const ctx = this.beginHud();
        const transform = this.viewport.getWorldToHudTransform(camera);
        ctx.save();
        try {
            // Canvas transforms are physical pixels; the HUD surface's normal
            // DPR transform is intentionally replaced by this exact world map.
            ctx.setTransform(
                transform.scale * this.viewport.dpr,
                0,
                0,
                transform.scale * this.viewport.dpr,
                transform.x * this.viewport.dpr,
                transform.y * this.viewport.dpr
            );
            drawOperation();
        } finally {
            ctx.restore();
        }
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
