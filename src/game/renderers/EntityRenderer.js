import { TILE_SIZE, PartsLibrary } from '../../shared/parts/Part.js';
import {
    drawShipAssembly,
    getChargeTip,
    getMountedTurretPosition,
    getShipAssemblyParts,
    localToWorld
} from './ShipAssemblyRenderer.js';
import { SHIP_ASSEMBLY_PROFILES } from './ShipAssemblyCache.js';
import {
    getShopAccent,
    getShopItemState,
    getShopBobY
} from './ShopPresentation.js';

export class EntityRenderer {

    static drawShip(renderer, ship, targetX = 0, targetY = 0) {
        if (ship.isDead) return;

        const ctx = renderer.ctx;
        const rotation = ship.rotation;
        const partsIter = typeof ship.getUniqueParts === 'function'
            ? ship.getUniqueParts()
            : ship.parts?.values();
        const parts = getShipAssemblyParts(partsIter, PartsLibrary);
        drawShipAssembly(ctx, ship, parts, { rotation, visualTint: ship.visualTint || ship.tint || null });

        for (const part of parts) {
            const { def, partRef } = part;
            const world = localToWorld(ship, part.localX, part.localY, rotation);

            if (def.type === 'weapon') {
                const angle = Math.atan2(targetY - world.y, targetX - world.x);
                const baseAngle = rotation + part.rotation * (Math.PI / 2);
                const offset = getMountedTurretPosition(part, baseAngle, angle, partRef.recoil);
                def.sprite.draw(
                    ctx,
                    world.x + offset.offsetX,
                    world.y + offset.offsetY,
                    angle + (def.rotationOffset || 0),
                    null,
                    null,
                    'rgba(255,255,255,0.4)'
                );

                if ((partRef.chargeLeft > 0 || partRef.chargeReady) &&
                    (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'saber')) {
                    const pct = partRef.chargeReady ? 1 : 1 - (partRef.chargeLeft / def.stats.chargeTime);
                    const tip = getChargeTip(part, world.x, world.y, angle);
                    const baseRadius = def.stats.projectileType === 'saber' ? 5 : 15;
                    const radius = 5 + pct * baseRadius + Math.sin(Date.now() * 0.01) * 2;
                    ctx.save();
                    ctx.globalAlpha = 0.5 + Math.random() * 0.3;
                    ctx.beginPath();
                    ctx.arc(tip.x, tip.y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#00ffff';
                    ctx.fill();
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(tip.x, tip.y, radius * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.restore();
                }
            }

            if (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0)) {
                const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
                const radius = (TILE_SIZE / 2) * (def.stats.shieldRadiusScale || 1.4) * pulse;
                ctx.save();
                ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(world.x, world.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }

            if (def.id === 'core' && def.coreEffectSprite) {
                def.coreEffectSprite.draw(ctx, world.x, world.y, rotation + ((Date.now() % 10000) * 0.003));
            }
        }
    }

    static drawEnemy(renderer, enemy) {
        if (enemy.isDead) return;
        if (enemy.type === 'dummy') {
            EntityRenderer.drawTrainingDummy(renderer, enemy);
            return;
        }

        // Determine visual overrides (Freeze)
        // Enemy logic stripped, so we check properties if they exist
        const frozenTimer = enemy.frozenTimer || 0;
        const freezeMeter = enemy.freezeMeter || 0;

        if (enemy.isWarpingIn) {
            renderer.ctx.save();
            renderer.ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.3; // 0.0 to 0.6 opacity
            renderer.ctx.shadowColor = '#00ffff';
            renderer.ctx.shadowBlur = 20;
        }

        // Render ship parts if available
        if (enemy.shipParts && enemy.shipParts.length > 0) {
            const ctx = renderer.ctx;
            const rotation = enemy.rotation + (enemy.rotationOffset || 0);
            const enemyColor = frozenTimer > 0 ? '#00ffff' : '#ff6666';
            const parts = getShipAssemblyParts(enemy.shipParts, PartsLibrary);
            ctx.save();

            if (frozenTimer > 0 || freezeMeter > 0) {
                const intensity = frozenTimer > 0 ? 1.0 : (freezeMeter / 3.0);
                ctx.shadowBlur = 5 + intensity * 10;
                ctx.shadowColor = '#00ffff';
                ctx.globalAlpha = 0.8;
            }

            drawShipAssembly(ctx, enemy, parts, {
                rotation,
                visualTint: enemyColor,
                profile: SHIP_ASSEMBLY_PROFILES.enemy
            });
            ctx.translate(enemy.x, enemy.y);
            ctx.rotate(rotation);

            for (const part of parts) {
                const { def, partRef } = part;
                if (def.type === 'weapon') {
                    const drawAngle = enemy.aimAngle === undefined
                        ? 0
                        : enemy.aimAngle - rotation;
                    const baseAngle = part.rotation * (Math.PI / 2);
                    const offset = getMountedTurretPosition(part, baseAngle, drawAngle, partRef.recoil, {
                        numericOffsetAngle: baseAngle,
                        includeBaseAnchor: false
                    });
                    def.sprite.draw(
                        ctx,
                        part.localX + offset.offsetX,
                        part.localY + offset.offsetY,
                        drawAngle + (def.rotationOffset || 0),
                        null,
                        null,
                        null,
                        enemyColor
                    );
                }

                if (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0)) {
                    const pulse = 1.0 + Math.sin(Date.now() / 200) * 0.1;
                    const scale = (def.stats.shieldRadiusScale || 1.4) * pulse;

                    ctx.beginPath();
                    ctx.arc(part.localX, part.localY, (def.width * TILE_SIZE / 2) * scale, 0, Math.PI * 2);
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#00ffff';
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();
                    ctx.fillStyle = '#00ffff';
                    ctx.globalAlpha = 0.1;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1.0;
                }
            }

            // Draw charged-weapon tracking and lock telegraphs over the ship.
            if (enemy.weaponCooldowns) {
                for (const weapon of enemy.weaponCooldowns) {
                    if (!weapon.isCharging || weapon.chargeTimer <= 0) continue;

                    const chargeTime = weapon.def.stats.chargeTime || 1;
                    const isLocked = weapon.chargeTimer >= chargeTime * 0.6;
                    const isRotated = ((weapon.part.rotation || 0) % 2 !== 0);
                    const width = isRotated ? weapon.def.height : weapon.def.width;
                    const height = isRotated ? weapon.def.width : weapon.def.height;
                    const localX = (weapon.part.x + (width - 1) / 2) * TILE_SIZE;
                    const localY = (weapon.part.y + (height - 1) / 2) * TILE_SIZE;
                    const aimAngle = weapon.lockedAngle;
                    if (aimAngle === null || aimAngle === undefined) continue;

                    const localDrawAngle = aimAngle - (enemy.rotation + (enemy.rotationOffset || 0));
                    ctx.save();
                    if (isLocked) {
                        ctx.strokeStyle = '#ffffff';
                        ctx.shadowColor = '#00ffff';
                        ctx.shadowBlur = 10;
                        ctx.lineWidth = 1 + Math.random();
                    } else {
                        ctx.strokeStyle = '#ff0000';
                        ctx.shadowColor = '#ff0000';
                        ctx.shadowBlur = 5;
                        ctx.lineWidth = 0.5;
                    }

                    const range = 2000;
                    ctx.beginPath();
                    ctx.moveTo(localX, localY);
                    ctx.lineTo(
                        localX + Math.cos(localDrawAngle) * range,
                        localY + Math.sin(localDrawAngle) * range
                    );
                    ctx.stroke();
                    ctx.restore();
                }
            }

            if (frozenTimer > 0 || freezeMeter > 0) {
                ctx.globalAlpha = 1.0;
                ctx.shadowBlur = 0;
            }
            ctx.restore();
            if (enemy.supportPulseTimer > 0) {
                const alpha = Math.min(1, enemy.supportPulseTimer / 0.45);
                ctx.save();
                ctx.strokeStyle = `rgba(116, 255, 106, ${alpha})`;
                ctx.shadowColor = '#74ff6a';
                ctx.shadowBlur = 14;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, 35 + (1 - alpha) * 80, 0, Math.PI * 2);
                ctx.stroke();
                if (
                    Number.isFinite(enemy.supportTargetX) &&
                    Number.isFinite(enemy.supportTargetY)
                ) {
                    ctx.beginPath();
                    ctx.moveTo(enemy.x, enemy.y);
                    ctx.lineTo(enemy.supportTargetX, enemy.supportTargetY);
                    ctx.stroke();
                }
                ctx.restore();
            }
        } else if (enemy.sprite) {
             // Fallback sprite
             const color = (frozenTimer > 0) ? '#00ffff' : undefined;
             enemy.sprite.draw(renderer.ctx, enemy.x, enemy.y, enemy.rotation + (enemy.rotationOffset || 0), 0.5, 0.5, null, color);
        }

        if (enemy.isWarpingIn) {
            renderer.ctx.restore();
            return; // Skip health bar while warping
        }

    }

