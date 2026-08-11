export class ResourceOrbSystem {
    constructor(game) {
        this.game = game;
    }

    update(dt) {
        const roomCleared = this.game.currentRoom
            && this.game.currentRoom.cleared;

        this.updateXpOrbs(dt, roomCleared);
        this.updateGoldOrbs(dt, roomCleared);
        this.updateHpOrbs(dt, roomCleared);
    }

    updateXpOrbs(dt, roomCleared) {
        const game = this.game;

        for (let i = game.xpOrbs.length - 1; i >= 0; i--) {
            const orb = game.xpOrbs[i];
            if (roomCleared) orb.forced = true;

            const target = this.nearestLivingPlayer(orb);
            if (!target || !orb.update(
                dt,
                target.x,
                target.y,
                this.pickupRadiusMultiplier(target)
            )) continue;

            game.xp += orb.value;
            game.audio.play('xp_pickup', {
                volume: 0.3,
                randomizePitch: 0.2
            });
            game.xpOrbs.splice(i, 1);

            if (game.xp >= game.xpToNext) {
                game.xp -= game.xpToNext;
                game.level++;
                game.xpToNext = Math.floor(game.xpToNext * 1.2 + 50);
                game.showNotification(
                    `CORE UPGRADED: LEVEL ${game.level}`,
                    '#00ffff'
                );
                game.showNotification(
                    'SYSTEM EFFICIENCY +1%',
                    '#44ff44'
                );
                game.levelUpManager.triggerLevelUp();
            }
        }
    }

    updateGoldOrbs(dt, roomCleared) {
        const game = this.game;

        for (let i = game.goldOrbs.length - 1; i >= 0; i--) {
            const orb = game.goldOrbs[i];
            if (roomCleared) orb.forced = true;

            const target = this.nearestLivingPlayer(orb);
            if (!target || !orb.update(
                dt,
                target.x,
                target.y,
                this.pickupRadiusMultiplier(target)
            )) continue;

            game.gold += orb.value;
            game.audio.play('gold_pickup', {
                volume: 0.4,
                randomizePitch: 0.15
            });
            game.goldOrbs.splice(i, 1);
        }
    }

    updateHpOrbs(dt, roomCleared) {
        const game = this.game;

        for (let i = game.hpOrbs.length - 1; i >= 0; i--) {
            const orb = game.hpOrbs[i];
            if (roomCleared) orb.forced = true;

            const target = this.nearestLivingPlayer(orb);
            if (!target || !orb.update(
                dt,
                target.x,
                target.y,
                this.pickupRadiusMultiplier(target)
            )) continue;

            const ship = target.ship;
            const missingHp = ship.maxHp - ship.hp;
            const healAmount = Math.max(1, Math.ceil(missingHp * 0.05));
            ship.hp = Math.min(
                ship.hp + healAmount,
                ship.maxHp
            );
            if (target.id === 'host') {
                game.showNotification(`+${healAmount} hp`, '#44ff44');
            }
            game.audio.play('gold_pickup', {
                volume: 0.5,
                pitch: 1.2,
                randomizePitch: 0.15
            });
            game.hpOrbs.splice(i, 1);
        }
    }

    nearestLivingPlayer(orb) {
        const game = this.game;
        const simulation = game.partLabSimulation?.active
            ? null
            : game.peerNetwork?.isHost
            ? game.peerNetwork.simulation
            : null;
        const players = simulation?.getPickupPlayers?.() || (
            game.playerShip?.isDead
                ? []
                : [{
                    id: 'host',
                    ship: game.playerShip,
                    x: game.x,
                    y: game.y
                }]
        );
        let nearest = null;
        let nearestDistance = Infinity;
        for (const player of players) {
            const dx = player.x - orb.x;
            const dy = player.y - orb.y;
            const distance = dx * dx + dy * dy;
            if (distance >= nearestDistance) continue;
            nearest = player;
            nearestDistance = distance;
        }
        return nearest;
    }

    pickupRadiusMultiplier(target) {
        const value = target?.ship?.stats?.pickupRadiusMul;
        return Number.isFinite(value) && value >= 0 ? value : 1;
    }
}
