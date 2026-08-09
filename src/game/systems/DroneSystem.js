import { Drone } from '../../shared/entities/Drone.js';
import { PartsLibrary } from '../../shared/parts/Part.js';
import {
    PartType,
    TILE_SIZE
} from '../../shared/parts/PartDefinitions.js';
import { partSoundEventKey } from '../audio/SoundEventRegistry.js';

const ENEMY_DRONE_LIMIT = 12;

export class DroneSystem {
    constructor(game, {
        DroneClass = Drone,
        partsLibrary = PartsLibrary,
        tileSize = TILE_SIZE,
        now = Date.now
    } = {}) {
        this.game = game;
        this.DroneClass = DroneClass;
        this.partsLibrary = partsLibrary;
        this.tileSize = tileSize;
        this.now = now;
    }

    update(dt) {
        this.spawnFriendlyDrones();
        this.spawnEnemyDrones();
        this.updateDrones(dt);
    }

    spawnFriendlyDrones() {
        const game = this.game;
        const now = this.now();
        for (const player of this.getFriendlyPlayers()) {
            const droneParts = [...player.ship.getUniqueParts()].filter(part =>
                this.partsLibrary[part.partId]?.type === PartType.DRONE
            );
            const capacityBonus = Math.floor(
                player.ship.permanentStats?.droneCapacityAdd || 0
            );
            const capacity = droneParts.reduce(
                (total, part) => total + (
                    this.partsLibrary[part.partId]?.stats?.droneCapacity || 0
                ),
                0
            ) + capacityBonus;
            const activeCount = game.drones.filter(drone =>
                drone.owner === 'player' && drone.ownerPlayerId === player.id
            ).length;
            if (activeCount >= capacity) continue;

            for (const [partIndex, part] of droneParts.entries()) {
                const def = this.partsLibrary[part.partId];
                const sourcePartKey = this.getDroneSourceKey(part);
                const allocatedBonus = Math.floor(
                    capacityBonus / Math.max(1, droneParts.length)
                ) + (partIndex < capacityBonus % Math.max(1, droneParts.length) ? 1 : 0);
                const partCapacity = (def.stats.droneCapacity || 0) + allocatedBonus;
                const partActiveCount = game.drones.filter(drone =>
                    drone.owner === 'player' &&
                    drone.ownerPlayerId === player.id &&
                    (
                        drone.sourcePartKey === sourcePartKey ||
                        drone.ownerPart === part
                    )
                ).length;
                if (partActiveCount >= partCapacity) continue;
                const rate = 1 + Math.max(
                    0,
                    player.ship.permanentStats?.droneRateAdd || 0
                );
                const spawnCooldown = (
                    def.stats.droneSpawnCooldown * 1000
                ) / rate;
                if (
                    part.lastDroneSpawn &&
                    now - part.lastDroneSpawn <= spawnCooldown
                ) {
                    continue;
                }

                const position = this.getPartWorldPosition(
                    player.x,
                    player.y,
                    player.rotation,
                    part
                );
                if (!position) {
                    console.error(
                        '[Game] Player Drone spawn position is invalid'
                    );
                    continue;
                }

                part.droneLabel = def.name.toLowerCase();
                const drone = new this.DroneClass(
                    position.x,
                    position.y,
                    part,
                    'player',
                    null,
                    this.getDroneConfig(
                        def,
                        player.ship.permanentStats?.droneDamageMul || 1,
                        part
                    )
                );
                drone.ownerPlayerId = player.id;
                game.drones.push(drone);
                game.showNotification('drone deployed', '#00ffff');
                if (game.audio.playEvent) {
                    game.audio.playEvent(
                        partSoundEventKey(def.id, 'deploy'),
                        'reload',
                        { volume: 0.5, pitch: 2.0 }
                    );
                } else {
                    game.audio.play('reload', { volume: 0.5, pitch: 2.0 });
                }
                part.lastDroneSpawn = now;

                const playerDroneCount = game.drones.filter(candidate =>
                    candidate.owner === 'player' &&
                    candidate.ownerPlayerId === player.id
                ).length;
                if (playerDroneCount >= capacity) break;
            }
        }
    }

    getFriendlyPlayers() {
        const simulation = this.game.peerNetwork?.simulation;
        if (simulation?.getPickupPlayers) {
            return simulation.getPickupPlayers();
        }
        if (!this.game.playerShip?.isDead) {
            return [{
                id: 'host',
                ship: this.game.playerShip,
                x: this.game.x,
                y: this.game.y,
                rotation: this.game.rotation
            }];
        }
        return [];
    }

