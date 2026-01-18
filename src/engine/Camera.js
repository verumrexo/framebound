export class Camera {
    constructor(width, height) {
        this.x = 0;
        this.y = 0;
        this.width = width;
        this.height = height;
        this.target = null;
        this.zoom = 0.6; // Warning: Game.js mouse calculations depend on this
    }

    follow(target) {
        this.target = target;
    }

    update(dt) {
        if (this.target) {
            // Calculate top-left based on zoomed world view
            // Visible World Width = Screen Width / Zoom
            const worldW = this.width / this.zoom;
            const worldH = this.height / this.zoom;

            this.x = this.target.x - worldW / 2;
            this.y = this.target.y - worldH / 2;
        }
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
    }
}
