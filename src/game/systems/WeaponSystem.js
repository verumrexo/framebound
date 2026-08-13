import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';
import { Projectile } from '../../shared/entities/Projectile.js';
import { dispatchPlayerShot } from './PlayerShotDispatcher.js';
import {
    getPartFireDefault,
    partSoundEventKey
} from '../audio/SoundEventRegistry.js';
import { normalizeProjectileVisuals } from '../../shared/combat/ProjectileVisuals.js';
import {
    getAuthoredMuzzlePositions,
    getAuthoredTurretMount,
    getPartWorldCenter,
    isAuthoredPartGeometry
} from '../../shared/parts/PartVisualGeometry.js';
import {
    getWeaponProfile,
    getProjectileLaunchSpeed,
    getBaseWeaponRange,
    clamp,
    createShipBuildProfile,
    isDirectWeapon,
    isExplosiveWeapon,
    isMeleeWeapon
} from '../../shared/combat/ShipBuildProfile.js';
import { isHostileTo, nearestHostile } from '../../shared/combat/Hostility.js';

function playPartEvent(audio, partId, slot, fallbackName, options) {
    if (typeof audio.playEvent === 'function') {
        return audio.playEvent(partSoundEventKey(partId, slot), fallbackName, options);
    }
    return audio.play(fallbackName, options);
}

function finitePositive(value, fallback = 1) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function wrapAngle(angle) {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
}

function authoredFireSoundSlot(definition) {
    const stats = definition.stats || {};
    const projectile = String(stats.projectileType || '').toLowerCase();
    if (stats.chargeTime) return null;
    if (projectile === 'beam_sword' || projectile === 'saber') return 'swing';
    if (stats.armingTime !== undefined || projectile.includes('mine')) return 'deploy';
    if (stats.weaponGroup === 'rocket' || projectile.includes('rocket') || projectile.includes('grenade')) return 'launch';
    return 'fire';
}

export class WeaponSystem {
    constructor(game, {
        ProjectileClass = Projectile,
        random = Math.random
    } = {}) {
        this.game = game;
        this.staggerTimers = {};
        this.ProjectileClass = ProjectileClass;
        this.random = random;
    }

