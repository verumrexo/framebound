import { UI_FONTS } from '../ui/UiTheme.js';

export class FramePresentationSystem {
    constructor(game) {
        this.game = game;
    }

    draw() {
        const game = this.game;

        if (!game.running) {
            this.drawStatus('connecting...');
            return;
        }

        if (!game.playerShip) {
            this.drawStatus('waiting for uplink...');
            return;
        }

        game.renderer.clear('#000');
        game.starfield.draw(game.renderer, game.x, game.y);
        game.worldScene.draw();

        // Present World (Applies Mosaic/Resolution Scale here).
        // Everything after this stays at native resolution and non-pixelated.
        game.renderer.present();
        game.hud.draw();
    }

    drawStatus(text) {
        const { renderer } = this.game;

        renderer.clear();
        renderer.ctx.fillStyle = 'white';
        renderer.ctx.font = UI_FONTS.title;
        renderer.ctx.textAlign = 'center';
        renderer.ctx.fillText(
            text,
            renderer.width / 2,
            renderer.height / 2
        );
    }
}
