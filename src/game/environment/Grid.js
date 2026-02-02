export class Grid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.color = '#00ffff';
    }

    setColor(color) {
        this.color = color;
    }

    draw(renderer, camera, alpha = 0.05) {
        const ctx = renderer.getDrawContext();
        // Allow color to be hex or rgb, if it's hex we need to add alpha manually or use globalAlpha.
        // Easier: assume this.color is a hex string, and we set strokeStyle with globalAlpha?
        // Or if this.color is passed as 'rgba(...)', use it.
        // Current implementation was: `rgba(0, 255, 255, ${alpha})` hardcoded.

        // Let's store base color (e.g. '#00ffff') and apply alpha.
        // If we want to support hex + alpha, we can use ctx.globalAlpha = alpha.

        ctx.save();
        ctx.strokeStyle = this.color || '#00ffff';
        ctx.globalAlpha = alpha;
        // Visible world range depends on zoom
        const zoom = camera.zoom || 1;
        const worldW = renderer.width / zoom;
        const worldH = renderer.height / zoom;

        // Determine the range of lines to draw in World Space
        const startX = Math.floor(camera.x / this.cellSize) * this.cellSize;
        const startY = Math.floor(camera.y / this.cellSize) * this.cellSize;

        const endX = camera.x + worldW + this.cellSize;
        const endY = camera.y + worldH + this.cellSize;

        // Draw lines using world coordinates
        // renderer.drawLine already handles ctx.beginPath etc.
        // Since we are inside withCamera, coordinates are World.

        // Wait, renderer.drawLine creates its own path and sets style? 
        // Yes: ctx.strokeStyle = color;
        // So globalAlpha works, but we need to pass the color to drawLine.

        for (let x = startX; x <= endX; x += this.cellSize) {
            renderer.drawLine(x, camera.y, x, camera.y + worldH, this.color, 1);
        }

        for (let y = startY; y <= endY; y += this.cellSize) {
            renderer.drawLine(camera.x, y, camera.x + worldW, y, this.color, 1);
        }

        ctx.restore();
    }
}
