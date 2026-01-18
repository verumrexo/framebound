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
        // Joysticks
        this.joysticks = {
            left: { active: false, id: null, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 }, vector: { x: 0, y: 0 } },
            right: { active: false, id: null, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 }, vector: { x: 0, y: 0 } }
        };

        // Touch Events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
    }

    handleTouchStart(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;

            // Divide screen in half
            if (x < rect.width / 2) {
                if (!this.joysticks.left.active) {
                    this.joysticks.left.active = true;
                    this.joysticks.left.id = t.identifier;
                    this.joysticks.left.origin = { x, y };
                    this.joysticks.left.current = { x, y };
                    this.joysticks.left.vector = { x: 0, y: 0 };
                }
            } else {
                if (!this.joysticks.right.active) {
                    this.joysticks.right.active = true;
                    this.joysticks.right.id = t.identifier;
                    this.joysticks.right.origin = { x, y };
                    this.joysticks.right.current = { x, y };
                    this.joysticks.right.vector = { x: 0, y: 0 };
                }
            }
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (t.identifier === this.joysticks.left.id) {
                const x = t.clientX - rect.left;
                const y = t.clientY - rect.top;
                this.updateJoystick(this.joysticks.left, x, y);
            } else if (t.identifier === this.joysticks.right.id) {
                const x = t.clientX - rect.left;
                const y = t.clientY - rect.top;
                this.updateJoystick(this.joysticks.right, x, y);
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === this.joysticks.left.id) {
                this.joysticks.left.active = false;
                this.joysticks.left.id = null;
                this.joysticks.left.vector = { x: 0, y: 0 };
            }
            if (t.identifier === this.joysticks.right.id) {
                this.joysticks.right.active = false;
                this.joysticks.right.id = null;
                this.joysticks.right.vector = { x: 0, y: 0 };
            }
        }
    }

    updateJoystick(stick, x, y) {
        stick.current = { x, y };
        const maxDist = 50;
        let dx = x - stick.origin.x;
        let dy = y - stick.origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Clamp visual puck
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
            stick.current.x = stick.origin.x + dx;
            stick.current.y = stick.origin.y + dy;
        }

        // Normalize vector (-1 to 1)
        stick.vector = {
            x: dx / maxDist,
            y: dy / maxDist
        };
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
