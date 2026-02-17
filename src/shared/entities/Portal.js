
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

}
