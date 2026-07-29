export class GameInputBindings {
    constructor(game, target = window) {
        this.game = game;
        this.target = target;
        this.handleGameplayKey = event => this.onGameplayKey(event);
        this.handleDevKey = event => this.onDevKey(event);
        this.handleResize = () => this.onResize();
        this.attached = false;
    }

    attach() {
        if (this.attached) return;
        this.target.addEventListener('keydown', this.handleGameplayKey);
        this.target.addEventListener('keydown', this.handleDevKey);
        this.target.addEventListener('resize', this.handleResize);
        this.attached = true;
    }

    dispose() {
        if (!this.attached) return;
        this.target.removeEventListener('keydown', this.handleGameplayKey);
        this.target.removeEventListener('keydown', this.handleDevKey);
        this.target.removeEventListener('resize', this.handleResize);
        this.attached = false;
    }

    onGameplayKey(event) {
        const game = this.game;
        if (game.designer.active) return;
        if (!game.running || !game.playerShip) return;
        if (game.isGameOver || game.nameEntryActive) return;

        if (game.shipBuilder.active) {
            if (event.code === 'KeyM') {
                game.shipBuilder.toggle();
            }
            return;
        }

        if (game.hangar.active) {
            if (event.code === 'Tab') {
                event.preventDefault();
                game.hangar.toggle();
            }
            return;
        }

        if (game.levelUpManager?.active) return;

        if (game.paused) {
            if (event.key === 'Escape') {
                game.togglePause();
            }
            return;
        }

        if (event.code === 'Tab') {
            event.preventDefault();
            game.hangar.toggle();
        }

        if (event.key === 'Escape') {
            if (game.fullscreenMapOpen) {
                game.fullscreenMapOpen = false;
                return;
            }

            game.togglePause();
        }

        if (event.code === 'KeyM') {
            if (game.currentRoom &&
                !game.currentRoom.locked &&
                !game.paused &&
                !game.isGameOver) {
                game.fullscreenMapOpen = !game.fullscreenMapOpen;
            }
        }
    }

    onDevKey(event) {
        if (event.code === 'KeyL') {
            if (this.game.nameEntryActive) return;
            this.game.devTools.toggle();
        }
    }

    onResize() {
        this.game.camera.resize(this.target.innerWidth, this.target.innerHeight);
    }
}
