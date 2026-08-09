import { Assets } from '../../Assets.js';

export class VaultChest {
    constructor(x, y, costType, costAmount, randomGen = null, contractId = null) {
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.costType = costType; // 'gold' or 'hp'
        this.costAmount = costAmount;
        this.contractId = contractId || (costType === 'hp' ? 'blood' : 'gilded');
        this.radius = 50;
        this.bobOffset = this.random() * Math.PI * 2;
        this.life = 0;
        this.opened = false; // "Opened" means successfully claimed after ambush
        this.locked = false;  // Triggered when paid (ambush active)
        this.ambushActive = false; // Waiting for ambush to clear
        this.wasPaid = false;
        this.sealed = false;
        this.rotation = 0;

        // Get chest sprite from Assets
        this.sprite = Assets.TreasureChest;
    }

    update(dt) {
        this.life += dt;
        if (this.ambushActive) {
            // Spin violently while ambush is active
            this.rotation += dt * 10;
        } else if (this.locked) {
            this.rotation = 0;
        }
    }

}
