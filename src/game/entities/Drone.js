import { Sprite } from "../../engine/Sprite.js";
import { Projectile } from "./Projectile.js";

export class Drone {
    constructor(x, y, ownerPart, owner = 'player', randomGen = null) {
        if (isNaN(x) || isNaN(y)) {
            console.error(`[Drone] CREATED WITH NaN! Owner: ${owner}`, x, y);
        } else {
            console.log(`[Drone] Created at ${Math.round(x)}, ${Math.round(y)} Owner: ${owner}`);
        }
        this.x = x;
        this.y = y;
        this.random = randomGen || Math.random;
        this.ownerPart = ownerPart; // The part that spawned it (can be null if passed manually)
        this.owner = owner;
        this.isDead = false;

        // Stats
        this.hp = 20;
        this.speed = 220;
        this.turnRate = 4.0;
        this.radius = 8;
        this.rotation = this.random() * Math.PI * 2;

        // Attack
        this.cooldown = 0;
        this.maxCooldown = 0.8;
        this.range = 300;

        // Boid/Behavior
        this.target = null;
        this.state = 'idle'; // idle, chase, attack

        // Visual
        // 3x4 pixel drone
        // Visual
        const palette = (this.owner === 'player') ? { 1: '#00ffff' } : { 1: '#ff00ff' }; // Cyan vs Magenta
        this.sprite = new Sprite(
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            8, 8, 4,
            palette
        );
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    isValidTarget(t) {
        if (!t) return false;
        if (t.isDead) return false;
        if (t.isOpened) return false; // For Crates
        if (t.isBroken) return false; // For Asteroids
        return true;
    }

    update(dt, game) {
        if (this.hp <= 0) {
            this.isDead = true;
            // explosion logic handled by game loop
            return;
        }

        // 1. Find Target
        if (!this.isValidTarget(this.target)) {
            this.target = this.findTarget(game);
        }

        // 2. Move towards target
        if (this.target) {
            // Determine target position
            // For enemy drones: the target might be playerShip (which has no x/y), use game.x/y
            // Also handle stale references after hangar closes
            let tx, ty;
            if (this.owner === 'enemy') {
                // Enemy drones always target the player position directly
                // The Ship object doesn't have x/y, so we use game.x/y
                if (this.target.x === undefined || this.target.y === undefined) {
                    tx = game.x;
                    ty = game.y;
                } else {
                    tx = this.target.x;
                    ty = this.target.y;
                }
            } else {
                tx = this.target.x;
                ty = this.target.y;
            }

            const dx = tx - this.x;
            const dy = ty - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Orbit distance (don't hug them)
            const optimalDist = 150;

            // Angle to target
            const targetAngle = Math.atan2(dy, dx);

            // Adjust angle based on distance preference
            let driveAngle = targetAngle;
            if (dist < optimalDist - 50) {
                // Back away slightly/circle
                driveAngle += Math.PI * 0.8;
            } else if (dist < optimalDist + 50) {
                // Strafe circle
                driveAngle += Math.PI * 0.5;
            }

            // Smooth rotation
            let angleDiff = driveAngle - this.rotation;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.rotation += Math.max(-this.turnRate * dt, Math.min(this.turnRate * dt, angleDiff));

            // Move
            this.x += Math.cos(this.rotation) * this.speed * dt;
            this.y += Math.sin(this.rotation) * this.speed * dt;

            // 3. Attack
            this.cooldown -= dt;
            const canShoot = this.cooldown <= 0 && dist < this.range && Math.abs(angleDiff) < 1.0;
            if (canShoot) {
                this.shoot(game, targetAngle);
            } else if (this.owner === 'player' && this.cooldown <= 0 && dist < this.range) {
                // Debug why not shooting
                // console.log(`[Drone] Aiming...AngleDiff: ${ angleDiff.toFixed(2) } `);
            }
        } else {
            // Idle / Follow Owner logic
            // If enemy drone and no target (player dead?), maybe just orbit spawn point?
            // If player drone, follow player.

            let tx = game.x;
            let ty = game.y;

            if (this.owner === 'enemy') {
                // If enemy drone has no target (player dead), just chill or follow carrier?
                // For now, idle circle
                this.rotation += 2.0 * dt;
                return;
            }

            const dx = tx - this.x;
            const dy = ty - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Follow player if far
            if (dist > 300) {
                const targetAngle = Math.atan2(dy, dx);
                let angleDiff = targetAngle - this.rotation;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                this.rotation += Math.max(-this.turnRate * dt, Math.min(this.turnRate * dt, angleDiff));

                this.x += Math.cos(this.rotation) * (this.speed * 1.5) * dt; // Catch up fast
                this.y += Math.sin(this.rotation) * (this.speed * 1.5) * dt;
            } else {
                // Idle circle
                this.rotation += 2.0 * dt;
                this.x += Math.cos(this.rotation) * 50 * dt;
                this.y += Math.sin(this.rotation) * 50 * dt;
            }
        }

        // Collision with enemies (Body slam? maybe not, just movement)
    }

    findTarget(game) {
        let nearest = null;
        let minDesc = Infinity;

        if (this.owner === 'player') {
            // 1. Enemies
            if (game.enemies.length > 0) {
                for (const e of game.enemies) {
                    if (e.isDead) continue;
                    const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
                    if (d < minDesc) {
                        minDesc = d;
                        nearest = e;
                    }
                }
                if (nearest) return nearest;
            }

            // 1.5. Enemy Drones
            if (game.drones && game.drones.length > 0) {
                minDesc = Infinity;
                for (const d of game.drones) {
                    if (d.isDead || d.owner !== 'enemy') continue;
                    const dist = (d.x - this.x) ** 2 + (d.y - this.y) ** 2;
                    if (dist < minDesc) {
                        minDesc = dist;
                        nearest = d;
                    }
                }
                if (nearest) return nearest;
            }

            // 2. Bosses
            if (game.bosses.length > 0) {
                return game.bosses[0];
            }

            // 3. Crates/Asteroids (Only if room cleared)
            // Check if current room is cleared?
            if (game.currentRoom && game.currentRoom.cleared) {
                minDesc = Infinity; // Reset

                // Crates
                for (const c of game.lootCrates) {
                    if (!this.isValidTarget(c)) continue;
                    const d = (c.x - this.x) ** 2 + (c.y - this.y) ** 2;
                    if (d < minDesc) {
                        minDesc = d;
                        nearest = c;
                    }
                }

                // Asteroids (lower priority than crates?)
                if (!nearest) {
                    for (const a of game.asteroids) {
                        if (!this.isValidTarget(a)) continue;
                        const d = (a.x - this.x) ** 2 + (a.y - this.y) ** 2;
                        if (d < minDesc) {
                            minDesc = d;
                            nearest = a;
                        }
                    }
                }
            }
        } else {
            // Owner is ENEMY
            // Target Player
            // Game object has x/y of player? Yes, game inherits from a "Player" concept or stores player params?
            // Game.js: this.x, this.y IS the player position (since camera centers on player usually, or Game IS the player controller info)
            // Wait, Game.js has `this.playerShip`.
            // But usually `game` passed to update has x/y properties.
            // Let's assume game.x/game.y is player pos.

            // Check if player is alive
            if (!game.playerShip.isDead) {
                // Return a proxy object or the game itself as target
                return game.playerShip;
            }
        }

        return nearest;
    }

    shoot(game, angle) {
        this.cooldown = this.maxCooldown;
        // Small laser projectile
        const p = new Projectile(this.x, this.y, angle, 'small_laser', 500, this.owner, 5, 0.8, this.random);
        game.projectiles.push(p);

        game.audio.play('shoot_dart', { volume: 0.3, pitch: 1.5 });
    }

    draw(renderer) {
        // Debug: Log once per second
        if (!this.lastDebug || Date.now() - this.lastDebug > 1000) {
            this.lastDebug = Date.now();
            console.log(`[Drone] Draw at ${Math.round(this.x)}, ${Math.round(this.y)} Rotation: ${this.rotation} Owner: ${this.owner} `);
        }

        // Draw relative to camera handled by renderer if we pass world coords
        // Sprite draw takes x,y
        this.sprite.draw(renderer.ctx, this.x, this.y, this.rotation + Math.PI / 2, 0.5, 0.5);
    }
}
