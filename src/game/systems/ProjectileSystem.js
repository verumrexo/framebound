import { Projectile } from '../../shared/entities/Projectile.js';
import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';
import { ItemPickup } from '../../shared/entities/ItemPickup.js';
import { Collision } from '../../shared/CollisionSystem.js';
import { hasLoadedSound } from './GameAudio.js';
import { damageSourceFromProjectile } from './CombatTelemetry.js';
import { partSoundEventKey } from '../audio/SoundEventRegistry.js';

export class ProjectileSystem {
    constructor(game, {
        ProjectileClass = Projectile,
        random = Math.random
    } = {}) {
        this.game = game;
        this.ProjectileClass = ProjectileClass;
        this.random = random;
    }

    update(dt) {
        return updateProjectiles.call(this.game, dt, this.random);
    }

    spawnEnemyProjectile(data) {
        const game = this.game;
        const projectile = new this.ProjectileClass(
            data.x,
            data.y,
            data.angle,
            data.type,
            data.speed,
            'enemy',
            data.damage,
            null,
            this.random
        );
        game.projectiles.push(projectile);

        const sound = data.type === 'railgun' ?
            'rail_shot' :
            (data.type === 'saber' ? 'shoot_lsr' : 'shoot_lps');
        game.audio.play(sound, { volume: 0.6 });
        return projectile;
    }
}

