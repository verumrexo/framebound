import { Sprite } from '../../engine/Sprite.js';

export class Portal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 40;
        this.rotation = 0;

        // Swirling sprite
        this.sprite = new Sprite([
            0, 1, 1, 0, 0, 1, 1, 0,
            1, 0, 0, 1, 1, 0, 0, 1,
            1, 0, 0, 0, 0, 0, 0, 1,
            0, 1, 0, 0, 0, 0, 1, 0,
            0, 1, 0, 0, 0, 0, 1, 0,
            1, 0, 0, 0, 0, 0, 0, 1,
            1, 0, 0, 1, 1, 0, 0, 1,
            0, 1, 1, 0, 0, 1, 1, 0
        ], 8, 8, 10, { 1: '#aa00ff' });
    }

    update(dt) {
        this.rotation += 2.0 * dt;
    }

    draw(renderer) {
        // Draw glow
        renderer.ctx.save();
        renderer.ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        renderer.drawCircle(this.x, this.y, this.radius + 10, '#aa00ff');
        renderer.drawCircle(this.x, this.y, this.radius, '#ffffff');
        renderer.ctx.restore();

        this.sprite.draw(renderer.ctx, this.x, this.y, this.rotation);
    }
}
