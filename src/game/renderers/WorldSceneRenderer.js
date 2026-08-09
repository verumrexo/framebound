import { EntityRenderer } from './EntityRenderer.js';
import { drawProjectile } from './ProjectileRenderer.js';
import { drawDebugHitboxes } from './DebugHitboxRenderer.js';
import { VaultRenderer } from './VaultRenderer.js';
import { RoomType } from '../environment/RoomType.js';

export class WorldSceneRenderer {
    constructor(game, {
        entityRenderer = EntityRenderer,
        vaultRenderer = VaultRenderer,
        drawProjectileFn = drawProjectile,
        drawDebugHitboxesFn = drawDebugHitboxes
    } = {}) {
        this.game = game;
        this.entityRenderer = entityRenderer;
        this.vaultRenderer = vaultRenderer;
        this.drawProjectile = drawProjectileFn;
        this.drawDebugHitboxes = drawDebugHitboxesFn;
    }

    draw() {
        const game = this.game;
        const renderer = game.renderer;

        renderer.withCamera(game.camera, () => {
            const alpha = Math.max(0.02, game.graphics.gridOpacity);
            game.grid.draw(renderer, game.camera, alpha);

            if (game.rooms) {
                for (const room of game.rooms) {
                    this.drawRoom(room);
                    if (room.type === RoomType.VAULT && room.visited) {
                        this.vaultRenderer.draw(
                            renderer,
                            room,
                            game.eyeCandy !== false
                        );
                    }
                }
            }

            const shipCos = Math.cos(game.rotation);
            const shipSin = Math.sin(game.rotation);
            const mouse = game.input.getMousePos();
            const zoom = game.camera.zoom || 1;
            const worldMouseX = (mouse.x / zoom) + game.camera.x;
            const worldMouseY = (mouse.y / zoom) + game.camera.y;

            game.asteroids.forEach(entity =>
                this.entityRenderer.drawAsteroid(renderer, entity));
            game.lootCrates.forEach(entity =>
                this.entityRenderer.drawLootCrate(renderer, entity));
            game.shipwrecks.forEach(entity =>
                this.entityRenderer.drawShipwreck(renderer, entity));
            game.portals.forEach(entity =>
                this.entityRenderer.drawPortal(renderer, entity));

            game.xpOrbs.forEach(entity =>
                this.entityRenderer.drawOrb(renderer, entity));
            game.goldOrbs.forEach(entity =>
                this.entityRenderer.drawOrb(renderer, entity));
            game.hpOrbs.forEach(entity =>
                this.entityRenderer.drawOrb(renderer, entity));
            game.itemPickups.forEach(entity =>
                this.entityRenderer.drawItemPickup(renderer, entity));

            (game.decoys || []).forEach(decoy =>
                this.drawDecoy(renderer, decoy));

            game.enemies.forEach(entity =>
                this.entityRenderer.drawEnemy(renderer, entity));
            game.bosses.forEach(entity =>
                this.entityRenderer.drawEnemy(renderer, entity));

            if (game.network && game.network.otherPlayers) {
                for (const [, player] of game.network.otherPlayers) {
                    if (typeof player.draw === 'function') player.draw(renderer);
                    else this.entityRenderer.drawShip(renderer, player);
                }
            }

            game.shopItems.forEach(item => {
                this.entityRenderer.drawShopItem(renderer, item, {
                    credits: game.gold
                });
            });

            game.treasureChests.forEach(chest => {
                if (!chest.opened) {
                    this.entityRenderer.drawTreasureChest(renderer, chest);
                }
            });

            game.projectiles.forEach(projectile =>
                this.drawProjectile(renderer, projectile));
            game.drones.forEach(drone =>
                this.entityRenderer.drawDrone(renderer, drone));
            game.salvageSweep?.draw?.(renderer);

            this.drawDebugHitboxes(game, shipCos, shipSin);

            if (!game.playerShip.isDead) {
                this.entityRenderer.drawShip(
                    renderer,
                    game.playerShip,
                    worldMouseX,
                    worldMouseY
                );
            }

            for (const explosion of game.explosions) {
                const alpha = explosion.life / explosion.maxLife;
                renderer.ctx.save();
                renderer.ctx.globalAlpha = alpha * 0.5;
                renderer.drawCircle(explosion.x, explosion.y, explosion.radius * (1.2 - alpha), '#ffaa44');
                renderer.ctx.restore();
            }
        });
    }

    drawRoom(room) {
        const game = this.game;
        const ctx = game.renderer.ctx;
        const isCurrent = room === game.currentRoom;
        let color = '#444';
        if (room.locked) color = '#ff3333';
        else if (isCurrent) color = '#44ff44';
        else if (room.cleared) color = '#666';

        const lineWidth = room.locked || isCurrent ? 8 : 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(room.x, room.y, room.width, room.height);

        if (isCurrent) {
            ctx.fillStyle = room.locked ?
                'rgba(255, 0, 0, 0.15)' :
                'rgba(0, 255, 0, 0.05)';
            ctx.fillRect(room.x, room.y, room.width, room.height);
        }

    }

    drawDecoy(renderer, decoy) {
        if (!decoy || decoy.isDead) return;
        const ctx = renderer.ctx;
        ctx.save();
        ctx.globalAlpha = 0.52;
        ctx.strokeStyle = '#66f6ff';
        ctx.fillStyle = 'rgba(102, 246, 255, 0.12)';
        renderer.drawCircle?.(decoy.x, decoy.y, decoy.radius || 22, ctx.fillStyle);
        renderer.drawLine?.(
            decoy.x - 18,
            decoy.y,
            decoy.x + 18,
            decoy.y,
            ctx.strokeStyle,
            2
        );
        renderer.drawLine?.(
            decoy.x,
            decoy.y - 18,
            decoy.x,
            decoy.y + 18,
            ctx.strokeStyle,
            2
        );
        renderer.drawLine?.(
            decoy.x + 22,
            decoy.y,
            decoy.x + 8,
            decoy.y - 8,
            ctx.strokeStyle,
            2
        );
        renderer.drawLine?.(
            decoy.x + 8,
            decoy.y - 8,
            decoy.x + 8,
            decoy.y + 8,
            ctx.strokeStyle,
            2
        );
        renderer.drawLine?.(
            decoy.x + 8,
            decoy.y + 8,
            decoy.x + 22,
            decoy.y,
            ctx.strokeStyle,
            2
        );
        ctx.restore();
    }
}