    update(dt, state) {
        const game = this.game;
        let { isMouseDown, worldMouseX, worldMouseY, levelBonus } = state;
        levelBonus = finitePositive(levelBonus);

        const shipStats = game.playerShip?.stats || {};
        const buildProfile = shipStats.profile || createShipBuildProfile(
            game.playerShip,
            PartsLibrary
        );
        if (game.playerShip) {
            game.playerShip.combatSilenceTimer = Math.max(
                0,
                finiteNumber(game.playerShip.combatSilenceTimer) + dt
            );
            game.playerShip.ambushReady = buildProfile.doctrineId === 'phantom' &&
                game.playerShip.combatSilenceTimer >= finitePositive(buildProfile.ambushArmSeconds, 2.5);
        }

        for (const part of game.playerShip.getUniqueParts()) {
            if (part.shieldCooldown > 0) {
                part.shieldCooldown -= dt;
            }
            if (part.recoil > 0) {
                part.recoil -= dt * 20;
                if (part.recoil < 0) part.recoil = 0;
            }
        }

        const weaponGroups = {};

        for (const partRef of game.playerShip.getUniqueParts()) {
            const def = PartsLibrary[partRef.partId];
            if (!def || def.type !== 'weapon') continue;

            if (def.stats.rampUp) {
                if (partRef.rampLevel === undefined) partRef.rampLevel = 0;
                if (partRef.peakMeter === undefined) partRef.peakMeter = 0;

                if (partRef.peakMeter > 0) {
                    partRef.peakMeter -= dt;
                    if (partRef.peakMeter <= 0) {
                        partRef.cooldown = def.stats.overheatCooldown || 7;
                        partRef.rampLevel = 0;
                        game.audio.play('overheat', { volume: 0.7 });
                    }
                }

                if (!isMouseDown && partRef.peakMeter <= 0) {
                    partRef.rampLevel = Math.max(0, partRef.rampLevel - dt * 2.0);
                }
            }

            if (partRef.chargeLeft > 0) {
                partRef.chargeLeft -= dt;
                if (partRef.chargeLeft <= 0) {
                    partRef.chargeReady = true;
                }
            }

            const rampFactor = (def.stats.rampUp && partRef.rampLevel) ? 1 + partRef.rampLevel : 1;
            const currentFireRateMul = Math.min(2.5, Math.max(
                0.45,
                levelBonus * getWeaponProfile(buildProfile, def).fireRateMul
            ));

            let baseCooldown = def.stats.cooldown || 0.15;
            if (baseCooldown <= 0.001) baseCooldown = 0.016;
            const adjCooldown = baseCooldown / rampFactor / currentFireRateMul;

            if (!partRef.cooldown) partRef.cooldown = 0;
            if (partRef.cooldown > 0) partRef.cooldown -= dt;

            if (!weaponGroups[def.id]) {
                weaponGroups[def.id] = {
                    def,
                    weapons: [],
                    minBaseCooldown: adjCooldown
                };
            } else {
                weaponGroups[def.id].minBaseCooldown = Math.min(
                    weaponGroups[def.id].minBaseCooldown,
                    adjCooldown
                );
            }
            weaponGroups[def.id].weapons.push({ partRef, def, adjCooldown });
        }

        if (!game.designer.active) {
            for (const [groupId, group] of Object.entries(weaponGroups)) {
                const weaponProfile = getWeaponProfile(buildProfile, group.def);
                const autoFire = !isMouseDown && buildProfile.laserAutofire &&
                    group.def.stats.weaponGroup === 'laser' &&
                    !isMeleeWeapon(group.def);
                const autoTargets = new Map();
                if (autoFire) {
                    for (const weapon of group.weapons) {
                        const center = getPartWorldCenter(game, weapon.partRef, weapon.def);
                        const target = nearestHostile(
                            game.playerShip,
                            [
                                ...(game.enemies || []),
                                ...(game.bosses || []),
                                ...(game.drones || [])
                            ],
                            center.x,
                            center.y,
                            this.getEffectiveRange(group.def, weaponProfile)
                        );
                        if (target) autoTargets.set(weapon.partRef, target);
                    }
                }
                if (!isMouseDown && autoTargets.size === 0) continue;
                if (this.staggerTimers[groupId] === undefined) this.staggerTimers[groupId] = 0;

                const count = group.weapons.length;
                const staggerInterval = Math.min(0.2, group.minBaseCooldown / count);
                this.staggerTimers[groupId] -= dt;

                let safety = 0;
                while (this.staggerTimers[groupId] <= 0 && safety < 50) {
                    safety++;

                    const readyWeapon = group.weapons.find(w =>
                        w.partRef.cooldown <= 0 &&
                        w.partRef.chargeLeft === undefined &&
                        !w.partRef.chargeReady &&
                        (isMouseDown || autoTargets.has(w.partRef))
                    );
                    const chargedWeapon = group.weapons.find(w =>
                        w.partRef.chargeReady &&
                        (isMouseDown || autoTargets.has(w.partRef))
                    );

                    if (readyWeapon || chargedWeapon) {
                        const activeWeapon = chargedWeapon || readyWeapon;
                        const { partRef, def, adjCooldown } = activeWeapon;
                        const autoTarget = autoTargets.get(partRef);
                        const aimX = autoTarget?.x ?? worldMouseX;
                        const aimY = autoTarget?.y ?? worldMouseY;

                        if (!chargedWeapon && def.stats.chargeTime && !partRef.chargeLeft) {
                            partRef.chargeLeft = def.stats.chargeTime;
                            const chargeOptions = def.stats.projectileType === 'saber'
                                ? { volume: 0.3, pitch: 1.5 }
                                : { volume: 0.5 };
                            partRef.chargeSound = playPartEvent(
                                game.audio,
                                def.id,
                                'charge',
                                'rail_charge',
                                chargeOptions
                            );
                            break;
                        }

                        if (chargedWeapon) {
                            partRef.chargeLeft = undefined;
                            partRef.chargeReady = false;

                            if (partRef.chargeSound) {
                                try {
                                    if (partRef.chargeSound.source?.stop) {
                                        partRef.chargeSound.source.stop();
                                    } else {
                                        partRef.chargeSound.stop?.();
                                    }
                                } catch (error) {
                                    console.warn('[Audio] Failed to stop weapon charge:', error);
                                }
                                partRef.chargeSound = null;
                            }

                            const pitch = def.stats.projectileType === 'saber' ? 1.5 : 1.0;
                            playPartEvent(
                                game.audio,
                                def.id,
                                'release',
                                'rail',
                                { volume: 0.7, pitch }
                            );
                        }

                        const { fireX, fireY, angle } = this.getInitialShotOrigin(
                            partRef,
                            def,
                            aimX,
                            aimY
                        );

                        const burstCount = def.stats.burstCount || 0;
                        if (def.stats.weaponGroup === 'rocket') {
                            const rocketBonus = game.playerShip.stats.rocketBayCount || 0;
                            if (burstCount > 0 || rocketBonus > 0) {
                                partRef.burstLeft = (burstCount || 1) + rocketBonus;
                                partRef.burstTimer = 0;
                            }
                        } else if (burstCount > 0) {
                            partRef.burstLeft = burstCount;
                            partRef.burstTimer = 0;
                        }

                        this.prepareAttack(partRef, def, aimX, aimY);

                        if (!(partRef.burstLeft > 0)) {
                            dispatchPlayerShot(game, def, fireX, fireY, angle, partRef);
                            delete partRef.attackDamageMul;
                        }

                        if (def.stats.rampUp) {
                            if (partRef.peakMeter > 0) {
                                partRef.cooldown = adjCooldown;
                            } else {
                                partRef.rampLevel = Math.min(
                                    def.stats.maxRamp || 2.0,
                                    (partRef.rampLevel || 0) + (def.stats.rampRate || 0.5)
                                );
                                if (partRef.rampLevel >= (def.stats.maxRamp || 2.0)) {
                                    partRef.peakMeter = def.stats.peakDuration || 5;
                                }
                                partRef.cooldown = adjCooldown;
                            }
                        } else {
                            partRef.cooldown = adjCooldown;
                        }

                        this.staggerTimers[groupId] += staggerInterval;
                    } else {
                        if (this.staggerTimers[groupId] < 0) this.staggerTimers[groupId] = 0;
                        break;
                    }
                }
            }
        } else {
            for (const key in this.staggerTimers) {
                if (this.staggerTimers[key] < 0) this.staggerTimers[key] = 0;
            }
        }

        for (const partRef of game.playerShip.getUniqueParts()) {
            if (!(partRef.burstLeft > 0)) continue;

            partRef.burstTimer -= dt;
            if (partRef.burstTimer > 0) continue;

            const def = PartsLibrary[partRef.partId];
            if (!def) {
                partRef.burstLeft = 0;
                continue;
            }

            const { fireX, fireY, angle } = this.getBurstShotOrigin(
                partRef,
                def,
                partRef.attackAimX ?? worldMouseX,
                partRef.attackAimY ?? worldMouseY
            );
            dispatchPlayerShot(game, def, fireX, fireY, angle, partRef);

            partRef.burstLeft--;
            if (partRef.burstLeft <= 0) {
                delete partRef.attackDamageMul;
                delete partRef.attackAimX;
                delete partRef.attackAimY;
            }
            let interval = def.stats.burstInterval || 0.1;
            if (def.stats.weaponGroup === 'rocket' && (game.playerShip.stats?.rocketBayCount || 0) > 0) {
                interval /= 1 + game.playerShip.stats.rocketBayCount;
            }
            partRef.burstTimer = interval;
        }

        return { isMouseDown, blockedFrame: false };
    }