function updateProjectiles(dt, random) {
    this.projectileClock = (this.projectileClock || 0) + dt;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.update(dt, this);

        if (p.type === 'proximity_mine' && p.armed && !p.isDead) {
            const trigger = findNearestHostile(this, p.x, p.y, p.triggerRadius || 80, p);
            if (trigger) {
                p.triggered = true;
                p.isDead = true;
                p.shouldExplode = true;
            }
        }

        if (p.owner === 'player') {
            if (!p.isVisualOnly) { // High-rate visual beams don't do collision
                // Enemy Collision (Check shields first, then body)
                for (const enemy of this.enemies) {
                    if (p.isDead && !p.isBeam) break;
                    if (enemy.isDead) continue;
                    if (isHackedAlly(enemy) && p.type !== 'hack_dart') continue;
                    if (p.type === 'proximity_mine' || p.type === 'shrapnel_grenade') continue;
                    if (hasHitTarget(p, enemy)) continue;

                    // Check shields first (non-beam projectiles only)
                    if (!p.isBeam) {
                        const shieldResult = enemy.checkShieldHit(p.x, p.y);
                        if (shieldResult.hit) {
                            p.isDead = true;
                            markExplosion(p);
                            this.audio.play('shield_hit', { volume: 0.5, pitch: 1.2 });
                            // Spawn shield hit effect
                            this.spawnExplosion(shieldResult.shieldX, shieldResult.shieldY, 15, 0.3, '#00ffff');
                            break;
                        }
                    }

                    if (p.isBeam) {
                        if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, enemy.x, enemy.y, enemy.radius || 20)) {
                            const now = this.projectileClock;
                            const lastHit = p.targetHits.get(enemy);
                            if (lastHit === undefined || now - lastHit > 0.1) {
                                if (p.type === 'hack_dart') {
                                    applyHack(enemy, p);
                                }
                                enemy.takeDamage(p.damage, p.type);
                                applyEnergyChain(this, p, enemy);
                                const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
                                const hX = p.x + Math.cos(p.angle) * dist;
                                const hY = p.y + Math.sin(p.angle) * dist;
                                this.spawnDamageNumber(
                                    hX,
                                    hY,
                                    p.damage,
                                    false,
                                    damageSourceFromProjectile(p)
                                );
                                p.targetHits.set(enemy, now);
                                const isFreeze = p.type === 'beam_freeze';
                                const hitVol = isFreeze ? 0.05 : 0.3;
                                playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: hitVol, pitch: 1.3, randomizePitch: 0.1, isSpammy: isFreeze });

                                // Sync Hit
                                if (!this.partLabSimulation?.active && this.network && this.network.isConnected) {
                                    this.network.sendEnemyHit(enemy.id, p.damage, enemy.isDead);
                                }
                            }
                        }
                    } else {
                        // Per-part collision check
                        const hitResult = enemy.checkPartHit(p.x, p.y, p.radius || 4);
                        if (hitResult.hit) {
                            if (p.type === 'hack_dart') {
                                applyHack(enemy, p);
                            }
                            enemy.takeDamage(p.damage, p.type);
                            applyEnergyChain(this, p, enemy);
                            this.spawnDamageNumber(
                                p.x,
                                p.y,
                                p.damage,
                                false,
                                damageSourceFromProjectile(p)
                            );
                            playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: 0.5, pitch: 1.3, randomizePitch: 0.1 });
                            consumeDirectHit(p, enemy, this);
                            markExplosion(p);

                            // Sync Hit
                            if (!this.partLabSimulation?.active && this.network && this.network.isConnected) {
                                this.network.sendEnemyHit(enemy.id, p.damage, enemy.isDead);
                            }
                        }
                    }
                }

                // Boss Collision
                for (const boss of this.bosses) {
                    if (p.isDead && !p.isBeam) break;
                    if (boss.isDead) continue;
                    if (p.type === 'proximity_mine' || p.type === 'shrapnel_grenade') continue;
                    if (hasHitTarget(p, boss)) continue;
                    if (p.isBeam) {
                        const tdx = boss.x - p.x;
                        const tdy = boss.y - p.y;
                        const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                        const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);
                        const hitRange = (p.radius || 10) + (boss.radius || 60);
                        if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                            const now = this.projectileClock;
                            const lastHit = p.targetHits.get(boss);
                            if (lastHit === undefined || now - lastHit > 0.1) {
                                if (p.type !== 'hack_dart') {
                                    boss.takeDamage(p.damage, p.type);
                                    applyEnergyChain(this, p, boss);
                                }
                                const hX = p.x + Math.cos(p.angle) * bx;
                                const hY = p.y + Math.sin(p.angle) * bx;
                                this.spawnDamageNumber(
                                    hX,
                                    hY,
                                    p.damage,
                                    false,
                                    damageSourceFromProjectile(p)
                                );
                                p.targetHits.set(boss, now);
                                const isFreeze = p.type === 'beam_freeze';
                                const hitVol = isFreeze ? 0.08 : 0.4;
                                playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: hitVol, pitch: 0.7, isSpammy: isFreeze });
                            }
                        }
                    } else {
                        // Check Boss Shields
                        const shieldResult = boss.checkShieldHit(p.x, p.y);
                        if (shieldResult.hit) {
                            this.audio.play('shield_hit', { volume: 0.8, pitch: 0.8 });
                            p.isDead = true;
                            markExplosion(p);
                            break;
                        }

                        const hitResult = boss.checkPartHit(p.x, p.y, p.radius || 4);
                        if (hitResult.hit) {
                            if (p.type !== 'hack_dart') {
                                boss.takeDamage(p.damage, p.type);
                                applyEnergyChain(this, p, boss);
                            }
                            this.spawnDamageNumber(
                                p.x,
                                p.y,
                                p.damage,
                                false,
                                damageSourceFromProjectile(p)
                            );
                            playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: 0.8, pitch: 0.8 });
                            consumeDirectHit(p, boss, this);
                            markExplosion(p);
                            if (p.isDead) break;
                        }
                    }
                }

                // Shipwreck Collision
                for (let j = this.shipwrecks.length - 1; j >= 0; j--) {
                    if (p.isDead && !p.isBeam) break;
                    const wreck = this.shipwrecks[j];
                    if (wreck.isDead) continue;
                    if (!p.isBeam && hasHitTarget(p, wreck)) continue;
                    const dx = p.x - wreck.x;
                    const dy = p.y - wreck.y;
                    if (dx * dx + dy * dy > 400 * 400) continue;

                    if (p.isBeam) {
                        // Beam vs Wreck parts
                        if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, wreck.x, wreck.y, wreck.radius || 60)) {
                            const now = this.projectileClock;
                            const lastHit = p.targetHits.get(wreck);
                            if (lastHit === undefined || now - lastHit > 0.1) {
                                const hitResult = wreck.takeDamage(p.damage, wreck.x, wreck.y);
                                p.targetHits.set(wreck, now);
                                const isFreeze = p.type === 'beam_freeze';
                                playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: isFreeze ? 0.05 : 0.3, pitch: 0.8, isSpammy: isFreeze });
                                if (hitResult && hitResult.destroyed && hitResult.shouldDrop) {
                                    this.itemPickups.push(new ItemPickup(hitResult.x, hitResult.y, hitResult.partId));
                                    playProjectileEvent(this.audio, p, 'detonate', 'explosion', { volume: 0.4, pitch: 1.2 });
                                }
                            }
                        }
                    } else {
                        const hitResult = wreck.takeDamage(p.damage, p.x, p.y);
                        if (hitResult && hitResult.destroyed !== undefined) {
                            consumeDirectHit(p, wreck);
                            markExplosion(p);
                            playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: 0.4, pitch: 0.8 });
                            if (hitResult.destroyed && hitResult.shouldDrop) {
                                this.itemPickups.push(new ItemPickup(hitResult.x, hitResult.y, hitResult.partId));
                                playProjectileEvent(this.audio, p, 'detonate', 'explosion', { volume: 0.4, pitch: 1.2 });
                            } else if (hitResult.destroyed) {
                                playProjectileEvent(this.audio, p, 'detonate', 'explosion', { volume: 0.3, pitch: 1.5 });
                            }
                        }
                    }
                    if (wreck.isDead) this.shipwrecks.splice(j, 1);
                }

                // Asteroid Collision
                for (const asteroid of this.asteroids) {
                    if (p.isDead && !p.isBeam) break;
                    if (asteroid.isDead || asteroid.isBroken) continue;
                    if (!p.isBeam && hasHitTarget(p, asteroid)) continue;
                    if (p.isBeam) {
                        if (Collision.beamCircle(p.x, p.y, p.angle, p.beamLength, p.radius || 10, asteroid.x, asteroid.y, asteroid.radius)) {
                            const now = this.projectileClock;
                            const lastHit = p.targetHits.get(asteroid);
                            if (lastHit === undefined || now - lastHit > 0.1) {
                                if (asteroid.takeDamage(p.damage)) this.spawnAsteroidLoot(asteroid);
                                p.targetHits.set(asteroid, now);
                                const isFreeze = p.type === 'beam_freeze';
                                const hitVol = isFreeze ? 0.05 : 0.3;
                                playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: hitVol, pitch: 0.5, isSpammy: isFreeze });
                            }
                        }
                    } else {
                        const dx = asteroid.x - p.x;
                        const dy = p.y - asteroid.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + asteroid.radius;
                        if (distSq < minDist * minDist) {
                            if (asteroid.takeDamage(p.damage)) this.spawnAsteroidLoot(asteroid);
                            consumeDirectHit(p, asteroid);
                            markExplosion(p);
                            playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: 0.4, pitch: 0.5 });
                        }
                    }
                }

                // Loot Crate Collision
                for (const crate of this.lootCrates) {
                    if (p.isDead && !p.isBeam) break;
                    if (crate.isOpened) continue;
                    if (!p.isBeam && hasHitTarget(p, crate)) continue;
                    if (p.isBeam) {
                        const tdx = crate.x - p.x;
                        const tdy = crate.y - p.y;
                        const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                        const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);
                        const hitRange = (p.radius || 10) + crate.radius;
                        if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                            const now = this.projectileClock;
                            const lastHit = p.targetHits.get(crate);
                            if (lastHit === undefined || now - lastHit > 0.1) {
                                if (crate.takeDamage(p.damage)) this.spawnCrateLoot(crate);
                                p.targetHits.set(crate, now);
                                const isFreeze = p.type === 'beam_freeze';
                                const hitVol = isFreeze ? 0.05 : 0.3;
                                playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: hitVol, pitch: 1.2, isSpammy: isFreeze });
                            }
                        }
                    } else {
                        const dx = crate.x - p.x;
                        const dy = crate.y - p.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + crate.radius;
                        if (distSq < minDist * minDist) {
                            if (crate.takeDamage(p.damage)) this.spawnCrateLoot(crate);
                            else crate.rotSpeed += (random() - 0.5) * 3;
                            consumeDirectHit(p, crate);
                            markExplosion(p);
                            playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: 0.3, pitch: 1.2 });
                        }
                    }
                }

                // Player projectile hitting Enemy Drones
                for (const drone of this.drones) {
                    if (p.isDead && !p.isBeam) break;
                    if (drone.isDead || drone.owner !== 'enemy') continue;
                    if (!p.isBeam && hasHitTarget(p, drone)) continue;
                    if (p.isBeam) {
                        const tdx = drone.x - p.x;
                        const tdy = drone.y - p.y;
                        const bx = tdx * Math.cos(-p.angle) - tdy * Math.sin(-p.angle);
                        const by = tdx * Math.sin(-p.angle) + tdy * Math.cos(-p.angle);
                        const hitRange = (p.radius || 10) + (drone.radius || 8);
                        if (bx > 0 && bx < p.beamLength && Math.abs(by) < hitRange) {
                            const now = this.projectileClock;
                            const lastHit = p.targetHits.get(drone);
                            if (lastHit === undefined || now - lastHit > 0.1) {
                                drone.takeDamage(p.damage);
                                p.targetHits.set(drone, now);
                                const isFreeze = p.type === 'beam_freeze';
                                playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: isFreeze ? 0.1 : 0.3, pitch: 1.5, isSpammy: isFreeze });
                            }
                        }
                    } else {
                        const dx = drone.x - p.x;
                        const dy = drone.y - p.y;
                        const distSq = dx * dx + dy * dy;
                        const minDist = (p.radius || 4) + (drone.radius || 8);
                        if (distSq < minDist * minDist) {
                            drone.takeDamage(p.damage);
                            consumeDirectHit(p, drone);
                            markExplosion(p);
                            playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: 0.3, pitch: 1.5 });
                            if (p.isDead) break;
                        }
                    }
                }
            }
        } else {
            // Enemy projectile hitting Drones
            for (const drone of this.drones) {
                if (drone.isDead) continue;
                const dx = drone.x - p.x;
                const dy = drone.y - p.y;
                const distSq = dx * dx + dy * dy;
                const minDist = (drone.radius || 8) + (p.radius || 4);

                if (distSq < minDist * minDist) {
                    drone.takeDamage(p.damage);
                    p.isDead = true;
                    if (p.type === 'rocket' || p.type === 'mini_grenade' || p.type === 'cluster_grenade') p.shouldExplode = true;
                    playProjectileEvent(this.audio, p, 'impact', 'hit', { volume: 0.2, pitch: 1.8 });
                    break; // One projectile hits one drone
                }
            }

            // Decoys intercept enemy fire before it can reach player ships.
            if (!p.isDead) {
                for (const decoy of this.decoys || []) {
                    if (!decoy || decoy.isDead) continue;

                    if (p.isBeam) {
                        if (!Collision.beamCircle(
                            p.x,
                            p.y,
                            p.angle,
                            p.beamLength,
                            p.radius || 10,
                            decoy.x,
                            decoy.y,
                            decoy.radius || 22
                        )) continue;

                        if (!p.targetHits) p.targetHits = new Map();
                        const now = this.projectileClock;
                        const lastHit = p.targetHits.get(decoy);
                        if (lastHit !== undefined && now - lastHit <= 0.15) continue;

                        const damage = p.damage || 5;
                        decoy.takeDamage?.(damage);
                        p.targetHits.set(decoy, now);
                        this.spawnDamageNumber(
                            decoy.x,
                            decoy.y,
                            damage,
                            true
                        );
                        playProjectileEvent(this.audio, p, 'impact', 'hit', {
                            volume: 0.8,
                            pitch: 0.7,
                            randomizePitch: 0.1
                        });
                        continue;
                    }

                    const dx = decoy.x - p.x;
                    const dy = decoy.y - p.y;
                    const hitDistance = (p.radius || 4) + (decoy.radius || 22);
                    if (dx * dx + dy * dy >= hitDistance * hitDistance) continue;

                    const damage = p.damage || 5;
                    decoy.takeDamage?.(damage);
                    this.spawnDamageNumber(
                        decoy.x,
                        decoy.y,
                        damage,
                        true
                    );
                    playProjectileEvent(this.audio, p, 'impact', 'hit', {
                        volume: 0.8,
                        pitch: 0.7,
                        randomizePitch: 0.1
                    });
                    markExplosion(p);
                    p.isDead = true;
                    break;
                }
            }

            if (!p.isDead) {
                for (const target of getPlayerTargets(this)) {
                    const collision = collideEnemyProjectileWithShip(
                        this,
                        p,
                        target
                    );
                    if (collision.hit) {
                        const damage = p.damage || 5;
                        target.ship.takeDamage(damage);
                        this.spawnDamageNumber(
                            target.x,
                            target.y,
                            damage,
                            true
                        );
                        playProjectileEvent(this.audio, p, 'impact', 'hit', {
                            volume: 0.8,
                            pitch: 0.7,
                            randomizePitch: 0.1
                        });
                        if (!p.isBeam) p.isDead = true;
                    }
                    if (p.isDead) break;
                }
            }

            // Enemy projectile vs Asteroids
            if (!p.isDead) {
                for (const asteroid of this.asteroids) {
                    if (asteroid.isDead || asteroid.isBroken) continue;
                    const dx = asteroid.x - p.x;
                    const dy = asteroid.y - p.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = (p.radius || 4) + asteroid.radius;
                    if (distSq < minDist * minDist) {
                        if (asteroid.takeDamage(p.damage || 5)) {
                            this.spawnAsteroidLoot(asteroid);
                        }
                        p.isDead = true;
                        break;
                    }
                }
            }

            // Enemy projectile vs Loot Crates
            if (!p.isDead) {
                for (const crate of this.lootCrates) {
                    if (crate.isOpened) continue;
                    const dx = crate.x - p.x;
                    const dy = crate.y - p.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = (p.radius || 4) + crate.radius;
                    if (distSq < minDist * minDist) {
                        if (crate.takeDamage(p.damage || 5)) {
                            this.spawnCrateLoot(crate);
                        }
                        p.isDead = true;
                        break;
                    }
                }
            }

        } // End else (enemy projectiles)

        // --- ALL-PROJECTILE COLLISIONS (Enemy/Boss/Asteroid) ---
        // Note: Player-projectiles already checked this in the if(owner==='player') branch.
        // But we'll consolidate it here for Enemy projectiles or just re-unify everything.
        // Actually, let's keep it separate to avoid double-hits for player.
        // The user said rockets do "so much damage", likely because they were hitting 
        // the Boss once in the player-branch and once in the aoe-branch.

        // Note: Enemy projectiles do NOT damage other enemies (no friendly fire)

        // --- Handle On-Death Effects (Explosions/Splitting) ---
        if (p.isDead) {
            if (p.shouldExplode) {
                // --- AOE Damage (Respect Ownership) ---
                const baseRadius = p.blastRadius ||
                    (p.type === 'ggbm' ? 60 :
                        (p.type === 'cluster_grenade' ? 50 :
                            (p.type === 'mini_grenade' ? 25 : 40)));
                const radius = baseRadius * (p.blastRadiusMul || 1);
                const life = p.type === 'ggbm' ? 0.6 : 0.4;
                const color = p.type === 'proximity_mine' ? '#ffdd55' :
                    (p.type === 'shrapnel_grenade' ? '#ffd166' :
                        ((p.type === 'cluster_grenade' || p.type === 'mini_grenade') ? '#44ff44' : '#ffaa00'));
                this.spawnExplosion(p.x, p.y, radius, life, color);
                playProjectileEvent(this.audio, p, 'detonate', 'explosion', { volume: 0.3, pitch: 1.2 });

                const isShrapnelBurst = p.type === 'shrapnel_grenade';
                if (p.owner === 'player' && !isShrapnelBurst) {
                    // AOE Damage to Enemies
                    for (const enemy of this.enemies) {
                        if (enemy.isDead || isHackedAlly(enemy)) continue;
                        const dx = p.x - enemy.x;
                        const dy = p.y - enemy.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < (radius + (enemy.radius || 20)) ** 2) {
                            const aoeDmg = p.explosionDamage ?? Math.ceil(p.damage * 0.5);
                            enemy.takeDamage(aoeDmg, p.type);
                            this.spawnDamageNumber(
                                enemy.x,
                                enemy.y,
                                aoeDmg,
                                false,
                                damageSourceFromProjectile(p)
                            );
                        }
                    }

                    // AOE Damage to Bosses
                    for (const boss of this.bosses) {
                        if (boss.isDead) continue;
                        const dx = p.x - boss.x;
                        const dy = p.y - boss.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < (radius + (boss.radius || 60)) ** 2) {
                            const aoeDmg = p.explosionDamage ?? Math.ceil(p.damage * 0.5);
                            boss.takeDamage(aoeDmg, p.type);
                            this.spawnDamageNumber(
                                boss.x,
                                boss.y,
                                aoeDmg,
                                false,
                                damageSourceFromProjectile(p)
                            );
                            if (!boss.isDead) boss.flash = 5;
                        }
                    }
                } else if (p.owner !== 'player') {
                    // Enemy projectile AOE vs every host-owned player.
                    for (const target of getPlayerTargets(this)) {
                        const dx = p.x - target.x;
                        const dy = p.y - target.y;
                        const distSq = dx * dx + dy * dy;
                        const playerRad = 20;
                        if (distSq >= (radius + playerRad) ** 2) continue;
                        const aoeDmg = Math.ceil((p.damage || 10) * 0.5);
                        target.ship.takeDamage(aoeDmg);
                        this.spawnDamageNumber(
                            target.x,
                            target.y,
                            aoeDmg,
                            true
                        );
                    }
                }

                // Cluster Grenade: Spawn child grenades
                if (p.type === 'cluster_grenade') {
                    const childCount = p.clusterCount || 6;
                    for (let c = 0; c < childCount; c++) {
                        const childAngle =
                            (c / childCount) * Math.PI * 2 +
                            (random() - 0.5) * 0.3;
                        const childProj = new Projectile(
                            p.x,
                            p.y,
                            childAngle,
                            'mini_grenade',
                            250,
                            p.owner,
                            p.damage * 0.5,
                            null,
                            random
                        );
                        childProj.life = 0.8 + random() * 0.4;
                        childProj.blastRadiusMul = p.blastRadiusMul || 1;
                        childProj.weaponFamily = p.weaponFamily;
                        childProj.sourcePartId = p.sourcePartId;
                        childProj.sourcePartKey = p.sourcePartKey;
                        childProj.sourcePartName = p.sourcePartName;
                        childProj.sourcePlayerId = p.sourcePlayerId;
                        childProj.projectileLook = p.projectileLook || 'default';
                        childProj.projectileTrail = p.projectileTrail || 'default';
                        this.projectiles.push(childProj);
                    }
                    playProjectileEvent(this.audio, p, 'detonate', 'explosion', { volume: 0.5, pitch: 0.8 });
                }

                if (p.type === 'shrapnel_grenade') {
                    const fragmentCount = p.shrapnelCount || 10;
                    for (let c = 0; c < fragmentCount; c++) {
                        const childAngle = p.angle + (c / fragmentCount) * Math.PI * 2;
                        const fragment = new Projectile(
                            p.x,
                            p.y,
                            childAngle,
                            'shrapnel_fragment',
                            460,
                            p.owner,
                            p.shrapnelDamage ?? 3.5,
                            0.8,
                            random
                        );
                        fragment.weaponFamily = p.weaponFamily;
                        fragment.sourcePartId = p.sourcePartId;
                        fragment.sourcePartKey = p.sourcePartKey;
                        fragment.sourcePartName = p.sourcePartName;
                        fragment.sourcePlayerId = p.sourcePlayerId;
                        fragment.projectileLook = p.projectileLook || 'default';
                        fragment.projectileTrail = p.projectileTrail || 'default';
                        this.projectiles.push(fragment);
                    }
                }
            }
            this.projectiles.splice(i, 1);
        }
    } // End Projectile LOOP

}

