import { GoldOrb } from '../../shared/entities/GoldOrb.js';
import { Portal } from '../../shared/entities/Portal.js';
import { XPOrb } from '../../shared/entities/XPOrb.js';

export class EnemyLifecycleSystem {
    constructor(game, {
        random = Math.random,
        GoldOrbClass = GoldOrb,
        PortalClass = Portal,
        XPOrbClass = XPOrb
    } = {}) {
        this.game = game;
        this.random = random;
        this.GoldOrbClass = GoldOrbClass;
        this.PortalClass = PortalClass;
        this.XPOrbClass = XPOrbClass;
    }

    update(dt) {
        const anyEnemyDead = this.updateEnemies(dt);
        this.separateEnemies();
        const anyBossDead = this.updateBosses(dt);

        if (anyBossDead) this.removeDeadBosses();
        if (anyEnemyDead) this.removeDeadEnemies();
    }

    updateEnemies(dt) {
        const game = this.game;
        const isConnected = (
            game.networkManager
            && game.networkManager.isConnected
        );
        let anyDead = false;

        for (const enemy of game.enemies) {
            const target = this.targetFor(enemy);
            if (!target) {
                if (enemy.isDead) anyDead = true;
                continue;
            }
            if (!(game.devTools && game.devTools.freezeEnemies)) {
                if (!isConnected) {
                    enemy.update(
                        dt,
                        target?.x,
                        target?.y,
                        game.projectiles,
                        game.asteroids,
                        game.lootCrates,
                        game.enemies,
                        game.currentRoom
                    );
                } else if (enemy.interpolate) {
                    enemy.interpolate(
                        dt,
                        target?.x ?? game.x,
                        target?.y ?? game.y
                    );
                }
            }

            if (enemy.isDead) anyDead = true;
        }

        return anyDead;
    }

    separateEnemies() {
        const enemies = this.game.enemies;

        for (let i = 0; i < enemies.length; i++) {
            const first = enemies[i];
            if (first.isDead) continue;

            for (let j = i + 1; j < enemies.length; j++) {
                const second = enemies[j];
                if (second.isDead) continue;

                const dx = first.x - second.x;
                const dy = first.y - second.y;
                const distanceSquared = dx * dx + dy * dy;
                const minimumDistance = (
                    first.radius || 20
                ) + (second.radius || 20);
                if (
                    distanceSquared >= minimumDistance * minimumDistance
                    || distanceSquared <= 0.001
                ) {
                    continue;
                }

                const distance = Math.sqrt(distanceSquared);
                const penetration = (minimumDistance - distance) * 0.5;
                const normalX = dx / distance;
                const normalY = dy / distance;
                first.x += normalX * penetration;
                first.y += normalY * penetration;
                second.x -= normalX * penetration;
                second.y -= normalY * penetration;
            }
        }
    }

    updateBosses(dt) {
        const game = this.game;
        let anyDead = false;

        for (const boss of game.bosses) {
            const target = this.targetFor(boss);
            if (!target) {
                if (boss.isDead) anyDead = true;
                continue;
            }
            boss.update(
                dt,
                target?.x,
                target?.y,
                game.projectiles
            );
            if (boss.isDead) anyDead = true;
        }

        return anyDead;
    }

    targetFor(enemy) {
        const targets = this.livingTargets();
        if (targets.length === 0) return null;

        if (
            isOrbitingEnemy(enemy) &&
            enemy.coopTargetId
        ) {
            const locked = targets.find(
                target => target.id === enemy.coopTargetId
            );
            if (locked) return locked;
            enemy.coopTargetId = null;
        }

        let nearest = null;
        let nearestDistance = Infinity;
        for (const target of targets) {
            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const distance = dx * dx + dy * dy;
            if (distance >= nearestDistance) continue;
            nearest = target;
            nearestDistance = distance;
        }

        if (
            nearest &&
            isOrbitingEnemy(enemy) &&
            nearestDistance <= (
                enemy.engagementDist * 1.5
            ) ** 2
        ) {
            enemy.coopTargetId = nearest.id;
        }
        return nearest;
    }

    livingTargets() {
        const game = this.game;
        if (game.peerNetwork?.isHost) {
            return game.peerNetwork.simulation?.getPickupPlayers?.() || [];
        }
        if (game.playerShip && !game.playerShip.isDead) {
            return [{
                id: 'host',
                ship: game.playerShip,
                x: game.x,
                y: game.y
            }];
        }
        return [];
    }

    removeDeadBosses() {
        const game = this.game;

        for (let i = game.bosses.length - 1; i >= 0; i--) {
            const boss = game.bosses[i];
            if (!boss.isDead) continue;

            game.spawnExplosion(boss.x, boss.y, 200, 1.0);
            game.audio.play('explosion', {
                volume: 0.8,
                pitch: 0.5
            });
            game.audio.play('enemy_death1', {
                volume: 0.8,
                pitch: 0.5
            });
            game.portals.push(new this.PortalClass(boss.x, boss.y));
            game.showNotification('portal opened', '#aa00ff');
            const resurrected =
                game.peerNetwork?.handleBossDefeated?.() || [];
            if (resurrected.length > 0) {
                game.showNotification(
                    `${resurrected.length} system${
                        resurrected.length === 1 ? '' : 's'
                    } restored`,
                    '#00ffff'
                );
            }

            for (let j = 0; j < 10; j++) {
                game.xpOrbs.push(new this.XPOrbClass(
                    boss.x + (this.random() - 0.5) * 100,
                    boss.y + (this.random() - 0.5) * 100,
                    50
                ));
            }

            game.score *= 2;
            game.showNotification(
                `SCORE DOUBLED! ${game.score}`,
                '#ffff00'
            );
            game.bosses.splice(i, 1);
        }
    }

    removeDeadEnemies() {
        const game = this.game;

        for (let i = game.enemies.length - 1; i >= 0; i--) {
            const enemy = game.enemies[i];
            if (!enemy.isDead) continue;

            const dropCount = enemy.type === 'striker' ? 3 : 2;
            for (let j = 0; j < dropCount; j++) {
                game.xpOrbs.push(new this.XPOrbClass(
                    enemy.x + (this.random() - 0.5) * 20,
                    enemy.y + (this.random() - 0.5) * 20,
                    10
                ));
            }
            game.goldOrbs.push(new this.GoldOrbClass(
                enemy.x,
                enemy.y,
                1
            ));

            const deathSound = this.random() > 0.5
                ? 'enemy_death1'
                : 'enemy_death2';
            game.audio.play(deathSound, {
                volume: 0.5,
                randomizePitch: 0.2
            });
            game.score += enemy.type === 'striker' ? 50 : 10;
            game.enemies.splice(i, 1);
        }
    }
}

function isOrbitingEnemy(enemy) {
    return enemy.type === 'circler' ||
        enemy.behavior === 'orbiter' ||
        enemy.behavior === 'flanker';
}
