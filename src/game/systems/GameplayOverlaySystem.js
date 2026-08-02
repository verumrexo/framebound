export class GameplayOverlaySystem {
    constructor(game) {
        this.game = game;
    }

    update(dt, isMouseDown) {
        const game = this.game;

        if (game.hangar.active) {
            game.hangar.update(dt);
            this.finishFrame(isMouseDown);
            return true;
        }

        if (game.shipBuilder.active) {
            game.shipBuilder.update(dt);
            this.finishFrame(isMouseDown);
            return true;
        }

        if (game.levelUpManager.active) {
            game.levelUpManager.update();
            this.finishFrame(isMouseDown);
            return true;
        }

        return game.pauseMenu.update(isMouseDown);
    }

    finishFrame(isMouseDown) {
        this.game.mouseDownLastFrame = isMouseDown;
        this.game.input.clearPressed();
    }
}
