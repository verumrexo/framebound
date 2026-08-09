import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';
import { Projectile } from '../../shared/entities/Projectile.js';
import {
    getFamilyDamageMultiplier,
    getFamilyFireRateMultiplier
} from '../../shared/combat/WeaponFamilies.js';
import { dispatchPlayerShot } from './PlayerShotDispatcher.js';
import {
    getPartFireDefault,
    partSoundEventKey
} from '../audio/SoundEventRegistry.js';

function playPartEvent(audio, partId, slot, fallbackName, options) {
    if (typeof audio.playEvent === 'function') {
        return audio.playEvent(partSoundEventKey(partId, slot), fallbackName, options);
    }
    return audio.play(fallbackName, options);
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

        const accelerantBonus = 1 + (game.playerShip.stats.accelerantCount || 0) * 0.05;

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
            let currentFireRateMul = levelBonus * getFamilyFireRateMultiplier(
                game.playerShip,
                def.stats.weaponGroup
            );
            if (def.stats.weaponGroup === 'laser') {
                currentFireRateMul *= accelerantBonus;
            }

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

        if (isMouseDown && !game.designer.active) {
            for (const [groupId, group] of Object.entries(weaponGroups)) {
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
                        !w.partRef.chargeReady
                    );
                    const chargedWeapon = group.weapons.find(w => w.partRef.chargeReady);

                    if (readyWeapon || chargedWeapon) {
                        const activeWeapon = chargedWeapon || readyWeapon;
                        const { partRef, def, adjCooldown } = activeWeapon;

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
                            worldMouseX,
                            worldMouseY
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

                        if (!(partRef.burstLeft > 0)) {
                            dispatchPlayerShot(game, def, fireX, fireY, angle, partRef);
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
                worldMouseX,
                worldMouseY
            );
            dispatchPlayerShot(game, def, fireX, fireY, angle, partRef);

            partRef.burstLeft--;
            let interval = def.stats.burstInterval || 0.1;
            if (def.stats.weaponGroup === 'rocket' && game.playerShip.stats.rocketBayCount > 0) {
                interval /= 1 + game.playerShip.stats.rocketBayCount;
            }
            partRef.burstTimer = interval;
        }

        return { isMouseDown, blockedFrame: false };
    }

    getInitialShotOrigin(partRef, def, worldMouseX, worldMouseY) {
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

        const angle = Math.atan2(worldMouseY - finalY, worldMouseX - finalX);
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

        const angle = Math.atan2(worldMouseY - finalY, worldMouseX - finalX);
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

    spawnProjectile(def, fireX, fireY, angle, partRef = null) {
        const game = this.game;
        const projectileCount = def.stats.pelletCount || 1;
        const spread = def.stats.spread || 0;
        const pelletInterval = def.stats.pelletInterval || 0;

        for (let i = 0; i < projectileCount; i++) {
            const finalAngle = angle + (this.random() - 0.5) * spread;
            let projectileX = fireX;
            let projectileY = fireY;

            if (projectileCount > 1 && def.stats.barrelSpacing) {
                const perpendicularX = Math.cos(angle + Math.PI / 2);
                const perpendicularY = Math.sin(angle + Math.PI / 2);
                const offset = (i - (projectileCount - 1) / 2) * def.stats.barrelSpacing;
                projectileX += perpendicularX * offset;
                projectileY += perpendicularY * offset;
            }

            let speed = def.stats.projectileSpeed || 600;
            if (def.stats.weaponGroup === 'rocket' && game.playerShip) {
                speed *= game.playerShip.permanentStats.missileSpeedMul || 1.0;
            }

            const family = def.stats.weaponGroup;
            const projectile = new this.ProjectileClass(
                projectileX,
                projectileY,
                finalAngle,
                def.stats.projectileType || 'bullet',
                speed,
                'player',
                (def.stats.damage || 10) * getFamilyDamageMultiplier(
                    game.playerShip,
                    family
                ),
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

            const permanent = game.playerShip?.permanentStats || {};
            if (family === 'velocity') {
                projectile.remainingPierces = Math.floor(
                    permanent.velocityPierce || 0
                );
            } else if (family === 'laser') {
                projectile.chainCount = Math.floor(permanent.laserChain || 0);
            } else if (family === 'rocket') {
                projectile.blastRadiusMul = permanent.rocketBlastMul || 1;
            }

            if (def.stats.projectileType === 'railgun' ||
                def.stats.projectileType === 'beam_freeze') {
                projectile.isBeam = true;
            }

            if (def.stats.projectileType === 'beam_freeze' && partRef) {
                partRef.shotCount = (partRef.shotCount || 0) + 1;
                if (partRef.shotCount % 5 !== 0) {
                    projectile.isVisualOnly = true;
                }
            }

            projectile.delay = i * pelletInterval * (0.5 + this.random());
            game.projectiles.push(projectile);

            if (partRef && def.stats.weaponGroup === 'velocity') {
                partRef.recoil = 5.0;
            }
        }

        const sound = getPartFireDefault(def.id);
        let pitch = def.stats.soundPitch || 1.0;
        if (def.id === 'custom_1769336961268') pitch = 0.5;

        let shouldPlayShoot = true;
        if (def.stats.projectileType === 'beam_freeze' && partRef) {
            if (partRef.shotCount % 5 !== 0) shouldPlayShoot = false;
        }

        if (shouldPlayShoot) {
            const options = {
                volume: def.stats.soundVolume ?? 0.6,
                pitch,
                randomizePitch: 0.15
            };
            playPartEvent(game.audio, def.id, 'fire', sound, options);
        }
    }
}