function playProjectileEvent(audio, projectile, slot, fallbackName, options) {
    if (projectile.sourcePartId && typeof audio.playEvent === 'function') {
        return audio.playEvent(
            partSoundEventKey(projectile.sourcePartId, slot),
            fallbackName,
            options
        );
    }
    return audio.play(fallbackName, options);
}

const EXPLOSIVE_PROJECTILES = new Set([
    'rocket',
    'rocket_le',
    'rocket_he',
    'guided_rocket',
    'ggbm',
    'cluster_grenade',
    'mini_grenade',
    'tiny_grenade',
    'proximity_mine',
    'shrapnel_grenade',
    'torpedo'
]);

function markExplosion(projectile) {
    if (EXPLOSIVE_PROJECTILES.has(projectile.type)) {
        projectile.shouldExplode = true;
    }
}

function hasHitTarget(projectile, target) {
    return projectile.hitTargets?.has(target) || false;
}

function consumeDirectHit(projectile, target, game = null) {
    if (!projectile.hitTargets) projectile.hitTargets = new Set();
    projectile.hitTargets.add(target);

    if (projectile.type === 'ricochet_slug' && game && projectile.ricochetCount > 0) {
        const next = findNearestHostile(
            game,
            target.x,
            target.y,
            projectile.ricochetRange || 320,
            projectile
        );
        if (next) {
            projectile.ricochetCount--;
            projectile.damage *= projectile.ricochetDamageMul || 0.7;
            projectile.x = target.x;
            projectile.y = target.y;
            projectile.angle = Math.atan2(next.y - target.y, next.x - target.x);
            const speed = projectile.speed || Math.hypot(projectile.vx || 0, projectile.vy || 0) || 800;
            projectile.speed = speed;
            projectile.vx = Math.cos(projectile.angle) * speed;
            projectile.vy = Math.sin(projectile.angle) * speed;
            projectile.isDead = false;
            return;
        }
    }

    if (
        !EXPLOSIVE_PROJECTILES.has(projectile.type) &&
        projectile.remainingPierces > 0
    ) {
        projectile.remainingPierces--;
        return;
    }
    projectile.isDead = true;
}

