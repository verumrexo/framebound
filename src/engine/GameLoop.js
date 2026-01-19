export class GameLoop {
    constructor(updateFn, drawFn) {
        this.updateFn = updateFn;
        this.drawFn = drawFn;
        this.lastTime = 0;
        this.isRunning = false;
        this.rafId = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    stop() {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
    }

    loop(currentTime) {
        if (!this.isRunning) return;

        let deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap delta time to avoid physics explosions during lag spikes
        if (deltaTime > 0.05) deltaTime = 0.05;

        this.updateFn(deltaTime);
        this.drawFn();

        this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
}
