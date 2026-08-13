import { Sprite } from '../../engine/Sprite.js';
import { Projectile } from './Projectile.js';
import { getDroneBlueprintVisual } from '../combat/DroneBlueprints.js';
import { createDroneSprite } from '../parts/DronePartFactory.js';
import { partSoundEventKey } from '../audio/SoundEventKeys.js';

const STRIKER_SPRITE = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 1, 1, 0, 0, 0,
    0, 0, 1, 0, 0, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0
];

const valueOr = (value, fallback) => value ?? fallback;

export class Drone {
    constructor(
        x,
        y,
        ownerPart,
        owner = 'player',
        randomGen = null,
        config = {}
    ) {
        if (isNaN(x) || isNaN(y)) {
            console.error(`[drone] created with nan. owner: ${owner}`, x, y);
        }
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.ownerPart = ownerPart;
        this.owner = owner;
        this.ownerPlayerId = owner === 'player' ? 'host' : null;
        this.sourcePartId = config.sourcePartId || ownerPart?.partId || 'drone';
        this.sourcePartKey = config.sourcePartKey || (ownerPart
            ? `${this.sourcePartId}@${ownerPart.x},${ownerPart.y}`
            : 'drone');
        this.sourcePartName = config.sourcePartName ||
            ownerPart?.droneLabel || 'swarm hive';
        this.isDead = false;

        const blueprint = getDroneBlueprintVisual(config.type);
        this.droneType = blueprint.id;
        this.hp = valueOr(config.hp, blueprint.hp) * valueOr(config.hpMultiplier, 1);
        this.maxHp = this.hp;
        this.speed = valueOr(config.speed, blueprint.speed);
        this.turnRate = valueOr(config.turnRate, blueprint.turnRate);
        this.radius = valueOr(config.radius, 8);
        this.rotation = this.random() * Math.PI * 2;

        this.cooldown = 0;
        this.maxCooldown = valueOr(config.attackCooldown, 0.8);
        this.damage = valueOr(config.damage, 5);
        this.range = valueOr(config.range, blueprint.range);
        this.optimalDistance = valueOr(
            config.optimalDistance,
            blueprint.optimalDistance ?? 150
        );
        this.projectileType = valueOr(
            config.projectileType,
            blueprint.projectileType ?? null
        );
        this.projectileLook = valueOr(config.projectileLook, blueprint.projectileLook ?? 'default');
        this.projectileTrail = valueOr(config.projectileTrail, blueprint.projectileTrail ?? 'default');
        this.projectileSpeed = valueOr(
            config.projectileSpeed,
            blueprint.projectileSpeed
        );
        this.projectileLifetime = valueOr(
            config.projectileLifetime,
            blueprint.projectileLifetime ?? 0.8
        );
        this.shotCount = Math.max(1, Math.floor(valueOr(
            config.shotCount,
            blueprint.shotCount ?? 1
        )));
        this.spread = valueOr(config.spread, blueprint.spread ?? 0);
        this.targetPriority = valueOr(
            config.targetPriority,
            blueprint.targetPriority ?? null
        );
        this.role = valueOr(config.role, blueprint.role ?? 'attack');
        this.repairAmount = valueOr(
            config.repairAmount,
            blueprint.repairAmount ?? 0
        );
        this.contactRange = valueOr(
            config.contactRange,
            blueprint.contactRange ?? (this.role === 'repair' ? 36 : 18)
        );

        this.target = null;
        this.state = 'idle';

        const palette = owner === 'player'
            ? { 1: '#00ffff', 2: '#177777' }
            : { 1: '#ff00ff', 2: '#881166' };
        this.sprite = createDroneSprite(blueprint, palette) || new Sprite(
            STRIKER_SPRITE,
            8,
            8,
            4,
            palette
        );
        this.spriteRotationOffset = Number.isFinite(blueprint.orientationOffset)
            ? blueprint.orientationOffset
            : Math.PI / 2;
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    isValidTarget(target) {
        if (!target || target.isDead) return false;
        if (target.isOpened || target.isBroken) return false;
        return true;
    }

    update(dt, game) {
        if (this.hp <= 0) {
            this.isDead = true;
            return;
        }
        if (this.role === 'repair') {
            this.updateRepair(dt, game);
            return;
        }
        if (this.role === 'ram') {
            this.updateRam(dt, game);
            return;
        }
        this.updateAttack(dt, game);
    }

    updateAttack(dt, game) {
        if (!this.isValidTarget(this.target)) {
            this.target = this.findTarget(game);
        }

        if (!this.target) {
            this.followOwner(dt, game);
            return;
        }

        const { x: tx, y: ty } = this.getTargetPosition(game, this.target);
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetAngle = Math.atan2(dy, dx);
        let driveAngle = targetAngle;
        const optimalDist = this.optimalDistance;
        if (dist < optimalDist - 50) {
            driveAngle += Math.PI * 0.8;
        } else if (dist < optimalDist + 50) {
            driveAngle += Math.PI * 0.5;
        }

        const angleDiff = this.turnTowards(driveAngle, dt);
        this.x += Math.cos(this.rotation) * this.speed * dt;
        this.y += Math.sin(this.rotation) * this.speed * dt;

        this.cooldown -= dt;
        if (
            this.cooldown <= 0 &&
            dist < this.range &&
            Math.abs(angleDiff) < 1.0
        ) {
            this.shoot(game, targetAngle);
        }
    }

    updateRepair(dt, game) {
        if (!this.isValidTarget(this.target) || this.target.hp >= this.target.maxHp) {
            this.target = this.findTarget(game);
        }
        if (!this.target) {
            this.followOwner(dt, game);
            return;
        }

        const { x: tx, y: ty } = this.getTargetPosition(game, this.target);
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.contactRange) {
            this.turnTowards(Math.atan2(dy, dx), dt);
            this.x += Math.cos(this.rotation) * this.speed * dt;
            this.y += Math.sin(this.rotation) * this.speed * dt;
        }

        this.cooldown -= dt;
        if (this.cooldown <= 0 && dist <= this.contactRange) {
            const before = this.target.hp;
            this.target.hp = Math.min(
                this.target.maxHp,
                this.target.hp + Math.max(0, this.repairAmount)
            );
            if (this.target.hp > before) this.cooldown = this.maxCooldown;
        }
    }

