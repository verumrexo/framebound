import { UI_FONTS } from '../ui/UiTheme.js';

export class FramePresentationSystem {
    constructor(game) {
        this.game = game;
    }

    draw() {
        const game = this.game;

        if (game.camera && (game.camera.width !== game.renderer.width || game.camera.height !== game.renderer.height)) {
            game.camera.resize(game.renderer.width, game.renderer.height);
        }

        if (!game.running) {
            this.drawStatus('connecting...');
            return;
        }

        if (!game.playerShip) {
            this.drawStatus('waiting for uplink...');
            return;
        }

        game.renderer.beginWorld();
        game.renderer.clear('#000');
        game.starfield.draw(game.renderer, game.x, game.y);
        game.worldScene.draw();

        // The compositor only sees the world source. HUD pixels never visit it.
        game.renderer.present();
        game.renderer.clearHud();
        game.worldOverlays?.draw?.();
        game.hud.draw();
    }

    drawStatus(text) {
        const { renderer } = this.game;

        renderer.beginWorld();
        renderer.clear();
        renderer.present();
        renderer.clearHud();
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
