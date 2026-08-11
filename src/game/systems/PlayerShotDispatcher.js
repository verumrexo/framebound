export function dispatchPlayerShot(game, def, fireX, fireY, angle, partRef) {
    if (!game.partLabSimulation?.active && game.network && game.network.isConnected) {
        game.network.sendShoot({
            partId: def.id,
            x: fireX,
            y: fireY,
            angle
        });
    }

    game.spawnProjectile(def, fireX, fireY, angle, partRef);
}