    prepareAttack(partRef, def, aimX, aimY) {
        const ship = this.game.playerShip;
        partRef.attackAimX = aimX;
        partRef.attackAimY = aimY;
        partRef.attackDamageMul = 1;
        if (ship?.ambushReady && (isDirectWeapon(def) || isExplosiveWeapon(def))) {
            partRef.attackDamageMul = ship.stats?.profile?.ambushDamageMul || 1;
        }
        if (ship) {
            ship.combatSilenceTimer = 0;
            ship.ambushReady = false;
        }
    }

    getEffectiveRange(def, weaponProfile = getWeaponProfile(this.game.playerShip?.stats?.profile || {}, def)) {
        return getBaseWeaponRange(def) * weaponProfile.rangeMul;
    }

    getInitialShotOrigin(partRef, def, worldMouseX, worldMouseY) {
        if (isAuthoredPartGeometry(def)) {
            return this.getAuthoredShotOrigin(partRef, def, worldMouseX, worldMouseY);
        }
        const game = this.game;
        const isRotated = ((partRef.rotation || 0) % 2 !== 0);
        const width = isRotated ? def.height : def.width;
        const height = isRotated ? def.width : def.height;
        const localCX = (partRef.x + (width - 1) / 2) * TILE_SIZE;
        const localCY = (partRef.y + (height - 1) / 2) * TILE_SIZE;
        const cos = Math.cos(game.rotation);
        const sin = Math.sin(game.rotation);
        let finalX = game.x + (localCX * cos - localCY * sin);
        let finalY = game.y + (localCX * sin + localCY * cos);

        const baseAngle = game.rotation + (partRef.rotation || 0) * (Math.PI / 2);
        if (def.baseSprite && (def.baseSprite.anchorX !== 0.5 || def.baseSprite.anchorY !== 0.5)) {
            const bpx = (def.baseSprite.anchorX - 0.5) * def.baseSprite.width * def.baseSprite.scale;
            const bpy = (def.baseSprite.anchorY - 0.5) * def.baseSprite.height * def.baseSprite.scale;
            finalX += Math.cos(baseAngle) * bpx - Math.sin(baseAngle) * bpy;
            finalY += Math.sin(baseAngle) * bpx + Math.cos(baseAngle) * bpy;
        }

        const rawAngle = Math.atan2(worldMouseY - finalY, worldMouseX - finalX);
        const angle = this.getAssistedAimAngle(rawAngle, finalX, finalY);
        let turretX = finalX;
        let turretY = finalY;

        if (def.turretDrawOffset) {
            if (typeof def.turretDrawOffset === 'object') {
                const ox = def.turretDrawOffset.x || 0;
                const oy = def.turretDrawOffset.y || 0;
                turretX += Math.cos(baseAngle) * ox - Math.sin(baseAngle) * oy;
                turretY += Math.sin(baseAngle) * ox + Math.cos(baseAngle) * oy;
            } else {
                turretX += Math.cos(angle) * def.turretDrawOffset;
                turretY += Math.sin(angle) * def.turretDrawOffset;
            }
        }

        let fireX = turretX;
        let fireY = turretY;
        if (def.stats.barrelPosition) {
            const bx = def.stats.barrelPosition.x || 0;
            const by = def.stats.barrelPosition.y || 0;
            fireX += Math.cos(angle) * bx - Math.sin(angle) * by;
            fireY += Math.sin(angle) * bx + Math.cos(angle) * by;
        } else {
            const barrelLen = height > 1.5 ? TILE_SIZE * 1.3 : TILE_SIZE * 0.6;
            fireX += Math.cos(angle) * barrelLen;
            fireY += Math.sin(angle) * barrelLen;
        }

        return { fireX, fireY, angle };
    }

