import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';

export class ShopItem {
    constructor(x, y, itemData) {
        this.x = x;
        this.y = y;
        this.data = itemData; // { type, name, partId, description, price, icon }
        this.radius = 40;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.life = 0;
        this.purchased = false;

        // Get part def if it's a part
        if (this.data.type === 'part' && this.data.partId) {
            this.partDef = PartsLibrary[this.data.partId];
        }
    }

    update(dt) {
        this.life += dt;
    }

}
