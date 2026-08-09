import { Assets } from '../../Assets.js';

export class TreasureChest {
    constructor(x, y, randomGen = null) {
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.radius = 50;
        this.bobOffset = this.random() * Math.PI * 2;
        this.life = 0;
        this.opened = false;
        this.rotation = 0;

        // Get chest sprite from Assets
        this.sprite = Assets.TreasureChest;
    }

    update(dt) {
        this.life += dt;
    }

}
