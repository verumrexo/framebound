
import { Collision } from './CollisionSystem.js';
import { PartsLibrary, TILE_SIZE } from '../parts/Part.js';

export class PhysicsSystem {
    update(game, dt) {
        // Update Asteroids & Player Collision
        for (let i = game.asteroids.length - 1; i >= 0; i--) {
            const asteroid = game.asteroids[i];
            asteroid.update(dt);

            // Player vs Asteroid (Per-Part Collision)
            if (!asteroid.isDead && !asteroid.isBroken) {
                const col = game.playerShip.checkCollision(game.x, game.y, game.rotation, asteroid.x, asteroid.y, asteroid.radius);

                if (col.hit) {
                    const dx = col.worldX - asteroid.x;
                    const dy = col.worldY - asteroid.y;
                    const distSq = dx * dx + dy * dy;
                    const dist = Math.sqrt(distSq) || 0.1; // Avoid div by zero

                    const nx = dx / dist;
                    const ny = dy / dist;

                    const push = 3000; // Strong physics bump

                    // Apply to Ship
                    game.vx += nx * push * dt;
                    game.vy += ny * push * dt;

                    // Positional Correction (Anti-Stuck)
                    game.x += nx * 2;
                    game.y += ny * 2;

                    // Push asteroid
                    asteroid.vx -= nx * push * 0.5 * dt;
                    asteroid.vy -= ny * push * 0.5 * dt;

                    game.camera.shake = 5;
                    console.log("Part Collision Detected!");
                }
            }

            // Keep asteroid within valid room bounds
            if (game.currentRoom) {
                const r = game.currentRoom;
                const margin = asteroid.radius;
                if (asteroid.x < r.x + margin) { asteroid.x = r.x + margin; asteroid.vx = Math.abs(asteroid.vx); }
                else if (asteroid.x > r.x + r.width - margin) { asteroid.x = r.x + r.width - margin; asteroid.vx = -Math.abs(asteroid.vx); }

                if (asteroid.y < r.y + margin) { asteroid.y = r.y + margin; asteroid.vy = Math.abs(asteroid.vy); }
                else if (asteroid.y > r.y + r.height - margin) { asteroid.y = r.y + r.height - margin; asteroid.vy = -Math.abs(asteroid.vy); }
            }

            if (asteroid.isDead) {
                game.asteroids.splice(i, 1);
            } else {
                // Asteroid vs Asteroid
                for (let j = i - 1; j >= 0; j--) {
                    const other = game.asteroids[j];
                    if (other.isDead) continue;

                    const info = Collision.circleCircleInfo(asteroid.x, asteroid.y, asteroid.radius, other.x, other.y, other.radius);

                    if (info.hit) {
                        // Use unified helpers
                        Collision.separateCircles(asteroid, other, info.overlap, info.dx, info.dy, info.dist);
                        Collision.bounceCircles(asteroid, other, info.dx, info.dy, info.dist, 100, dt);
                    }
                }
            }
        }


        // Update Loot Crates & Collision
        for (let i = game.lootCrates.length - 1; i >= 0; i--) {
            const crate = game.lootCrates[i];
            crate.update(dt);

            // Keep crate within valid room bounds
            if (game.currentRoom) {
                const r = game.currentRoom;
                const margin = crate.radius;
                if (crate.x < r.x + margin) { crate.x = r.x + margin; crate.vx = Math.abs(crate.vx); }
                else if (crate.x > r.x + r.width - margin) { crate.x = r.x + r.width - margin; crate.vx = -Math.abs(crate.vx); }

                if (crate.y < r.y + margin) { crate.y = r.y + margin; crate.vy = Math.abs(crate.vy); }
                else if (crate.y > r.y + r.height - margin) { crate.y = r.y + r.height - margin; crate.vy = -Math.abs(crate.vy); }
            }

            // Player vs Crate (Collision)
            if (!crate.isOpened) {
                const col = game.playerShip.checkCollision(game.x, game.y, game.rotation, crate.x, crate.y, crate.radius);

                if (col.hit) {
                    const dx = col.worldX - crate.x;
                    const dy = col.worldY - crate.y;
                    const distSq = dx * dx + dy * dy;
                    const dist = Math.sqrt(distSq) || 0.1;

                    const nx = dx / dist;
                    const ny = dy / dist;

                    const push = 2000;

                    game.vx += nx * push * dt;
                    game.vy += ny * push * dt;
                    game.x += nx * 2;
                    game.y += ny * 2;

                    // Transfer player momentum to crate (stronger push)
                    const playerSpeed = Math.sqrt(game.vx * game.vx + game.vy * game.vy);
                    const impactForce = Math.max(100, playerSpeed * 1.5);
                    crate.vx -= nx * impactForce;
                    crate.vy -= ny * impactForce;

                    // Hit Spin
                    crate.rotSpeed += (Math.random() - 0.5) * 8;
                }

                // Crate vs Crate
                for (let j = i - 1; j >= 0; j--) {
                    const other = game.lootCrates[j];
                    if (other.isOpened && crate.isOpened) continue;

                    const info = Collision.circleCircleInfo(crate.x, crate.y, crate.radius, other.x, other.y, other.radius);

                    if (info.hit) {
                        Collision.separateCircles(crate, other, info.overlap, info.dx, info.dy, info.dist);
                        Collision.bounceCircles(crate, other, info.dx, info.dy, info.dist, 200, dt);

                        // Spin
                        crate.rotSpeed += (Math.random() - 0.5) * 2;
                        other.rotSpeed -= (Math.random() - 0.5) * 2;
                    }
                }

                // Crate vs Asteroid
                for (const asteroid of game.asteroids) {
                    if (asteroid.isDead || asteroid.isBroken) continue;

                    const info = Collision.circleCircleInfo(crate.x, crate.y, crate.radius, asteroid.x, asteroid.y, asteroid.radius);

                    if (info.hit) {
                        Collision.separateCircles(crate, asteroid, info.overlap, info.dx, info.dy, info.dist);
                        Collision.bounceCircles(crate, asteroid, info.dx, info.dy, info.dist, 1000, dt);

                        crate.rotSpeed += (Math.random() - 0.5) * 5;
                    }
                }
            }
        }
    }
}
