import { Assets } from '../../Assets.js';
import { TILE_SIZE, PartsLibrary } from '../../shared/parts/Part.js';

export class EntityRenderer {

    static drawShip(renderer, ship, targetX = 0, targetY = 0) {
        if (ship.isDead) return;

        const ctx = renderer.ctx;
        const CELL_STRIDE = TILE_SIZE;
        const rotation = ship.rotation;

        const shipCos = Math.cos(rotation);
        const shipSin = Math.sin(rotation);

        // Ensure we can iterate parts (RemotePlayer might store them differently?)
        // Assuming ship has getUniqueParts() or parts Map
        const partsIter = (typeof ship.getUniqueParts === 'function') ? ship.getUniqueParts() : ship.parts.values();

        for (const partRef of partsIter) {
            const def = PartsLibrary[partRef.partId];
            if (!def) continue;

            const isRotated = ((partRef.rotation || 0) % 2 !== 0);
            const w = isRotated ? def.height : def.width;
            const h = isRotated ? def.width : def.height;

            const localCX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
            const localCY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

            const worldPartX = ship.x + (localCX * shipCos - localCY * shipSin);
            const worldPartY = ship.y + (localCX * shipSin + localCY * shipCos);

            if (def.type === 'weapon') {
                // Draw base
                if (def.baseSprite) {
                    def.baseSprite.draw(ctx, worldPartX, worldPartY, rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                    // Long Hull (1x2)
                    if (Assets.LongHull) Assets.LongHull.draw(ctx, worldPartX, worldPartY, rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                } else {
                    // Standard Base
                    if (Assets.PlayerBase) Assets.PlayerBase.draw(ctx, worldPartX, worldPartY, rotation, 0.5, 0.5);
                }

                // Draw turret (aimed at target)
                // Use input aim if available, otherwise targetX/Y passed in
                let angle = 0;
                // If it's a RemotePlayer, we might not have aim info perfectly synced yet, use rotation?
                // Or extrapolate?
                // For LocalPlayer, we use mouse/input.

                // If aiming at specific point
                angle = Math.atan2(targetY - worldPartY, targetX - worldPartX);

                const baseAngle = rotation + (partRef.rotation || 0) * (Math.PI / 2);

                let offsetX = 0;
                let offsetY = 0;

                if (def.turretDrawOffset) {
                    if (typeof def.turretDrawOffset === 'object') {
                        const ox = def.turretDrawOffset.x || 0;
                        const oy = def.turretDrawOffset.y || 0;
                        offsetX = Math.cos(baseAngle) * ox - Math.sin(baseAngle) * oy;
                        offsetY = Math.sin(baseAngle) * ox + Math.cos(baseAngle) * oy;
                    } else {
                        offsetX = Math.cos(angle) * def.turretDrawOffset;
                        offsetY = Math.sin(angle) * def.turretDrawOffset;
                    }
                }

                if (partRef.recoil) {
                    offsetX -= Math.cos(angle) * partRef.recoil;
                    offsetY -= Math.sin(angle) * partRef.recoil;
                }

                if (def.baseSprite && (def.baseSprite.anchorX !== 0.5 || def.baseSprite.anchorY !== 0.5)) {
                    const bpx = (def.baseSprite.anchorX - 0.5) * def.baseSprite.width * def.baseSprite.scale;
                    const bpy = (def.baseSprite.anchorY - 0.5) * def.baseSprite.height * def.baseSprite.scale;
                    offsetX += Math.cos(baseAngle) * bpx - Math.sin(baseAngle) * bpy;
                    offsetY += Math.sin(baseAngle) * bpx + Math.cos(baseAngle) * bpy;
                }

                const drawX = worldPartX + offsetX;
                const drawY = worldPartY + offsetY;

                def.sprite.draw(ctx, drawX, drawY, angle + (def.rotationOffset || 0), null, null, 'rgba(255,255,255,0.4)');

                // Charge Effect (Railway/Saber)
                if ((partRef.chargeLeft > 0 || partRef.chargeReady) && (def.stats.projectileType === 'railgun' || def.stats.projectileType === 'saber')) {
                    const pct = partRef.chargeReady ? 1.0 : (1.0 - (partRef.chargeLeft / def.stats.chargeTime));
                    let barrelLen = (h > 1.5) ? CELL_STRIDE * 1.3 : CELL_STRIDE * 0.6;
                    barrelLen += (def.turretDrawOffset || 0);
                    const tipX = worldPartX + Math.cos(angle) * barrelLen;
                    const tipY = worldPartY + Math.sin(angle) * barrelLen;

                    const isSaber = def.stats.projectileType === 'saber';
                    const baseRadius = isSaber ? 5 : 15;
                    const radius = 5 + pct * baseRadius + Math.sin(Date.now() * 0.01) * 2;
                    ctx.save();
                    ctx.globalAlpha = 0.5 + Math.random() * 0.3;

                    ctx.beginPath();
                    ctx.arc(tipX, tipY, radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#00ffff';
                    ctx.fill();

                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(tipX, tipY, radius * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.restore();
                }
            } else {
                // Static Part
                def.sprite.draw(ctx, worldPartX, worldPartY, rotation + (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);

                // Shield
                if (def.type === 'shield' && (!partRef.shieldCooldown || partRef.shieldCooldown <= 0)) {
                    const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.1;
                    const scale = def.stats.shieldRadiusScale || 1.4;
                    const radius = (CELL_STRIDE / 2) * scale * pulse;

                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(worldPartX, worldPartY, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // Core Effect (spinning energy core)
            if (def.id === 'core' && def.coreEffectSprite) {
                const spin = rotation + ((Date.now() % 10000) * 0.003);
                def.coreEffectSprite.draw(ctx, worldPartX, worldPartY, spin);
            }
        }
    }

    static drawEnemy(renderer, enemy) {
        if (enemy.isDead) return;

        // Determine visual overrides (Freeze)
        // Enemy logic stripped, so we check properties if they exist
        const frozenTimer = enemy.frozenTimer || 0;
        const freezeMeter = enemy.freezeMeter || 0;

        // Render ship parts if available
        if (enemy.shipParts && enemy.shipParts.length > 0) {
            const ctx = renderer.ctx;
            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            ctx.rotate(enemy.rotation + (enemy.rotationOffset || 0));

            if (frozenTimer > 0 || freezeMeter > 0) {
                const intensity = frozenTimer > 0 ? 1.0 : (freezeMeter / 3.0);
                ctx.shadowBlur = 5 + intensity * 10;
                ctx.shadowColor = '#00ffff';
                ctx.globalAlpha = 0.8;
            }

            for (const partData of enemy.shipParts) {
                const def = PartsLibrary[partData.partId];
                if (!def) continue;

                const isRotated = ((partData.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;
                const drawX = (partData.x + (w - 1) / 2) * TILE_SIZE;
                const drawY = (partData.y + (h - 1) / 2) * TILE_SIZE;

                const baseAngle = (partData.rotation || 0) * (Math.PI / 2);

                let drawAngle = baseAngle;
                let turretX = drawX;
                let turretY = drawY;

                // Weapon aiming logic
                if (def.type === 'weapon') {
                    let offsetX = 0;
                    let offsetY = 0;

                    if (def.turretDrawOffset) {
                        // ... offset logic ...
                         // Scalar approximation
                        offsetX = Math.cos(baseAngle) * (typeof def.turretDrawOffset === 'number' ? def.turretDrawOffset : 0);
                        offsetY = Math.sin(baseAngle) * (typeof def.turretDrawOffset === 'number' ? def.turretDrawOffset : 0);
                    }

                    turretX = drawX + offsetX;
                    turretY = drawY + offsetY;

                    if (enemy.aimAngle !== undefined) {
                        // drawAngle = AimAngle - (ShipRotation + RotationOffset)
                        drawAngle = enemy.aimAngle - (enemy.rotation + (enemy.rotationOffset || 0));
                    } else {
                        drawAngle = 0;
                    }
                }

                let enemyColor = '#ff6666';
                if (frozenTimer > 0) enemyColor = '#00ffff';

                if (def.type === 'weapon' && def.baseSprite) {
                    def.baseSprite.draw(ctx, drawX, drawY, (partData.rotation || 0) * (Math.PI / 2), 0.5, 0.5, null, enemyColor);
                }

                def.sprite.draw(ctx, turretX, turretY, drawAngle + (def.rotationOffset || 0), null, null, null, enemyColor);

                // Shield Visual
                if (def.type === 'shield' && (!partData.shieldCooldown || partData.shieldCooldown <= 0)) {
                    const pulse = 1.0 + Math.sin(Date.now() / 200) * 0.1;
                    const scale = (def.stats.shieldRadiusScale || 1.4) * pulse;

                    ctx.beginPath();
                    ctx.arc(drawX, drawY, (def.width * TILE_SIZE / 2) * scale, 0, Math.PI * 2);
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

            // Draw Charge Telegraphs (Copied Logic)
            if (enemy.weaponCooldowns) {
                // ... (simplified telegraph drawing)
            }

            if (frozenTimer > 0 || freezeMeter > 0) {
                ctx.globalAlpha = 1.0;
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        } else if (enemy.sprite) {
             // Fallback sprite
             const color = (frozenTimer > 0) ? '#00ffff' : undefined;
             enemy.sprite.draw(renderer.ctx, enemy.x, enemy.y, enemy.rotation + (enemy.rotationOffset || 0), 0.5, 0.5, null, color);
        }

        // Draw Health Bar
        EntityRenderer.drawHealthBar(renderer, enemy);
    }

    static drawHealthBar(renderer, entity) {
        if (!entity.maxHp || entity.maxHp <= 0) return;

        let barCenterX = entity.x;
        let topY = entity.y - (entity.radius || 20);

        // ... Calculate bounding box logic if parts exist ...
        // Simplified for now:
        const barW = Math.min(160, Math.max(40, entity.maxHp / 2));
        const barH = 8;
        const hpPct = Math.max(0, entity.hp / entity.maxHp);
        const barY = topY - 25;

        const ctx = renderer.ctx;
        ctx.save();

        // Terminal Border
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barCenterX - barW / 2 - 2, barY - 2, barW + 4, barH + 4);

        ctx.fillStyle = 'rgba(0, 20, 30, 0.8)';
        ctx.fillRect(barCenterX - barW / 2, barY, barW, barH);

        if (hpPct > 0) {
            const fillW = barW * hpPct;
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(barCenterX - barW / 2, barY, fillW, barH);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(barCenterX - barW / 2, barY, fillW, barH / 2);
        }

        // Segments
        const segmentCount = Math.floor(barW / 20);
        if (segmentCount > 1) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            for (let i = 1; i < segmentCount; i++) {
                const sx = (barCenterX - barW / 2) + (barW / segmentCount) * i;
                ctx.beginPath();
                ctx.moveTo(sx, barY - 2);
                ctx.lineTo(sx, barY + barH + 2);
                ctx.stroke();
            }
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(entity.hp)} /${Math.ceil(entity.maxHp)}`, barCenterX, barY + barH / 2 + 1);

        ctx.restore();
    }

    static drawProjectile(renderer, p) {
        if (p.delay > 0) return;
        const color = p.owner === 'enemy' ? '#ff4444' : '#26d426';
        const ctx = renderer.ctx;

        if (p.type === 'laser' || p.type === 'small_laser' || p.type === 'railgun' || p.type === 'saber' || p.type === 'beam_freeze') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);

            // Beam logic (Railgun/Saber visual state)
            // ... (Copy detailed logic from Projectile.js.draw)
            // Simplified for now:
            renderer.drawRect(-15, -2, 30, 4, color);

            ctx.restore();
        } else {
            // Generic
            const size = p.radius * 2;
            renderer.drawRect(p.x - p.radius, p.y - p.radius, size, size, color);
        }
        // ... (Include other projectile types like rockets)
    }

    static drawLootCrate(renderer, crate) {
        // ... (Logic from LootCrate.js)
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(crate.x, crate.y);
        ctx.rotate(crate.rotation);

        const w = crate.width;
        const h = crate.height;
        const hw = w/2;
        const hh = h/2;

        if (crate.isOpened) {
             ctx.fillStyle = '#222';
             ctx.fillRect(-hw, -hh, w, h);
        } else {
             ctx.fillStyle = crate.baseColor || '#506070';
             ctx.fillRect(-hw, -hh, w, h);
             // ... Details
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
        else if (asteroid.type === 'crystal_blue') ctx.fillStyle = '#00ffff';
        else ctx.fillStyle = '#ffaa00';

        // Draw Vertices
        if (asteroid.vertices) {
            // ... (Logic from Asteroid.js)
            // Simplified: Draw polygon
            ctx.beginPath();
            asteroid.vertices.forEach((v, i) => {
                if (i===0) ctx.moveTo(v.x, v.y);
                else ctx.lineTo(v.x, v.y);
            });
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    static drawDrone(renderer, drone) {
        // ... (Logic from Drone.js)
        if (drone.sprite) {
             drone.sprite.draw(renderer.ctx, drone.x, drone.y, drone.rotation + Math.PI/2, 0.5, 0.5);
        }
    }

    static drawOrb(renderer, orb) {
        if (orb.isDead) return;
        const ctx = renderer.ctx;

        // XP Orb Pulse
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

    static drawShopItem(renderer, item) {
        if (item.purchased) return;
        const ctx = renderer.ctx;
        const bobY = item.y + Math.sin((item.life || 0) * 2 + (item.bobOffset || 0)) * 6;

        ctx.save();
        ctx.translate(item.x, bobY);

        ctx.shadowBlur = 20;
        ctx.shadowColor = item.data.type === 'heal' ? '#44ff44' : '#ffd700';

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = item.data.type === 'heal' ? '#44ff44' : '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (item.data.type === 'heal') {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-10, -3, 20, 6);
            ctx.fillRect(-3, -10, 6, 20);
        } else if (item.partDef && item.partDef.sprite) {
            item.partDef.sprite.draw(ctx, 0, 0, 0);
        }

        ctx.fillStyle = '#ffd700';
        ctx.font = "bold 10px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText(`${item.data.price}g`, 0, item.radius + 18);

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
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    static drawItemPickup(renderer, item) {
        // Simple logic for pickup
        if (item.isDead) return;
        const ctx = renderer.ctx;
        const bobY = item.y + Math.sin(item.life * 5 + item.bobOffset) * 4;

        ctx.save();
        ctx.translate(item.x, bobY);

        // Draw sprite if available (need def)
        // item has item.def usually if populated, or we look it up
        const def = PartsLibrary[item.partId];
        if (def && def.sprite) {
            // Glow based on rarity
            let glow = '#00ff00';
            if (def.rarity === 'rare') glow = '#0088ff';
            if (def.rarity === 'epic') glow = '#aa00ff';

            ctx.shadowBlur = 15;
            ctx.shadowColor = glow;
            def.sprite.draw(ctx, 0, 0, 0, 0.5, 0.5);
            ctx.shadowBlur = 0;
        } else {
            renderer.drawCircle(0, 0, 10, '#00ff00');
        }
        ctx.restore();
    }

    static drawPortal(renderer, p) {
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0); // Portals spin?

        // Simple portal viz
        const r = p.radius || 60;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(100, 0, 255, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#aa00ff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.restore();
    }
}