function isHackedAlly(target) {
    return target?.hackTimer > 0 &&
        target?.hackedByPlayerId !== undefined &&
        target?.hackedByPlayerId !== null;
}

function applyHack(enemy, projectile) {
    enemy.hackTimer = projectile.hackDuration || 8;
    enemy.hackedByPlayerId = projectile.sourcePlayerId;
}

function findNearestHostile(game, x, y, range, projectile = null) {
    const rangeSq = range * range;
    let nearest = null;
    let nearestSq = rangeSq;
    for (const target of [...(game.enemies || []), ...(game.bosses || [])]) {
        if (!target || target.isDead || isHackedAlly(target)) continue;
        if (projectile && hasHitTarget(projectile, target)) continue;
        const dx = target.x - x;
        const dy = target.y - y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < nearestSq) {
            nearest = target;
            nearestSq = distanceSq;
        }
    }
    return nearest;
}

function applyEnergyChain(game, projectile, primaryTarget) {
    let remaining = Math.floor(projectile.chainCount || 0);
    if (remaining <= 0) return;

    const hit = new Set([primaryTarget]);
    const candidates = [
        ...(game.enemies || []),
        ...(game.bosses || [])
    ];
    let source = primaryTarget;
    let damage = projectile.damage;

    while (remaining-- > 0) {
        let next = null;
        let nearestSq = 260 * 260;
        for (const candidate of candidates) {
            if (candidate.isDead || hit.has(candidate) || isHackedAlly(candidate)) continue;
            const dx = candidate.x - source.x;
            const dy = candidate.y - source.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq >= nearestSq) continue;
            nearestSq = distanceSq;
            next = candidate;
        }
        if (!next) break;

        damage *= 0.55;
        next.takeDamage(damage, projectile.type);
        game.spawnDamageNumber(
            next.x,
            next.y,
            damage,
            false,
            damageSourceFromProjectile(projectile)
        );
        game.spawnExplosion(next.x, next.y, 8, 0.18, '#35f2ff');
        if (!game.partLabSimulation?.active && game.network?.isConnected && next.id !== undefined) {
            game.network.sendEnemyHit(next.id, damage, next.isDead);
        }
        hit.add(next);
        source = next;
    }
}