    updateRam(dt, game) {
        if (!this.isValidTarget(this.target)) {
            this.target = this.findTarget(game);
        }
        if (!this.target) {
            this.followOwner(dt, game);
            return;
        }

        const { x: tx, y: ty } = this.getTargetPosition(game, this.target);
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.turnTowards(Math.atan2(dy, dx), dt);
        this.x += Math.cos(this.rotation) * this.speed * dt;
        this.y += Math.sin(this.rotation) * this.speed * dt;

        const impactDistance = Math.hypot(tx - this.x, ty - this.y);
        if (impactDistance <= this.contactRange + (this.target.radius || 0)) {
            this.target.takeDamage?.(this.damage);
            this.isDead = true;
        }
    }

    followOwner(dt, game) {
        const owner = this.findOwnerPlayer(game);
        if (this.owner === 'enemy') {
            this.rotation += 2.0 * dt;
            return;
        }
        const tx = owner?.x ?? this.x;
        const ty = owner?.y ?? this.y;
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 300) {
            this.turnTowards(Math.atan2(dy, dx), dt);
            this.x += Math.cos(this.rotation) * this.speed * 1.5 * dt;
            this.y += Math.sin(this.rotation) * this.speed * 1.5 * dt;
        } else {
            this.rotation += 2.0 * dt;
            this.x += Math.cos(this.rotation) * 50 * dt;
            this.y += Math.sin(this.rotation) * 50 * dt;
        }
    }

    turnTowards(angle, dt) {
        let angleDiff = angle - this.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.rotation += Math.max(
            -this.turnRate * dt,
            Math.min(this.turnRate * dt, angleDiff)
        );
        return angleDiff;
    }

    findTarget(game) {
        if (this.role === 'repair') return this.findRepairTarget(game);

        const preferDrones = this.targetPriority === 'drones';
        if (this.owner === 'player') {
            if (preferDrones) {
                const drone = this.findNearestHostileDrone(game);
                if (drone) return drone;
            }

            const enemy = this.findNearest(game.enemies || []);
            if (enemy) return enemy;
            if (!preferDrones) {
                const drone = this.findNearestHostileDrone(game);
                if (drone) return drone;
            }
            if (game.bosses?.length > 0) return game.bosses[0];

            if (game.currentRoom?.cleared) {
                const crate = this.findNearest(
                    (game.lootCrates || []).filter(target => this.isValidTarget(target))
                );
                if (crate) return crate;
                return this.findNearest(
                    (game.asteroids || []).filter(target => this.isValidTarget(target))
                );
            }
            return null;
        }

        if (preferDrones) {
            const drone = this.findNearestHostileDrone(game);
            if (drone) return drone;
        }
        const players = this.getLivingPlayers(game);
        return players.reduce((nearest, player) => {
            if (!nearest) return player.ship;
            const nearestDistance = this.distanceSquared(nearest, game);
            const distance = (player.x - this.x) ** 2 + (player.y - this.y) ** 2;
            return distance < nearestDistance ? player.ship : nearest;
        }, null);
    }

    findRepairTarget(game) {
        let target = null;
        let mostMissing = 0;
        const allies = this.owner === 'player'
            ? this.getLivingPlayers(game).map(player => ({
                entity: player.ship,
                x: player.x,
                y: player.y
            }))
            : [...(game.enemies || []), ...(game.bosses || [])].map(entity => ({
                entity,
                x: entity.x,
                y: entity.y
            }));
        for (const ally of allies) {
            const ship = ally.entity;
            if (!ship || ship.isDead || ship.hp >= ship.maxHp) continue;
            const distance = Math.hypot(ally.x - this.x, ally.y - this.y);
            if (distance > this.range) continue;
            const missing = Math.max(0, ship.maxHp - ship.hp);
            if (missing > mostMissing) {
                mostMissing = missing;
                target = ship;
            }
        }
        return target;
    }

    findNearestHostileDrone(game) {
        return this.findNearest(
            (game.drones || []).filter(drone =>
                !drone.isDead && drone.owner !== this.owner
            )
        );
    }

    findNearest(targets) {
        let nearest = null;
        let minDistance = Infinity;
        for (const target of targets) {
            if (!this.isValidTarget(target)) continue;
            const distance = (target.x - this.x) ** 2 + (target.y - this.y) ** 2;
            if (distance < minDistance) {
                minDistance = distance;
                nearest = target;
            }
        }
        return nearest;
    }

    distanceSquared(target, game) {
        const position = this.getTargetPosition(game, target);
        return (position.x - this.x) ** 2 + (position.y - this.y) ** 2;
    }

    getTargetPosition(game, target) {
        const player = this.getLivingPlayers(game).find(
            candidate => candidate.ship === target
        );
        if (player) return { x: player.x, y: player.y };
        if (
            this.owner === 'enemy' &&
            (target.x === undefined || target.y === undefined)
        ) {
            return { x: game.x, y: game.y };
        }
        return { x: target.x, y: target.y };
    }

    findOwnerPlayer(game) {
        return this.getLivingPlayers(game).find(
            player => player.id === this.ownerPlayerId
        ) || null;
    }

    getLivingPlayers(game) {
        const simulation = game.peerNetwork?.simulation;
        if (simulation?.getPickupPlayers) return simulation.getPickupPlayers();
        if (!game.playerShip?.isDead) {
            return [{
                id: 'host',
                ship: game.playerShip,
                x: game.x,
                y: game.y
            }];
        }
        return [];
    }

    shoot(game, angle) {
        this.cooldown = this.maxCooldown;
        if (!this.projectileType) return;
        const count = this.shotCount;
        for (let index = 0; index < count; index++) {
            const offset = count === 1
                ? 0
                : (index / (count - 1) - 0.5) * this.spread;
            const shotAngle = angle + offset;
            const projectile = new Projectile(
                this.x,
                this.y,
                shotAngle,
                this.projectileType,
                this.projectileSpeed ?? 500,
                this.owner,
                this.damage,
                this.projectileLifetime,
                this.random
            );
            if (this.projectileSpeed !== undefined && !projectile.isBeam) {
                projectile.speed = this.projectileSpeed;
                projectile.vx = Math.cos(shotAngle) * this.projectileSpeed;
                projectile.vy = Math.sin(shotAngle) * this.projectileSpeed;
            }
            if (this.owner === 'player') {
                projectile.weaponFamily = 'drone';
                projectile.sourcePartId = this.sourcePartId;
                projectile.sourcePartKey = this.sourcePartKey;
                projectile.sourcePartName = this.sourcePartName;
            }
            projectile.projectileLook = this.projectileLook;
            projectile.projectileTrail = this.projectileTrail;
            game.projectiles.push(projectile);
        }

        if (this.owner === 'player' && game.audio.playEvent) {
            game.audio.playEvent(
                partSoundEventKey(
                    this.sourcePartId,
                    'shoot'
                ),
                'shoot_dart',
                { volume: 0.3, pitch: 1.5 }
            );
        } else {
            game.audio.play('shoot_dart', { volume: 0.3, pitch: 1.5 });
        }
    }
}
