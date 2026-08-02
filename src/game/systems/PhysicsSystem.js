import { Collision } from '../../shared/CollisionSystem.js';
import { TILE_SIZE } from '../../shared/parts/PartDefinitions.js';

function getCollisionNormal(dx, dy, distance, fallbackThreshold = 0) {
    const needsFallback = fallbackThreshold === 0
        ? distance === 0
        : distance < fallbackThreshold;
    if (needsFallback) {
        return { x: 1, y: 0 };
    }

    return {
        x: dx / distance,
        y: dy / distance
    };
}

export class PhysicsSystem {
    constructor(game, {
        random = Math.random,
        tileSize = TILE_SIZE
    } = {}) {
        this.game = game;
        this.random = random;
        this.tileSize = tileSize;
    }

    update(dt) {
        this.updateAsteroids(dt);
        this.updateLootCrates(dt);
    }

    updateAsteroids(dt) {
        const game = this.game;

        for (let i = game.asteroids.length - 1; i >= 0; i--) {
            const asteroid = game.asteroids[i];
            asteroid.update(dt);

            if (!asteroid.isDead && !asteroid.isBroken) {
                for (const target of this.playerCollisionTargets()) {
                    this.collideShipWithAsteroid(
                        target,
                        asteroid,
                        dt
                    );
                }
            }

            this.keepInsideCurrentRoom(asteroid);

            if (asteroid.isDead) {
                game.asteroids.splice(i, 1);
                continue;
            }

            for (let j = i - 1; j >= 0; j--) {
                const other = game.asteroids[j];
                if (other.isDead) continue;

                const dx = other.x - asteroid.x;
                const dy = other.y - asteroid.y;
                const distanceSquared = dx * dx + dy * dy;
                const minimumDistance = asteroid.radius + other.radius;
                if (distanceSquared >= minimumDistance * minimumDistance) {
                    continue;
                }

                const distance = Math.sqrt(distanceSquared);
                const normal = getCollisionNormal(dx, dy, distance);
                const penetration = (minimumDistance - distance) / 2;
                asteroid.x -= normal.x * penetration;
                asteroid.y -= normal.y * penetration;
                other.x += normal.x * penetration;
                other.y += normal.y * penetration;

                const push = 100;
                asteroid.vx -= normal.x * push * dt;
                asteroid.vy -= normal.y * push * dt;
                other.vx += normal.x * push * dt;
                other.vy += normal.y * push * dt;
            }
        }
    }

    collidePlayerWithAsteroid(asteroid, dt) {
        const target = this.playerCollisionTargets()[0];
        if (target) this.collideShipWithAsteroid(target, asteroid, dt);
    }

    collideShipWithAsteroid(target, asteroid, dt) {
        const { entity, ship } = target;
        if (ship.isDead) return;
        const cos = Math.cos(entity.rotation);
        const sin = Math.sin(entity.rotation);

        for (const part of ship.getUniqueParts()) {
            const localX = part.x * this.tileSize;
            const localY = part.y * this.tileSize;
            const worldX = entity.x + (localX * cos - localY * sin);
            const worldY = entity.y + (localX * sin + localY * cos);
            if (isNaN(worldX) || isNaN(worldY)) continue;

            const dx = worldX - asteroid.x;
            const dy = worldY - asteroid.y;
            const distanceSquared = dx * dx + dy * dy;
            const minimumDistance = asteroid.radius + this.tileSize / 2;
            if (distanceSquared >= minimumDistance * minimumDistance) {
                continue;
            }

            const normal = getCollisionNormal(
                dx,
                dy,
                Math.sqrt(distanceSquared),
                0.1
            );
            const push = 3000;
            entity.vx += normal.x * push * dt;
            entity.vy += normal.y * push * dt;
            entity.x += normal.x * 2;
            entity.y += normal.y * 2;
            asteroid.vx -= normal.x * push * 0.5 * dt;
            asteroid.vy -= normal.y * push * 0.5 * dt;
            if (target.isHost) this.game.camera.shake = 5;
            break;
        }
    }

