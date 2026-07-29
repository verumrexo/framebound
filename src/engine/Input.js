export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.keysPressed = new Set(); // Track newly pressed keys this frame
        this.mouse = { x: 0, y: 0, isDown: false, isRightDown: false };

        window.addEventListener('keydown', (e) => {
            if (!this.keys.has(e.code)) {
                this.keysPressed.add(e.code); // Only add if not already held
            }
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.resetActiveState());

        window.addEventListener('mousemove', (e) => {
            // regardless of any padding/margin/offset in the DOM.
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
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

    resetActiveState() {
        this.keys.clear();
        this.keysPressed.clear();
        this.mouse.isDown = false;
        this.mouse.isRightDown = false;

    }

    isKeyDown(code) {
        return this.keys.has(code);
    }

    isKeyPressed(code) {
        return this.keysPressed.has(code);
    }

    clearPressed() {
        this.keysPressed.clear();
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
