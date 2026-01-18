export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = 1; // High DPI disabled due to coordinate mismatches

        // Logical size comes from the CSS layout (which is 100% of window)
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;

        // Physical buffer size
        this.canvas.width = Math.floor(this.width * dpr);
        this.canvas.height = Math.floor(this.height * dpr);

        // Force CSS size to match the logical size exactly (integer pixels)
        // This prevents sub-pixel layout issues at different zoom levels
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';

        // Scale context
        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;
    }

    clear(color = '#000') {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform identity
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    withCamera(camera, drawOperation) {
        this.ctx.save();
        if (camera.zoom) {
            this.ctx.scale(camera.zoom, camera.zoom);
        }
        this.ctx.translate(-camera.x, -camera.y);
        drawOperation();
        this.ctx.restore();
    }

    drawRect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);
    }

    drawCircle(x, y, radius, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }
}
