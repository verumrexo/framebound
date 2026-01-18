export class Grid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.color = 'rgba(255, 255, 255, 0.05)'; // Very dim white
    }

    draw(renderer, camera) {
        const ctx = renderer.ctx;
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
        for (let x = startX; x <= endX; x += this.cellSize) {
            renderer.drawLine(x, camera.y, x, camera.y + worldH, this.color, 1);
        }

        for (let y = startY; y <= endY; y += this.cellSize) {
            renderer.drawLine(camera.x, y, camera.x + worldW, y, this.color, 1);
        }
    }
}