    getBurstShotOrigin(partRef, def, worldMouseX, worldMouseY) {
        if (isAuthoredPartGeometry(def)) {
            return this.getAuthoredShotOrigin(partRef, def, worldMouseX, worldMouseY);
        }
        const game = this.game;
        const isRotated = ((partRef.rotation || 0) % 2 !== 0);
        const width = isRotated ? def.height : def.width;
        const height = isRotated ? def.width : def.height;
        const localCX = (partRef.x + (width - 1) / 2) * TILE_SIZE;
        const localCY = (partRef.y + (height - 1) / 2) * TILE_SIZE;
        const cos = Math.cos(game.rotation);
        const sin = Math.sin(game.rotation);
        let finalX = game.x + (localCX * cos - localCY * sin);
        let finalY = game.y + (localCX * sin + localCY * cos);

        if (def.baseSprite && (def.baseSprite.anchorX !== 0.5 || def.baseSprite.anchorY !== 0.5)) {
            const baseAngle = game.rotation + (partRef.rotation || 0) * (Math.PI / 2);
            const bpx = (def.baseSprite.anchorX - 0.5) * def.baseSprite.width * def.baseSprite.scale;
            const bpy = (def.baseSprite.anchorY - 0.5) * def.baseSprite.height * def.baseSprite.scale;
            finalX += Math.cos(baseAngle) * bpx - Math.sin(baseAngle) * bpy;
            finalY += Math.sin(baseAngle) * bpx + Math.cos(baseAngle) * bpy;
        }

        const rawAngle = Math.atan2(worldMouseY - finalY, worldMouseX - finalX);
        const angle = this.getAssistedAimAngle(rawAngle, finalX, finalY);
        let fireX = finalX;
        let fireY = finalY;

        if (def.stats.barrelPosition) {
            const bx = def.stats.barrelPosition.x || 0;
            const by = def.stats.barrelPosition.y || 0;
            fireX += Math.cos(angle) * bx - Math.sin(angle) * by;
            fireY += Math.sin(angle) * bx + Math.cos(angle) * by;
        } else {
            let barrelLen = height > 1.5 ? TILE_SIZE * 1.3 : TILE_SIZE * 0.6;
            if (typeof def.turretDrawOffset === 'number') {
                barrelLen += def.turretDrawOffset;
            }
            fireX += Math.cos(angle) * barrelLen;
            fireY += Math.sin(angle) * barrelLen;
        }

        return { fireX, fireY, angle };
    }

