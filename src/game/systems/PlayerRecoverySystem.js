export class PlayerRecoverySystem {
    constructor(game) {
        this.game = game;
    }

    update(dt, levelBonus) {
        const game = this.game;
        const ship = game.playerShip;
        const hasActiveEnemies =
            game.enemies.length > 0 ||
            game.bosses.some(boss => !boss.isDead);
        recoverShip(ship, dt, levelBonus, hasActiveEnemies);
    }
}

export function recoverShip(ship, dt, levelBonus, hasActiveEnemies) {
    if (
        !ship ||
        ship.isDead ||
        !hasActiveEnemies ||
        ship.hp >= ship.maxHp
    ) {
        return false;
    }
    ship.hp += (ship.stats.regen || 0) * levelBonus * dt;
    if (ship.hp > ship.maxHp) ship.hp = ship.maxHp;
    return true;
}
