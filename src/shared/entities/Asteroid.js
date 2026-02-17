export class Asteroid {
    constructor(x, y, size = 'medium', type = 'rock', randomGen = null) {
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.sizeCategory = size; // small, medium, large
        this.type = type; // rock, crystal_blue, crystal_gold
        this.isDead = false;
        this.isBroken = false;

        // Stats based on size
        let radiusBase = 40;
        let hpBase = 50;

        if (size === 'small') { radiusBase = 25; hpBase = 30; }
        if (size === 'large') { radiusBase = 70; hpBase = 120; }

        this.radius = radiusBase;
        this.maxHp = hpBase * (type === 'rock' ? 1.0 : 1.5); // Crystals are tougher
        this.hp = this.maxHp;

        // Physics
        this.rotation = this.random() * Math.PI * 2;
        this.rotSpeed = (this.random() - 0.5) * 0.5; // Very slow spin
        this.vx = (this.random() - 0.5) * 20; // Very slow drift
        this.vy = (this.random() - 0.5) * 20;

        // Procedural Shape Generation
        this.vertices = [];
        const segments = 8 + Math.floor(this.random() * 5); // 8-12 segments
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Radius variation for jaggedness (0.8 to 1.2 x radius)
            const r = this.radius * (0.8 + this.random() * 0.4);
            this.vertices.push({
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r
            });
        }
    }

    takeDamage(amount) {
        if (this.isDead || this.isBroken) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isBroken = true;
            // Add some spin on break
            this.rotSpeed += (this.random() - 0.5) * 5;
            return true; // Just broke
        }
        return false;
    }

    update(dt) {
        if (this.isDead) return;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.rotSpeed * dt;
    }

}