    getAuthoredShotOrigin(partRef, def, worldMouseX, worldMouseY) {
        const center = getPartWorldCenter(this.game, partRef, def);
        const mount = getAuthoredTurretMount(
            def,
            center.x,
            center.y,
            center.baseAngle
        );
        const rawAngle = Math.atan2(worldMouseY - mount.y, worldMouseX - mount.x);
        const angle = this.getAssistedAimAngle(rawAngle, mount.x, mount.y);
        const positions = getAuthoredMuzzlePositions(
            def,
            center.x,
            center.y,
            center.baseAngle,
            angle
        );
        const start = Math.max(0, Math.trunc(partRef.muzzleCursor || 0)) % Math.max(1, positions.length);
        partRef.muzzleCursor = (start + 1) % Math.max(1, positions.length);
        partRef.authoredShotMuzzles = positions;
        partRef.authoredShotMuzzleStart = start;
        const muzzle = positions[start] || mount;
        return { fireX: muzzle.x, fireY: muzzle.y, angle };
    }

    getAssistedAimAngle(angle, originX, originY) {
        const stats = this.game.playerShip?.stats || {};
        const cone = finiteNumber(stats.aimAssistAngle);
        const range = finitePositive(stats.aimAssistRange, 0);
        if (cone <= 0 || range <= 0) return angle;

        let closest = null;
        let closestDistanceSq = range * range;
        const candidates = [
            ...(this.game.enemies || []),
            ...(this.game.bosses || [])
        ];
        for (const target of candidates) {
            if (!target || target.isDead) continue;
            if (!isHostileTo(this.game.playerShip, target)) continue;
            const dx = target.x - originX;
            const dy = target.y - originY;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > closestDistanceSq) continue;
            const targetAngle = Math.atan2(dy, dx);
            if (Math.abs(wrapAngle(targetAngle - angle)) > cone) continue;
            closestDistanceSq = distanceSq;
            closest = target;
        }
        return closest
            ? Math.atan2(closest.y - originY, closest.x - originX)
            : angle;
    }

    spawnProjectile(def, fireX, fireY, angle, partRef = null) {
        const game = this.game;
        const projectileCount = def.stats.pelletCount || 1;
        const spread = def.stats.spread || 0;
        const pelletInterval = def.stats.pelletInterval || 0;
        const shipStats = game.playerShip?.stats || {};
        const buildProfile = shipStats.profile || createShipBuildProfile(
            game.playerShip,
            PartsLibrary
        );
        const weaponProfile = getWeaponProfile(buildProfile, def);
        const splitCount = Math.max(0, Math.floor(finiteNumber(shipStats.laserSplitCount)));
        const splitAngle = finiteNumber(shipStats.laserSplitAngle);
        const splitDamageMul = finitePositive(shipStats.laserSplitDamageMul);
        const canSplit = def.stats.weaponGroup === 'laser' &&
            splitCount > 0 && splitAngle > 0;
        let spawnedProjectile = false;

        for (let i = 0; i < projectileCount; i++) {
            const finalAngle = angle + (this.random() - 0.5) * spread;
            let projectileX = fireX;
            let projectileY = fireY;

            const authoredMuzzles = partRef?.authoredShotMuzzles;
            if (Array.isArray(authoredMuzzles) && authoredMuzzles.length > 1) {
                const start = Math.max(0, Math.trunc(partRef.authoredShotMuzzleStart || 0));
                const muzzle = authoredMuzzles[(start + i) % authoredMuzzles.length];
                projectileX = muzzle.x;
                projectileY = muzzle.y;
            }

            if (projectileCount > 1 && def.stats.barrelSpacing) {
                const perpendicularX = Math.cos(angle + Math.PI / 2);
                const perpendicularY = Math.sin(angle + Math.PI / 2);
                const offset = (i - (projectileCount - 1) / 2) * def.stats.barrelSpacing;
                projectileX += perpendicularX * offset;
                projectileY += perpendicularY * offset;
            }

            const projectileType = def.stats.projectileType;
            const baseSpeed = getProjectileLaunchSpeed(def);
            let speed = baseSpeed;
            speed *= weaponProfile.projectileSpeedMul;
            const family = def.stats.weaponGroup;
            const splitAngles = [finalAngle];
            if (canSplit) {
                for (let splitIndex = 0; splitIndex < splitCount; splitIndex++) {
                    const side = splitIndex % 2 === 0 ? -1 : 1;
                    const rank = Math.floor((splitIndex + 1) / 2);
                    splitAngles.push(finalAngle + side * splitAngle * Math.max(1, rank));
                }
            }

            for (let splitIndex = 0; splitIndex < splitAngles.length; splitIndex++) {
                const splitDamage = splitIndex === 0 ? 1 : splitDamageMul;
                const attackDamageMul = finitePositive(partRef?.attackDamageMul);
                const damageMultiplier = clamp(
                    weaponProfile.damageMul * attackDamageMul,
                    0.5,
                    3
                );
                const projectile = new this.ProjectileClass(
                    projectileX,
                    projectileY,
                    splitAngles[splitIndex],
                    def.stats.projectileType || 'bullet',
                    speed,
                    'player',
                    (def.stats.damage || 10) * damageMultiplier * splitDamage,
                    def.stats.lifetime
                );
                projectile.weaponFamily = family;
                projectile.sourcePartId = def.id;
                projectile.sourcePartKey = partRef
                    ? `${def.id}@${partRef.x},${partRef.y}`
                    : def.id;
                projectile.sourcePartName = String(def.name || def.id).toLowerCase();
                projectile.sourcePlayerId = game.sourcePlayerId ||
                    game.peerNetwork?.replicator?.selfId ||
                    'host';
                const projectileVisuals = normalizeProjectileVisuals({
                    look: def.projectileLook,
                    trail: def.projectileTrail
                });
                projectile.projectileLook = projectileVisuals.look;
                projectile.projectileTrail = projectileVisuals.trail;
                projectile.prismChild = splitIndex > 0;
                projectile.disabledTargetDamageMul = Math.min(
                    buildProfile.disabledTargetDamageMul || 1,
                    3 / damageMultiplier
                );

                if (family === 'velocity') {
                    projectile.remainingPierces = Math.floor(
                        finiteNumber(buildProfile.velocityPierceAdd)
                    );
                } else if (family === 'laser') {
                    projectile.chainCount = Math.floor(
                        finiteNumber(buildProfile.laserChainAdd) + finiteNumber(def.stats.baseChainCount)
                    );
                } else if (family === 'rocket') {
                    projectile.blastRadiusMul = 1;
                }
                if (isExplosiveWeapon(def)) {
                    projectile.blastRadiusMul = finitePositive(projectile.blastRadiusMul) *
                        weaponProfile.explosionRadiusMul;
                }

                if (projectileType === 'railgun' ||
                    projectileType === 'beam_freeze' ||
                    projectileType === 'beam_sword' ||
                    projectileType === 'arc_welder') {
                    projectile.isBeam = true;
                }
                if (projectileType === 'laser' || projectileType === 'small_laser') {
                    const laserSpeed = baseSpeed * weaponProfile.projectileSpeedMul;
                    projectile.speed = laserSpeed;
                    projectile.vx = Math.cos(splitAngles[splitIndex]) * laserSpeed;
                    projectile.vy = Math.sin(splitAngles[splitIndex]) * laserSpeed;
                }
                if (projectileType === 'pellet' || projectileType === 'cluster_grenade') {
                    const specialSpeed = finitePositive(projectile.speed, baseSpeed) *
                        weaponProfile.projectileSpeedMul;
                    projectile.speed = specialSpeed;
                    projectile.vx = Math.cos(splitAngles[splitIndex]) * specialSpeed;
                    projectile.vy = Math.sin(splitAngles[splitIndex]) * specialSpeed;
                }
                if (projectile.isBeam) {
                    projectile.beamLength = getBaseWeaponRange(def) * weaponProfile.rangeMul;
                } else if (projectileType !== 'proximity_mine') {
                    projectile.life = getBaseWeaponRange(def) * weaponProfile.rangeMul /
                        Math.max(1, finitePositive(projectile.speed, speed));
                    projectile.maxLife = projectile.life;
                }
                if (def.stats.range) projectile.beamLength = def.stats.range * weaponProfile.rangeMul;
                if (def.stats.armingTime !== undefined) {
                    projectile.armingTime = def.stats.armingTime * weaponProfile.mineArmingMul;
                    projectile.armingTimeRemaining = projectile.armingTime;
                }
                if (def.stats.triggerRadius !== undefined) projectile.triggerRadius = def.stats.triggerRadius;
                if (def.stats.aoeRadius !== undefined) {
                    projectile.blastRadius = def.stats.aoeRadius;
                    projectile.explosionDamage = projectile.damage;
                }
                if (def.stats.shrapnelCount !== undefined) projectile.shrapnelCount = def.stats.shrapnelCount;
                if (def.stats.shrapnelDamage !== undefined) {
                    projectile.shrapnelDamage = def.stats.shrapnelDamage *
                        clamp(
                            weaponProfile.damageMul *
                            weaponProfile.shrapnelDamageMul *
                            attackDamageMul,
                            0.5,
                            3
                        );
                }
                if (def.stats.hackDuration !== undefined) {
                    projectile.baseHackDuration = def.stats.hackDuration;
                    projectile.hackDuration = def.stats.hackDuration *
                        (buildProfile.hackDurationMul || 1);
                }
                if (def.stats.ricochetCount !== undefined) projectile.ricochetCount = def.stats.ricochetCount;
                if (def.stats.ricochetRange !== undefined) projectile.ricochetRange = def.stats.ricochetRange;
                if (def.stats.ricochetDamageMul !== undefined) projectile.ricochetDamageMul = def.stats.ricochetDamageMul;

                if (projectileType === 'beam_freeze' && partRef) {
                    partRef.shotCount = (partRef.shotCount || 0) + 1;
                    if (partRef.shotCount % 5 !== 0) {
                        projectile.isVisualOnly = true;
                    }
                }

                projectile.delay = i * pelletInterval * (0.5 + this.random());
                game.projectiles.push(projectile);
                spawnedProjectile = true;
            }

            if (partRef && def.stats.weaponGroup === 'velocity') {
                partRef.recoil = 5.0;
            }
        }

        if (spawnedProjectile && game.playerShip) {
            game.playerShip.stealthTimer = 0;
        }
        if (partRef) {
            delete partRef.authoredShotMuzzles;
            delete partRef.authoredShotMuzzleStart;
        }

        const sound = getPartFireDefault(def.id);
        let pitch = def.stats.soundPitch || 1.0;
        if (def.id === 'custom_1769336961268') pitch = 0.5;

        let shouldPlayShoot = true;
        if (def.stats.projectileType === 'beam_freeze' && partRef) {
            if (partRef.shotCount % 5 !== 0) shouldPlayShoot = false;
        }

        const soundSlot = authoredFireSoundSlot(def);
        if (shouldPlayShoot && soundSlot) {
            const options = {
                volume: def.stats.soundVolume ?? 0.6,
                pitch,
                randomizePitch: 0.15
            };
            playPartEvent(game.audio, def.id, soundSlot, sound, options);
        }
    }
}
