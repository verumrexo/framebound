const DEFAULT_MAX_HP = 35;
const DEFAULT_DURATION = 6;
const DEFAULT_RADIUS = 22;

const nonNegative = (value, fallback) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, value);
};

export class Decoy {
    constructor(id, x, y, ownerPlayerId, balance = {}) {
        this.id = id;
        this.type = 'decoy';
        this.x = x;
        this.y = y;
        this.ownerPlayerId = ownerPlayerId;

        this.radius = nonNegative(balance.radius, DEFAULT_RADIUS);
        this.maxHp = nonNegative(balance.maxHp, DEFAULT_MAX_HP);
        this.hp = Math.min(
            nonNegative(balance.hp, this.maxHp),
            this.maxHp
        );

        this.duration = nonNegative(
            balance.duration ?? balance.life,
            DEFAULT_DURATION
        );
        this.life = Math.min(
            nonNegative(balance.life, this.duration),
            this.duration
        );
        this.isDead = this.hp <= 0 || this.life <= 0;
    }

    get alive() {
        return !this.isDead;
    }

    get dead() {
        return this.isDead;
    }

    update(dt) {
        if (this.isDead || !Number.isFinite(dt) || dt <= 0) return;

        this.life = Math.max(0, this.life - dt);
        if (this.life === 0) this.isDead = true;
    }

    takeDamage(amount) {
        if (this.isDead || !Number.isFinite(amount) || amount <= 0) {
            return;
        }

        this.hp = Math.max(0, this.hp - amount);
        if (this.hp === 0) this.isDead = true;
    }
}