    static drawLootCrate(renderer, crate) {
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(crate.x, crate.y);
        ctx.rotate(crate.rotation);

        const w = crate.width;
        const h = crate.height;
        const hw = w / 2;
        const hh = h / 2;
        const pixelSize = 4;

        if (crate.isOpened) {
            for (const fragment of crate.breakFragments || []) {
                ctx.save();
                ctx.translate(fragment.x, fragment.y);
                ctx.rotate(fragment.rotation);
                ctx.fillStyle = fragment.color;
                ctx.globalAlpha = fragment.width <= 6 ? 0.75 : 0.58;
                ctx.fillRect(
                    -fragment.width / 2,
                    -fragment.height / 2,
                    fragment.width,
                    fragment.height
                );
                ctx.strokeStyle = 'rgba(220, 252, 255, 0.22)';
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    -fragment.width / 2,
                    -fragment.height / 2,
                    fragment.width,
                    fragment.height
                );
                ctx.restore();
            }
        } else {
            ctx.fillStyle = crate.baseColor;
            ctx.fillRect(-hw, -hh, w, h);

            const border = pixelSize * 2;
            ctx.fillStyle = crate.detailColor;
            ctx.fillRect(-hw + border, -hh + border, w - border * 2, h - border * 2);

            ctx.fillStyle = crate.lightColor;
            const corner = pixelSize * 2;
            ctx.fillRect(-hw, -hh, corner, corner);
            ctx.fillRect(hw - corner, -hh, corner, corner);
            ctx.fillRect(hw - corner, hh - corner, corner, corner);
            ctx.fillRect(-hw, hh - corner, corner, corner);

            if (crate.wTiles === 2 || crate.hTiles === 2) {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                if (crate.wTiles === 2) ctx.fillRect(-2, -hh + border, 4, h - border * 2);
                if (crate.hTiles === 2) ctx.fillRect(-hw + border, -2, w - border * 2, 4);
            }

            const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
            ctx.fillStyle = crate.lightColor;
            ctx.globalAlpha = 0.5 + pulse * 0.5;
            ctx.fillRect(-pixelSize, -pixelSize, pixelSize * 2, pixelSize * 2);
            ctx.globalAlpha = 1.0;
        }
        ctx.restore();
    }

    static drawAsteroid(renderer, asteroid) {
        if (asteroid.isDead) return;
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(asteroid.x, asteroid.y);
        ctx.rotate(asteroid.rotation);

        const pixelSize = 4;
        if (asteroid.type === 'rock') ctx.fillStyle = asteroid.isBroken ? '#333' : '#666';
        else if (asteroid.type === 'crystal_blue') ctx.fillStyle = asteroid.isBroken ? '#003333' : '#00ffff';
        else ctx.fillStyle = asteroid.isBroken ? '#442200' : '#ffaa00';

        const drawPixelLine = (x0, y0, x1, y1) => {
            const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / pixelSize;
            for (let i = 0; i <= steps; i++) {
                const t = steps === 0 ? 0 : i / steps;
                const x = x0 + (x1 - x0) * t;
                const y = y0 + (y1 - y0) * t;
                ctx.fillRect(
                    Math.floor(x / pixelSize) * pixelSize - pixelSize / 2,
                    Math.floor(y / pixelSize) * pixelSize - pixelSize / 2,
                    pixelSize,
                    pixelSize
                );
            }
        };

        if (!asteroid.isBroken && asteroid.vertices && asteroid.vertices.length > 0) {
            for (let i = 0; i < asteroid.vertices.length; i++) {
                const next = (i + 1) % asteroid.vertices.length;
                drawPixelLine(
                    asteroid.vertices[i].x,
                    asteroid.vertices[i].y,
                    asteroid.vertices[next].x,
                    asteroid.vertices[next].y
                );
            }
        }

        if (asteroid.isBroken) {
            ctx.fillStyle = asteroid.type === 'rock'
                ? '#444'
                : asteroid.type === 'crystal_blue' ? '#008888' : '#885500';
            ctx.globalAlpha = 0.62;
            for (const fragment of asteroid.breakFragments || []) {
                ctx.save();
                ctx.translate(fragment.x, fragment.y);
                ctx.rotate(fragment.rotation);
                for (let index = 0; index < fragment.points.length - 1; index++) {
                    drawPixelLine(
                        fragment.points[index].x,
                        fragment.points[index].y,
                        fragment.points[index + 1].x,
                        fragment.points[index + 1].y
                    );
                }
                ctx.restore();
            }
        }
        ctx.restore();
    }

    static drawDrone(renderer, drone) {
        if (drone.sprite) {
             drone.sprite.draw(renderer.ctx, drone.x, drone.y, drone.rotation + Math.PI/2, 0.5, 0.5);
        }
    }

    static drawOrb(renderer, orb) {
        if (orb.isDead) return;
        const ctx = renderer.ctx;

        if (orb.pulseAngle !== undefined) {
            const pulse = Math.sin(orb.pulseAngle) * 0.5;
            const r = orb.radius + pulse;
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = orb.color || '#00ffff';
            renderer.drawCircle(orb.x, orb.y, r, orb.color || '#00ffff');
            ctx.globalAlpha = 0.5;
            renderer.drawCircle(orb.x, orb.y, r * 1.5, orb.color || '#00ffff');
            ctx.restore();
        } else if (orb.color === '#ffd700') {
            ctx.save();
            ctx.translate(orb.x, orb.y);
            ctx.scale(Math.max(0.1, Math.abs(Math.sin(orb.rotation))), 1);
            ctx.shadowBlur = 10;
            ctx.shadowColor = orb.color;
            ctx.strokeStyle = orb.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ffffaa';
            ctx.beginPath();
            ctx.arc(0, 0, orb.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (orb.color === '#44ff44') {
            ctx.save();
            ctx.translate(orb.x, orb.y);
            ctx.rotate(orb.rotation);
            ctx.shadowBlur = 12;
            ctx.shadowColor = orb.color;
            ctx.fillStyle = orb.color;
            const size = orb.radius;
            const thickness = 3;
            ctx.fillRect(-thickness / 2, -size, thickness, size * 2);
            ctx.fillRect(-size, -thickness / 2, size * 2, thickness);
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#aaffaa';
            const innerThickness = 1.5;
            ctx.fillRect(-innerThickness / 2, -size + 1, innerThickness, (size - 1) * 2);
            ctx.fillRect(-size + 1, -innerThickness / 2, (size - 1) * 2, innerThickness);
            ctx.restore();
        } else {
            const color = orb.color || '#ffff00';
            renderer.drawCircle(orb.x, orb.y, orb.radius, color);
        }
    }

    static drawShipwreck(renderer, wreck) {
        if (wreck.isDead) return;
        const ctx = renderer.ctx;
        const CELL = TILE_SIZE;

        // Draw parts tinted red/dark
        // Wreck uses this.ship (Shared Ship instance)
        if (!wreck.ship) return;

        const partsIter = wreck.ship.getUniqueParts();
        for (const part of partsIter) {
            const def = PartsLibrary[part.partId];
            if (!def) continue;

            const isRotated = ((part.rotation || 0) % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            const localCX = (part.x + (w - 1) / 2) * CELL;
            const localCY = (part.y + (h - 1) / 2) * CELL;

            const worldPartX = wreck.x + (localCX * Math.cos(wreck.rotation) - localCY * Math.sin(wreck.rotation));
            const worldPartY = wreck.y + (localCX * Math.sin(wreck.rotation) + localCY * Math.cos(wreck.rotation));

            ctx.save();
            ctx.translate(worldPartX, worldPartY);
            ctx.rotate(wreck.rotation + (part.rotation || 0) * (Math.PI / 2));

            if (def.baseSprite) def.baseSprite.draw(ctx, 0, 0, 0);
            else if (def.sprite) def.sprite.draw(ctx, 0, 0, 0);

            // Tint
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(100, 0, 0, 0.6)'; // Dark Red tint

            // Use actual dimensions in local space
            const sw = def.width * CELL;
            const sh = def.height * CELL;
            ctx.fillRect(-sw / 2, -sh / 2, sw, sh);

            ctx.restore();
        }
    }

    static drawShopItem(renderer, item, { credits = Number.POSITIVE_INFINITY } = {}) {
        const ctx = renderer.ctx;
        const accent = getShopAccent(item);
        const state = getShopItemState(item, credits);
        const bobY = getShopBobY(item);
        const isSold = state === 'sold';
        const isAffordable = state === 'affordable';
        const opacity = isSold ? 0.46 : state === 'unaffordable' ? 0.68 : 1;

        ctx.save();
        ctx.globalAlpha = opacity;

        // The terminal base is deliberately angular and stays on the hard-
        // raster world surface. Text/status belongs to WorldOverlayRenderer.
        ctx.translate(item.x, item.y + 34);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
        ctx.beginPath();
        ctx.moveTo(-48, 18);
        ctx.lineTo(-34, -6);
        ctx.lineTo(34, -6);
        ctx.lineTo(48, 18);
        ctx.lineTo(32, 31);
        ctx.lineTo(-32, 31);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = accent;
        ctx.globalAlpha = opacity * 0.32;
        ctx.fillRect(-27, 7, 54, 3);
        ctx.fillRect(-20, 18, 40, 2);
        ctx.globalAlpha = opacity;

        ctx.strokeStyle = accent;
        ctx.lineWidth = isAffordable ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(-32, 28);
        ctx.lineTo(-25, 35);
        ctx.lineTo(25, 35);
        ctx.lineTo(32, 28);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(item.x, bobY);
        ctx.shadowBlur = isSold ? 0 : isAffordable ? 18 : 8;
        ctx.shadowColor = accent;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.84)';
        ctx.beginPath();
        ctx.moveTo(-item.radius + 8, -item.radius);
        ctx.lineTo(item.radius - 8, -item.radius);
        ctx.lineTo(item.radius, -item.radius + 8);
        ctx.lineTo(item.radius, item.radius - 8);
        ctx.lineTo(item.radius - 8, item.radius);
        ctx.lineTo(-item.radius + 8, item.radius);
        ctx.lineTo(-item.radius, item.radius - 8);
        ctx.lineTo(-item.radius, -item.radius + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = isAffordable ? 3 : 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (item.data?.type === 'heal') {
            ctx.fillStyle = '#ff4d5a';
            ctx.fillRect(-12, -4, 24, 8);
            ctx.fillRect(-4, -12, 8, 24);
            ctx.fillStyle = '#ffd8d8';
            ctx.fillRect(-8, -2, 16, 4);
            ctx.fillRect(-2, -8, 4, 16);
        } else if (item.partDef?.sprite) {
            ctx.globalAlpha = isSold ? 0.25 : state === 'unaffordable' ? 0.7 : 1;
            item.partDef.sprite.draw(ctx, 0, 0, 0);
        }

        if (isSold) {
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#82909a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-item.radius + 7, item.radius - 8);
            ctx.lineTo(item.radius - 7, -item.radius + 8);
            ctx.stroke();
        } else if (!isAffordable) {
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#ff4d5a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-item.radius + 7, -item.radius + 8);
            ctx.lineTo(item.radius - 7, item.radius - 8);
            ctx.stroke();
        }

        ctx.restore();
    }

    static drawTreasureChest(renderer, chest) {
        if (chest.opened) return;
        const ctx = renderer.ctx;
        const bobY = chest.y + Math.sin((chest.life || 0) * 1.5 + (chest.bobOffset || 0)) * 8;

        ctx.save();
        ctx.translate(chest.x, bobY);
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ffd700';

        if (chest.sprite) {
            chest.sprite.draw(ctx, 0, 0, chest.rotation || 0);
        } else {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-30, -30, 60, 60);
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 3;
            ctx.strokeRect(-30, -30, 60, 60);
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    static drawVaultChest(renderer, chest) {
        if (chest.opened) return;
        const ctx = renderer.ctx;
        const bobY = chest.y + Math.sin((chest.life || 0) * 1.5 + (chest.bobOffset || 0)) * 8;

        ctx.save();
        ctx.translate(chest.x, bobY);
        ctx.rotate(chest.rotation || 0);

        ctx.shadowBlur = chest.ambushActive ? 40 : 25;
        ctx.shadowColor = chest.costType === 'hp' ? '#ff0000' : '#ffd700';

        if (chest.sprite) {
            chest.sprite.draw(ctx, 0, 0, 0);
        } else {
            ctx.fillStyle = chest.costType === 'hp' ? '#800000' : '#ffd700';
            ctx.fillRect(-30, -30, 60, 60);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(-30, -30, 60, 60);
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    static drawItemPickup(renderer, item) {
        if (item.isDead) return;
        const ctx = renderer.ctx;
        const bobY = item.y + Math.sin(item.life * 5 + item.bobOffset) * 4;

        ctx.save();
        ctx.translate(item.x, bobY);

        ctx.shadowColor = '#ffff00';
        const def = item.def || PartsLibrary[item.partId];
        if (def) {
            ctx.scale(0.6, 0.6);
            if (def.baseSprite) {
                def.baseSprite.draw(ctx, 0, 0, 0);
            } else if (def.sprite) {
                def.sprite.draw(ctx, 0, 0, 0);
            }
        } else {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(-6, -6, 12, 12);
        }
        ctx.restore();
    }

    static drawPortal(renderer, portal) {
        renderer.ctx.save();
        renderer.ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        renderer.drawCircle(portal.x, portal.y, portal.radius + 10, '#aa00ff');
        renderer.drawCircle(portal.x, portal.y, portal.radius, '#ffffff');
        renderer.ctx.restore();

        if (portal.sprite) {
            portal.sprite.draw(renderer.ctx, portal.x, portal.y, portal.rotation);
        }
    }

    static drawTrainingDummy(renderer, dummy) {
        if (dummy.sprite) {
            dummy.sprite.draw(renderer.ctx, dummy.x, dummy.y, dummy.rotation);
        }
    }

}
