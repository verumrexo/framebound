export class PlayerStateGuard {
    constructor(game, warn = console.warn) {
        this.game = game;
        this.warn = warn;
    }

    repairNonFiniteState() {
        const game = this.game;

        if (!Number.isFinite(game.vx)) game.vx = 0;
        if (!Number.isFinite(game.vy)) game.vy = 0;

        if (!Number.isFinite(game.x) || !Number.isFinite(game.y)) {
            this.warn('Position corruption detected! Resetting to spawn.');
            game.x = 1000;
            game.y = 1000;
            game.vx = 0;
            game.vy = 0;
        }

        if (!Number.isFinite(game.rotation)) {
            this.warn('Rotation corruption! Resetting.');
            game.rotation = 0;
        }
    }
}
