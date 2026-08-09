export class Input {
    constructor(canvas, { viewport = canvas?.__frameboundViewport } = {}) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.keys = new Set();
        this.keysPressed = new Set(); // Track newly pressed keys this frame
        this.mouse = {
            x: 0,
            y: 0,
            isDown: false,
            isRightDown: false,
            wasPressed: false,
            wasRightPressed: false
        };

        window.addEventListener('keydown', (e) => {
            if (!this.keys.has(e.code)) {
                this.keysPressed.add(e.code); // Only add if not already held
            }
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.resetActiveState());

        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Physical buffers can be DPR-sized while gameplay remains in
            // logical coordinates. Never leak that ratio into aiming.
            if (this.viewport) {
                const point = this.viewport.clientToLogical(e.clientX, e.clientY, rect);
                this.mouse.x = point.x;
                this.mouse.y = point.y;
            } else {
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                this.mouse.x = (e.clientX - rect.left) * scaleX;
                this.mouse.y = (e.clientY - rect.top) * scaleY;
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                if (!this.mouse.isDown) this.mouse.wasPressed = true;
                this.mouse.isDown = true;
            }
            if (e.button === 2) {
                if (!this.mouse.isRightDown) this.mouse.wasRightPressed = true;
                this.mouse.isRightDown = true;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.isDown = false;
            if (e.button === 2) this.mouse.isRightDown = false;
        });

        // Prevent context menu
        window.addEventListener('contextmenu', e => e.preventDefault());
    }

    resetActiveState() {
        this.keys.clear();
        this.keysPressed.clear();
        this.mouse.isDown = false;
        this.mouse.isRightDown = false;
        this.mouse.wasPressed = false;
        this.mouse.wasRightPressed = false;

    }

    isKeyDown(code) {
        return this.keys.has(code);
    }

    isKeyPressed(code) {
        return this.keysPressed.has(code);
    }

    clearPressed() {
        this.keysPressed.clear();
        this.mouse.wasPressed = false;
        this.mouse.wasRightPressed = false;
    }

    isMouseDown() {
        return this.mouse.isDown || this.mouse.wasPressed;
    }

    isRightMouseDown() {
        return this.mouse.isRightDown || this.mouse.wasRightPressed;
    }

    getMousePos() {
        return { ...this.mouse };
    }
}