    updateLootCrates(dt) {
        const game = this.game;

        for (let i = game.lootCrates.length - 1; i >= 0; i--) {
            const crate = game.lootCrates[i];
            crate.update(dt);
            this.keepInsideCurrentRoom(crate);

            if (crate.isOpened) continue;

            for (const target of this.playerCollisionTargets()) {
                this.collideShipWithCrate(target, crate, dt);
            }

            for (let j = i - 1; j >= 0; j--) {
                const other = game.lootCrates[j];
                if (other.isOpened && crate.isOpened) continue;

                const info = Collision.circleCircleInfo(
                    crate.x,
                    crate.y,
                    crate.radius,
                    other.x,
                    other.y,
                    other.radius
                );
                if (!info.hit) continue;

                Collision.separateCircles(
                    crate,
                    other,
                    info.overlap,
                    info.dx,
                    info.dy,
                    info.dist
                );
                Collision.bounceCircles(
                    crate,
                    other,
                    info.dx,
                    info.dy,
                    info.dist,
                    200,
                    dt
                );
                crate.rotSpeed += (this.random() - 0.5) * 2;
                other.rotSpeed -= (this.random() - 0.5) * 2;
            }

            for (const asteroid of game.asteroids) {
                if (asteroid.isDead || asteroid.isBroken) continue;
                this.collideCrateWithAsteroid(crate, asteroid, dt);
            }
        }
    }

    collidePlayerWithCrate(crate, dt) {
        const target = this.playerCollisionTargets()[0];
        if (target) this.collideShipWithCrate(target, crate, dt);
    }

    collideShipWithCrate(target, crate, dt) {
        const { entity, ship } = target;
        if (ship.isDead) return;
        const cos = Math.cos(entity.rotation);
        const sin = Math.sin(entity.rotation);

        for (const part of ship.getUniqueParts()) {
            const localX = part.x * this.tileSize;
            const localY = part.y * this.tileSize;
            const worldX = entity.x + (localX * cos - localY * sin);
            const worldY = entity.y + (localX * sin + localY * cos);
            if (isNaN(worldX) || isNaN(worldY)) continue;

            const dx = worldX - crate.x;
            const dy = worldY - crate.y;
            const distanceSquared = dx * dx + dy * dy;
            const minimumDistance = crate.radius + this.tileSize / 2;
            if (distanceSquared >= minimumDistance * minimumDistance) {
                continue;
            }

            const normal = getCollisionNormal(
                dx,
                dy,
                Math.sqrt(distanceSquared),
                0.1
            );
            const push = 2000;
            entity.vx += normal.x * push * dt;
            entity.vy += normal.y * push * dt;
            entity.x += normal.x * 2;
            entity.y += normal.y * 2;

            const playerSpeed = Math.sqrt(
                entity.vx * entity.vx + entity.vy * entity.vy
            );
            const impactForce = Math.max(100, playerSpeed * 1.5);
            crate.vx -= normal.x * impactForce;
            crate.vy -= normal.y * impactForce;
            crate.rotSpeed += (this.random() - 0.5) * 8;
            break;
        }
    }

    playerCollisionTargets() {
        const game = this.game;
        const targets = [];
        if (game.playerShip) {
            targets.push({
                id: 'host',
                ship: game.playerShip,
                entity: game,
                isHost: true
            });
        }
        if (!game.peerNetwork?.isHost) return targets;
        for (const [id, peer] of game.peerNetwork.simulation?.peers || []) {
            if (peer.suspended) continue;
            targets.push({
                id,
                ship: peer.ship,
                entity: peer.ship,
                isHost: false
            });
        }
        return targets;
    }

    collideCrateWithAsteroid(crate, asteroid, dt) {
        const dx = asteroid.x - crate.x;
        const dy = asteroid.y - crate.y;
        const distanceSquared = dx * dx + dy * dy;
        const minimumDistance = crate.radius + asteroid.radius;
        if (distanceSquared >= minimumDistance * minimumDistance) return;

        const distance = Math.sqrt(distanceSquared);
        const normal = getCollisionNormal(dx, dy, distance);
        const penetration = (minimumDistance - distance) / 2;
        crate.x -= normal.x * penetration;
        crate.y -= normal.y * penetration;
        asteroid.x += normal.x * penetration;
        asteroid.y += normal.y * penetration;

        const push = 1000;
        crate.vx -= normal.x * push * dt;
        crate.vy -= normal.y * push * dt;
        asteroid.vx += normal.x * push * 0.1 * dt;
        asteroid.vy += normal.y * push * 0.1 * dt;
        crate.rotSpeed += (this.random() - 0.5) * 5;
    }

    keepInsideCurrentRoom(entity) {
        const room = this.game.currentRoom;
        if (!room) return;

        const margin = entity.radius;
        if (entity.x < room.x + margin) {
            entity.x = room.x + margin;
            entity.vx = Math.abs(entity.vx);
        } else if (entity.x > room.x + room.width - margin) {
            entity.x = room.x + room.width - margin;
            entity.vx = -Math.abs(entity.vx);
        }

        if (entity.y < room.y + margin) {
            entity.y = room.y + margin;
            entity.vy = Math.abs(entity.vy);
        } else if (entity.y > room.y + room.height - margin) {
            entity.y = room.y + room.height - margin;
            entity.vy = -Math.abs(entity.vy);
        }
    }
}