    spawnEnemyDrones() {
        const game = this.game;

        for (const enemy of game.enemies) {
            if (enemy.isDead || !enemy.shipParts) continue;

            for (const part of enemy.shipParts) {
                const def = this.partsLibrary[part.partId];
                if (def?.type !== PartType.DRONE) continue;

                const now = this.now();
                if (part.lastDroneSpawn && now - part.lastDroneSpawn <= 2000) {
                    continue;
                }

                const enemyDroneCount = game.drones.filter(
                    drone => drone.owner === 'enemy'
                ).length;
                if (enemyDroneCount >= ENEMY_DRONE_LIMIT) break;

                const position = this.getPartWorldPosition(
                    enemy.x,
                    enemy.y,
                    enemy.rotation,
                    part
                );
                if (!position) {
                    console.error('[Game] Enemy Drone spawn position is invalid');
                    continue;
                }

                const drone = new this.DroneClass(
                    position.x,
                    position.y,
                    part,
                    'enemy',
                    null,
                    this.getDroneConfig(def, 1, part)
                );
                drone.spawnerEnemy = enemy;
                game.drones.push(drone);
                game.showNotification('enemy drone spawned', '#ff00ff');
                part.lastDroneSpawn = now;
            }
        }
    }

    getDroneConfig(definition, damageMultiplier = 1, part = null) {
        const stats = definition.stats || {};
        const config = {
            type: stats.droneType,
            damage: (stats.droneDamage ?? 0) * damageMultiplier,
            attackCooldown: stats.droneAttackCooldown ?? 0.8,
            sourcePartId: definition.id || part?.partId || 'drone',
            sourcePartKey: part ? this.getDroneSourceKey(part) : definition.id,
            sourcePartName: String(definition.name || definition.id).toLowerCase()
        };
        const profileFields = [
            'projectileType',
            'projectileSpeed',
            'projectileLifetime',
            'shotCount',
            'spread',
            'optimalDistance',
            'targetPriority',
            'role',
            'repairAmount',
            'contactRange'
        ];
        for (const field of profileFields) {
            const statKey = `drone${field[0].toUpperCase()}${field.slice(1)}`;
            if (stats[statKey] !== undefined) config[field] = stats[statKey];
        }
        return config;
    }

    getDroneSourceKey(part) {
        return `${part.partId}@${part.x},${part.y}`;
    }

    getPartWorldPosition(shipX, shipY, shipRotation, part) {
        const def = this.partsLibrary[part.partId];
        if (!def) return null;

        const isRotated = ((part.rotation || 0) % 2 !== 0);
        const width = isRotated ? def.height : def.width;
        const height = isRotated ? def.width : def.height;
        const localX = (part.x + (width - 1) / 2) * this.tileSize;
        const localY = (part.y + (height - 1) / 2) * this.tileSize;
        const cos = Math.cos(shipRotation);
        const sin = Math.sin(shipRotation);
        const x = shipX + (localX * cos - localY * sin);
        const y = shipY + (localX * sin + localY * cos);

        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
    }

    updateDrones(dt) {
        const game = this.game;

        for (let i = game.drones.length - 1; i >= 0; i--) {
            const drone = game.drones[i];
            drone.update(dt, game);

            for (const enemy of game.enemies) {
                if (enemy.isDead || drone.isDead) continue;
                if (drone.spawnerEnemy === enemy) continue;
                this.separateDroneAndBody(drone, enemy, 20, 0);
            }

            for (const asteroid of game.asteroids) {
                this.separateDroneAndBody(drone, asteroid, 20, 2);
            }

            for (const crate of game.lootCrates) {
                this.separateDroneAndBody(drone, crate, 15, 5);
            }

            for (const other of game.drones) {
                if (other === drone || other.isDead) continue;

                const dx = drone.x - other.x;
                const dy = drone.y - other.y;
                const distanceSquared = dx * dx + dy * dy;
                const minimumDistance = (
                    drone.radius || 8
                ) + (other.radius || 8);
                if (
                    distanceSquared >= minimumDistance * minimumDistance
                    || distanceSquared <= 0
                ) {
                    continue;
                }

                const distance = Math.sqrt(distanceSquared);
                const penetration = (minimumDistance - distance) * 0.5;
                const normalX = dx / distance;
                const normalY = dy / distance;
                drone.x += normalX * penetration;
                drone.y += normalY * penetration;
                other.x -= normalX * penetration;
                other.y -= normalY * penetration;
            }

            if (!drone.isDead) continue;

            game.spawnExplosion(drone.x, drone.y, 20, 0.4, '#00ffff');
            game.audio.play('explosion', {
                volume: 0.2,
                pitch: 2.0
            });
            game.drones.splice(i, 1);
        }
    }

    separateDroneAndBody(drone, body, fallbackRadius, bodyPush) {
        const dx = drone.x - body.x;
        const dy = drone.y - body.y;
        const distanceSquared = dx * dx + dy * dy;
        const minimumDistance = (
            drone.radius || 8
        ) + (body.radius || fallbackRadius);
        if (distanceSquared >= minimumDistance * minimumDistance) return;

        const distance = Math.sqrt(distanceSquared) || 1;
        const penetration = (minimumDistance - distance) * 0.5;
        const normalX = dx / distance;
        const normalY = dy / distance;
        drone.x += normalX * penetration;
        drone.y += normalY * penetration;

        if (bodyPush === 0) {
            body.x -= normalX * penetration;
            body.y -= normalY * penetration;
        } else {
            body.vx -= normalX * bodyPush;
            body.vy -= normalY * bodyPush;
        }
    }
}