function getPlayerTargets(game) {
    const targets = [];
    if (game.playerShip && !game.playerShip.isDead) {
        targets.push({
            id: 'host',
            ship: game.playerShip,
            x: game.x,
            y: game.y,
            rotation: game.rotation
        });
    }
    if (game.partLabSimulation?.active || !game.peerNetwork?.isHost) return targets;

    for (const [id, ship] of game.peerNetwork.otherPlayers) {
        if (!ship?.isDead) {
            targets.push({
                id,
                ship,
                x: ship.x,
                y: ship.y,
                rotation: ship.rotation
            });
        }
    }
    return targets;
}

function collideEnemyProjectileWithShip(game, projectile, target) {
    const ship = target.ship;
    const shipCos = Math.cos(target.rotation);
    const shipSin = Math.sin(target.rotation);
    const projectileRadius = projectile.radius || 4;
    const cellRadius = TILE_SIZE / 2;

    for (const key of ship.parts.keys()) {
        const [cellX, cellY] = key.split(',').map(Number);
        const localX = cellX * TILE_SIZE;
        const localY = cellY * TILE_SIZE;
        const worldX = target.x + (
            localX * shipCos - localY * shipSin
        );
        const worldY = target.y + (
            localX * shipSin + localY * shipCos
        );
        const part = ship.parts.get(key);
        const definition = PartsLibrary[part.partId];
        if (!definition) continue;
        let effectiveRadius = cellRadius;
        if (
            definition.type === 'shield' &&
            (!part.shieldCooldown || part.shieldCooldown <= 0)
        ) {
            effectiveRadius *= definition.stats.shieldRadiusScale || 1.4;
        }

        let hit = false;
        if (projectile.isBeam) {
            const dx = worldX - projectile.x;
            const dy = worldY - projectile.y;
            const beamX = (
                dx * Math.cos(-projectile.angle) -
                dy * Math.sin(-projectile.angle)
            );
            const beamY = (
                dx * Math.sin(-projectile.angle) +
                dy * Math.cos(-projectile.angle)
            );
            if (
                beamX > 0 &&
                beamX < projectile.beamLength &&
                Math.abs(beamY) < effectiveRadius + projectileRadius
            ) {
                const now = game.projectileClock || 0;
                const hitKey = `${target.id}:${key}`;
                const lastHit = projectile.targetHits.get(hitKey);
                if (lastHit === undefined || now - lastHit > 0.15) {
                    hit = true;
                    projectile.targetHits.set(hitKey, now);
                }
            }
        } else {
            const dx = projectile.x - worldX;
            const dy = projectile.y - worldY;
            const hitDistance = effectiveRadius + projectileRadius;
            hit = dx * dx + dy * dy < hitDistance * hitDistance;
        }
        if (!hit) continue;

        if (
            definition.type === 'shield' &&
            (!part.shieldCooldown || part.shieldCooldown <= 0)
        ) {
            part.shieldCooldown = definition.stats.shieldCooldown || 3;
            if (game.audio.playEvent) {
                game.audio.playEvent(
                    partSoundEventKey(definition.id, 'hit'),
                    'shield_hit',
                    { volume: 0.8 }
                );
            } else {
                game.audio.play('shield_hit', { volume: 0.8 });
            }
            if (!hasLoadedSound(game.audio, 'shield_hit')) {
                game.audio.play('hit', { pitch: 1.5 });
            }
            game.spawnExplosion(worldX, worldY, 25, 0.3, '#00ffff');
            if (!projectile.isBeam) projectile.isDead = true;
            return { hit: false, blocked: true };
        }
        return { hit: true, blocked: false };
    }
    return { hit: false, blocked: false };
}
