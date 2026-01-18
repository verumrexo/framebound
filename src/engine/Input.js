export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.mouse = { x: 0, y: 0, isDown: false };

        window.addEventListener('keydown', (e) => this.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));

        window.addEventListener('mousemove', (e) => {
            // We use getBoundingClientRect to ensure we are relative to the canvas,
            // regardless of any padding/margin/offset in the DOM.
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouse.isDown = true;
            if (e.button === 2) this.mouse.isRightDown = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.isDown = false;
            if (e.button === 2) this.mouse.isRightDown = false;
        });

        // Prevent context menu
        window.addEventListener('contextmenu', e => e.preventDefault());
    }

    isKeyDown(code) {
        return this.keys.has(code);
    }

    isMouseDown() {
        return this.mouse.isDown;
    }

    isRightMouseDown() {
        return this.mouse.isRightDown;
    }

    getMousePos() {
        return { ...this.mouse };
    }
}
