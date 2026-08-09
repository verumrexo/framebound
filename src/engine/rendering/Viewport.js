/**
 * The one coordinate contract shared by presentation and input.  Game code
 * continues to use logical CSS pixels; buffers use physical device pixels.
 */
export class Viewport {
    constructor(canvas, {
        getDevicePixelRatio = () => globalThis.window?.devicePixelRatio || 1,
        worldPixelScale = 3
    } = {}) {
        this.canvas = canvas;
        this.getDevicePixelRatio = getDevicePixelRatio;
        this.worldPixelScale = Math.max(1, Math.round(worldPixelScale));
        this.width = 1;
        this.height = 1;
        this.dpr = 1;
        this.physicalWidth = 1;
        this.physicalHeight = 1;
        this.worldSourceWidth = 1;
        this.worldSourceHeight = 1;
        this.worldPhysicalWidth = 1;
        this.worldPhysicalHeight = 1;
        this.worldOffsetX = 0;
        this.worldOffsetY = 0;
        this.worldLogicalScale = 1;
        this.worldSourceInsetX = 0;
        this.worldSourceInsetY = 0;
    }

    resize() {
        const cssWidth = this.canvas.clientWidth || globalThis.window?.innerWidth || 1;
        const cssHeight = this.canvas.clientHeight || globalThis.window?.innerHeight || 1;
        this.width = Math.max(1, Math.round(cssWidth));
        this.height = Math.max(1, Math.round(cssHeight));
        this.dpr = Math.max(1, Number(this.getDevicePixelRatio()) || 1);
        this.physicalWidth = Math.max(1, Math.round(this.width * this.dpr));
        this.physicalHeight = Math.max(1, Math.round(this.height * this.dpr));
        // The source is deliberately smaller than the presentation buffer.
        // Every source pixel expands to an integer physical block; the tiny
        // unused remainder is centered instead of being stretched.
        const sourceCapacityWidth = Math.max(1, Math.floor(this.physicalWidth / this.worldPixelScale));
        const sourceCapacityHeight = Math.max(1, Math.floor(this.physicalHeight / this.worldPixelScale));
        // One source-to-logical ratio prevents a one-pixel remainder from
        // stretching the world differently on each axis.
        this.worldLogicalScale = Math.min(
            sourceCapacityWidth / this.width,
            sourceCapacityHeight / this.height
        );
        this.worldSourceWidth = Math.max(1, Math.ceil(this.width * this.worldLogicalScale));
        this.worldSourceHeight = Math.max(1, Math.ceil(this.height * this.worldLogicalScale));
        this.worldPhysicalWidth = this.worldSourceWidth * this.worldPixelScale;
        this.worldPhysicalHeight = this.worldSourceHeight * this.worldPixelScale;
        this.worldOffsetX = Math.floor((this.physicalWidth - this.worldPhysicalWidth) / 2);
        this.worldOffsetY = Math.floor((this.physicalHeight - this.worldPhysicalHeight) / 2);
        // World code still speaks logical pixels. This is only the source
        // surface's presentation transform, never a camera or input scale.
        this.worldSourceInsetX = (this.worldSourceWidth - this.width * this.worldLogicalScale) / 2;
        this.worldSourceInsetY = (this.worldSourceHeight - this.height * this.worldLogicalScale) / 2;
        return this;
    }

    /** Convert browser client coordinates back into stable game coordinates. */
    clientToLogical(clientX, clientY, rect = this.canvas.getBoundingClientRect()) {
        const width = rect.width || this.width;
        const height = rect.height || this.height;
        return {
            x: (clientX - rect.left) * this.width / width,
            y: (clientY - rect.top) * this.height / height
        };
    }

    /** Source-space transform; continuous simulation stays continuous on screen. */
    getWorldCameraTransform(camera) {
        const zoom = Number(camera?.zoom) || 1;
        const scale = this.worldLogicalScale * zoom;
        const rawX = this.worldSourceInsetX - scale * (Number(camera?.x) || 0);
        const rawY = this.worldSourceInsetY - scale * (Number(camera?.y) || 0);
        return {
            scale,
            x: rawX,
            y: rawY
        };
    }

    getWorldToHudTransform(camera) {
        const source = this.getWorldCameraTransform(camera);
        return {
            scale: source.scale * this.worldPixelScale / this.dpr,
            x: (this.worldOffsetX + source.x * this.worldPixelScale) / this.dpr,
            y: (this.worldOffsetY + source.y * this.worldPixelScale) / this.dpr
        };
    }

    projectWorldToHud(worldX, worldY, camera) {
        const transform = this.getWorldToHudTransform(camera);
        return {
            x: transform.x + Number(worldX || 0) * transform.scale,
            y: transform.y + Number(worldY || 0) * transform.scale,
            scale: transform.scale
        };
    }

    getRasterMetrics() {
        return {
            logical: `${this.width}x${this.height}`,
            physical: `${this.physicalWidth}x${this.physicalHeight}`,
            source: `${this.worldSourceWidth}x${this.worldSourceHeight}`,
            pixelScale: this.worldPixelScale,
            logicalScale: this.worldLogicalScale,
            remainder: `${this.physicalWidth - this.worldPhysicalWidth}x${this.physicalHeight - this.worldPhysicalHeight}`,
            offset: `${this.worldOffsetX}x${this.worldOffsetY}`
        };
    }
}
