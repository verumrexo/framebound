
import { Projectile } from '../shared/entities/Projectile.js';
import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';

export class WeaponSystem {
    constructor() {
        this.staggerTimers = {};
        // Removed global activeChargeSound - now using per-part tracking
        this.weaponSounds = {
            'gun_basic': 'shoot_dart',
            'scattr': 'shoot_scattr',
            'lps': 'shoot_lps',
            'ggbm': 'shoot_ggbm',
            'rocketle': 'shoot_rocketle',
            'minigun': 'shoot_minigun',
            'custom_1767999386292': 'shoot_lsr',
            'custom_1768036702131': 'shoot_rocket_he',
            'custom_1768397007593': 'rail_shot',
            'custom_1768857172136': 'shoot_sniper',
            'custom_1769204337665': 'shoot_dart', // Burst
            'custom_1769336961268': 'shoot_lsr', // Freeze Ray
            'custom_1769514097773': 'nova', // Nova Cluster
            'railgun': 'rail_shot'
        };
    }

    update(game, dt) {
        // --- 1. SETUP & INPUT ---
        const CELL_STRIDE = TILE_SIZE;
        const levelBonus = 1 + (game.level - 1) * 0.01;
        const accelerantBonus = (1 + (game.playerShip.stats.accelerantCount || 0) * 0.05);

        // Input Handling
        let isMouseDown = game.input.isMouseDown();
        if (game.input.joysticks && game.input.joysticks.right.active) {
            isMouseDown = true;
        }





        // Prevent firing when interacting with UI (Shop/Hangar)
        if (isMouseDown && !game.designer.active) {
            // Check Shop
            if (game.shopButtonRects && game.shopButtonRects.length > 0 && !game.mouseDownLastFrame) {
                const mousePos = game.input.getMousePos();
                for (const btn of game.shopButtonRects) {
                    if (mousePos.x >= btn.x && mousePos.x <= btn.x + btn.w &&
                        mousePos.y >= btn.y && mousePos.y <= btn.y + btn.h) {
                        return; // UI Click
                    }
                }
            }
            // Check Hangar
            if (game.hangarButtonRect && !game.mouseDownLastFrame) {
                const mousePos = game.input.getMousePos();
                const btn = game.hangarButtonRect;
                if (mousePos.x >= btn.x && mousePos.x <= btn.x + btn.w &&
                    mousePos.y >= btn.y && mousePos.y <= btn.y + btn.h) {
                    return; // UI Click
                }
            }
        }

        // Aiming Calculation
        const zoom = game.camera.zoom || 1;
        const mouse = game.input.getMousePos();
        let worldMouseX = (mouse.x / zoom) + game.camera.x;
        let worldMouseY = (mouse.y / zoom) + game.camera.y;

        if (game.input.joysticks && game.input.joysticks.right.active) {
            const v = game.input.joysticks.right.vector;
            worldMouseX = game.x + v.x * 2000;
            worldMouseY = game.y + v.y * 2000;
        }

        // --- 2. UPDATE COOLDOWNS & GROUP WEAPONS ---
        const weaponGroups = {};

        for (const partRef of game.playerShip.getUniqueParts()) {
            // General Updates
            if (partRef.shieldCooldown > 0) partRef.shieldCooldown -= dt;
            if (partRef.recoil > 0) {
                partRef.recoil -= dt * 20;
                if (partRef.recoil < 0) partRef.recoil = 0;
            }

            const def = PartsLibrary[partRef.partId];
            if (!def) {
                if (Math.random() < 0.01) console.warn('Missing definition for part:', partRef.partId);
                continue;
            }
            if (def.type !== 'weapon') {
                continue;
            }

            // Ramp / Minigun Logic
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

            // Charge Logic
            if (partRef.chargeLeft > 0) {
                partRef.chargeLeft -= dt;
                if (partRef.chargeLeft <= 0) {
                    partRef.chargeReady = true;
                }
            }

            // Calculate Cooldown
            const perm = game.playerShip.permanentStats;
            const rampFactor = (def.stats.rampUp && partRef.rampLevel) ? (1 + partRef.rampLevel) : 1;
            let currentFireRateMul = levelBonus;

            if (def.stats.weaponGroup === 'laser') {
                currentFireRateMul *= (accelerantBonus + (perm.laserRateAdd || 0));
            } else if (def.stats.weaponGroup === 'velocity') {
                currentFireRateMul += (perm.velocityRateAdd || 0);
            }

            let baseCooldown = def.stats.cooldown || 0.15;
            if (baseCooldown <= 0.001) baseCooldown = 0.016;
            const adjCooldown = baseCooldown / rampFactor / currentFireRateMul;

            if (!partRef.cooldown) partRef.cooldown = 0;
            if (partRef.cooldown > 0) partRef.cooldown -= dt;

            // Grouping
            if (!weaponGroups[def.id]) {
                weaponGroups[def.id] = {
                    def: def,
                    weapons: [],
                    minBaseCooldown: adjCooldown
                };
            } else {
                weaponGroups[def.id].minBaseCooldown = Math.min(weaponGroups[def.id].minBaseCooldown, adjCooldown);
            }
            weaponGroups[def.id].weapons.push({ partRef, def, adjCooldown });
        }

        // --- 3. TRIGGER UPDATE (STAGGERED) ---
        if (isMouseDown && !game.designer.active) {
            // DEBUG: Check weapon groups
            if (Object.keys(weaponGroups).length === 0) {
                // console.log('No weapon groups found! Items checked:', game.playerShip.parts.size);
            } else {
                // console.log('Weapon Groups:', Object.keys(weaponGroups));
            }

            for (const [groupId, group] of Object.entries(weaponGroups)) {
                if (this.staggerTimers[groupId] === undefined) this.staggerTimers[groupId] = 0;

                const count = group.weapons.length;
                const staggerInterval = Math.min(0.2, group.minBaseCooldown / count);

                this.staggerTimers[groupId] -= dt;

                // DEBUG: Check specific group logic
                // if (Math.random() < 0.01) console.log(`Group ${groupId}: count=${count} timer=${this.staggerTimers[groupId]}`);





                this.staggerTimers[groupId] -= dt;

                let safety = 0;
                while (this.staggerTimers[groupId] <= 0 && safety < 50) {
                    safety++;

                    // Find ready weapon
                    const readyWeapon = group.weapons.find(w => {
                        if (w.partRef.cooldown === undefined) w.partRef.cooldown = 0;
                        return w.partRef.cooldown <= 0 && (w.partRef.chargeLeft === undefined || w.partRef.chargeLeft <= 0) && !w.partRef.chargeReady;
                    });
                    const chargedWeapon = group.weapons.find(w => w.partRef.chargeReady);

                    if (readyWeapon || chargedWeapon) {
                        const activeWeapon = chargedWeapon || readyWeapon;
                        const { partRef, def, adjCooldown } = activeWeapon;

                        // Start Charge
                        if (!chargedWeapon && def.stats.chargeTime && !partRef.chargeLeft) {
                            partRef.chargeLeft = def.stats.chargeTime;
                            // Stop THIS part's existing charge sound (prevents stacking on same weapon)
                            if (partRef.chargeSound) {
                                try { partRef.chargeSound.source.stop(); } catch (e) { }
                            }
                            const pitch = def.stats.projectileType === 'saber' ? 1.5 : 1.0;
                            const vol = def.stats.projectileType === 'saber' ? 0.08 : 0.4;
                            partRef.chargeSound = game.audio.play('rail_charge', { volume: vol, pitch });
                            break; // Stop loop, waiting for charge
                        }

                        // Fire (Set Burst)
                        if (chargedWeapon) {
                            partRef.chargeLeft = undefined;
                            partRef.chargeReady = false;
                            if (partRef.chargeSound) {
                                try { partRef.chargeSound.source.stop(); } catch (e) { }
                                partRef.chargeSound = null;
                            }
                            const pitch = def.stats.projectileType === 'saber' ? 1.5 : 1.0;
                            const fireVol = def.stats.projectileType === 'saber' ? 0.15 : 0.5;
                            game.audio.play('rail', { volume: fireVol, pitch });
                        }

                        // Initialize Burst
                        let bCount = def.stats.burstCount || 0;

                        if (def.stats.weaponGroup === 'rocket') {
                            const rocketBonus = (game.playerShip.stats.rocketBayCount || 0);
                            partRef.burstLeft = (bCount || 1) + rocketBonus;
                            partRef.burstTimer = 0;
                        } else if (bCount > 0) {
                            partRef.burstLeft = bCount;
                            partRef.burstTimer = 0;
                        } else {
                            // Default single shot is essentially a burst of 1
                            partRef.burstLeft = 1;
                            partRef.burstTimer = 0;
                        }

                        // Apply Cooldown / Ramp
                        if (def.stats.rampUp) {
                            if (partRef.peakMeter > 0) {
                                partRef.cooldown = adjCooldown;
                            } else {
                                partRef.rampLevel = Math.min(def.stats.maxRamp || 2.0, (partRef.rampLevel || 0) + (def.stats.rampRate || 0.5));
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
                        // Group empty/waiting
                        if (this.staggerTimers[groupId] < 0) this.staggerTimers[groupId] = 0;
                        break;
                    }
                }
            }
        } else {
            // Reset stagger timers
            for (const key in this.staggerTimers) {
                if (this.staggerTimers[key] < 0) this.staggerTimers[key] = 0;
            }
            // Reset Charges and stop per-part charge sounds
            for (const partRef of game.playerShip.getUniqueParts()) {
                partRef.chargeLeft = 0;
                partRef.chargeReady = false;
                if (partRef.chargeSound) {
                    try { partRef.chargeSound.source.stop(); } catch (e) { }
                    partRef.chargeSound = null;
                }
            }
        }

        // --- 4. BURST EXECUTION LOOP ---
        for (const partRef of game.playerShip.getUniqueParts()) {
            if (partRef.burstLeft > 0) {
                partRef.burstTimer -= dt;

                if (partRef.burstTimer <= 0) {
                    const def = PartsLibrary[partRef.partId];
                    if (def) {
                        this.fireBurstShot(game, partRef, def, worldMouseX, worldMouseY);
                    } else {
                        partRef.burstLeft = 0;
                    }
                }
            }
        }
    }

    fireBurstShot(game, partRef, def, worldMouseX, worldMouseY) {
        const CELL_STRIDE = TILE_SIZE;

        // Calculate Trigger Position
        const isRotated = ((partRef.rotation || 0) % 2 !== 0);
        const pw = isRotated ? def.height : def.width;
        const ph = isRotated ? def.width : def.height;
        const localCX = (partRef.x + (pw - 1) / 2) * CELL_STRIDE;
        const localCY = (partRef.y + (ph - 1) / 2) * CELL_STRIDE;
        const cos = Math.cos(game.rotation);
        const sin = Math.sin(game.rotation);
        let finalX = game.x + (localCX * cos - localCY * sin);
        let finalY = game.y + (localCX * sin + localCY * cos);

        // Base Pivot Mount Offset
        const baseAngle = game.rotation + (partRef.rotation || 0) * (Math.PI / 2);
        if (def.baseSprite && (def.baseSprite.anchorX !== 0.5 || def.baseSprite.anchorY !== 0.5)) {
            const bpx = (def.baseSprite.anchorX - 0.5) * def.baseSprite.width * def.baseSprite.scale;
            const bpy = (def.baseSprite.anchorY - 0.5) * def.baseSprite.height * def.baseSprite.scale;
            finalX += Math.cos(baseAngle) * bpx - Math.sin(baseAngle) * bpy;
            finalY += Math.sin(baseAngle) * bpx + Math.cos(baseAngle) * bpy;
        }

        // Turret Pivot & Angle
        // Turret follows mouse from its pivot
        let turretX = finalX;
        let turretY = finalY;

        if (def.turretDrawOffset) {
            if (typeof def.turretDrawOffset === 'object') {
                // Vector offset from mount
                const ox = def.turretDrawOffset.x || 0;
                const oy = def.turretDrawOffset.y || 0;
                turretX += Math.cos(baseAngle) * ox - Math.sin(baseAngle) * oy;
                turretY += Math.sin(baseAngle) * ox + Math.cos(baseAngle) * oy;
            } else {
                // Scalar forward offset
                // But wait, forward in what direction? Base direction?
                // The original code uses Math.cos(angle) for scalar... wait.
                // Original: 
                // } else { turretX += Math.cos(angle) * def.turretDrawOffset; ... }
                // BUT 'angle' was calculated relative to 'finalX/Y'. 
                // This implies circular dependency if angle uses turret position?
                // Original code calculated `angle` BEFORE applying `turretDrawOffset` (scalar).
                // So scalar offset moves along the aim vector.
            }
        }

        // Re-calc angle based on pivot (finalX/Y is pivot)
        const angle = Math.atan2(worldMouseY - finalY, worldMouseX - finalX);

        if (typeof def.turretDrawOffset === 'number') {
            turretX += Math.cos(angle) * def.turretDrawOffset;
            turretY += Math.sin(angle) * def.turretDrawOffset;
        }

        // Firing Origin
        let fireX = turretX;
        let fireY = turretY;

        // Barrel Offset (Muzzle)
        if (def.stats.barrelPosition) {
            const bx = def.stats.barrelPosition.x || 0;
            const by = def.stats.barrelPosition.y || 0;
            // Barrel position is relative to sprite's local space, so rotate by actual visual angle
            const muzzleAngle = angle + (def.rotationOffset || 0);
            fireX += Math.cos(muzzleAngle) * bx - Math.sin(muzzleAngle) * by;
            fireY += Math.sin(muzzleAngle) * bx + Math.cos(muzzleAngle) * by;
        } else {
            // Default barrel length (scalar forward from aim)
            // Note: turretX already includes scalar turretDrawOffset, so barrelLen should just be the sprite length
            let barrelLen = (ph > 1.5) ? CELL_STRIDE * 1.3 : CELL_STRIDE * 0.6;
            fireX += Math.cos(angle) * barrelLen;
            fireY += Math.sin(angle) * barrelLen;
        }

        // Spawn Projectiles
        const pCount = def.stats.pelletCount || 1;
        const pSpread = def.stats.spread || 0;
        const pInterval = def.stats.pelletInterval || 0;

        for (let i = 0; i < pCount; i++) {
            const finalAngle = angle + (Math.random() - 0.5) * pSpread;
            let pX = fireX;
            let pY = fireY;

            if (pCount > 1 && def.stats.barrelSpacing) {
                const perpX = Math.cos(angle + Math.PI / 2);
                const perpY = Math.sin(angle + Math.PI / 2);
                const offset = (i - (pCount - 1) / 2) * def.stats.barrelSpacing;
                pX += perpX * offset;
                pY += perpY * offset;
            }

            // Calculate Speed
            let speed = def.stats.projectileSpeed || 600;
            if (def.stats.weaponGroup === 'rocket') {
                const speedMul = game.playerShip.permanentStats.missileSpeedMul || 1.0;
                speed *= speedMul;
            }

            // Projectile(x, y, angle, type, speed, owner, damage, lifetime)
            const p = new Projectile(pX, pY, finalAngle, def.stats.projectileType || 'bullet', speed, 'player', def.stats.damage || 10, def.stats.lifetime, game.random);

            if (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'beam_freeze') p.isBeam = true;

            if (def.stats.projectileType === 'beam_freeze') {
                partRef.shotCount = (partRef.shotCount || 0) + 1;
                if (partRef.shotCount % 5 !== 0) p.isVisualOnly = true;
            }

            p.delay = i * pInterval * (0.5 + Math.random());
            game.projectiles.push(p);

            if (def.stats.weaponGroup === 'velocity') {
                partRef.recoil = 5.0;
            }
        }

        // Decrement Burst
        partRef.burstLeft--;
        let interval = def.stats.burstInterval || 0.1;
        if (def.stats.weaponGroup === 'rocket' && game.playerShip.stats.rocketBayCount > 0) {
            interval /= (1 + game.playerShip.stats.rocketBayCount);
        }
        partRef.burstTimer = interval;

        // Audio
        let snd = this.weaponSounds[def.id] || 'hit';
        let pitch = def.stats.soundPitch || 1.0;
        let shouldPlay = true;
        let vol = def.stats.soundVolume ?? 0.6;

        // Lower volume for saber shot sound
        if (def.stats.projectileType === 'saber') {
            vol = 0.15;
        }

        if (def.stats.projectileType === 'beam_freeze') {
            if (partRef.shotCount % 5 !== 0) shouldPlay = false;
        }

        if (shouldPlay) {
            game.audio.play(snd, {
                volume: vol,
                pitch: pitch,
                randomizePitch: 0.15
            });
        }

        // Network Sync: Send Shoot Event
        // We send the firing parameters so others can replicate the projectile and sound
        if (game.network && game.network.isConnected) {
            game.network.sendShoot({
                partId: def.id,
                x: fireX,
                y: fireY,
                angle: angle
            });
        }
    }
}
