import { EntityRenderer } from './EntityRenderer.js';
import { drawProjectile } from './ProjectileRenderer.js';
import { drawDebugHitboxes } from './DebugHitboxRenderer.js';

export class WorldSceneRenderer {
    constructor(game, {
        entityRenderer = EntityRenderer,
        drawProjectileFn = drawProjectile,
        drawDebugHitboxesFn = drawDebugHitboxes
    } = {}) {
        this.game = game;
        this.entityRenderer = entityRenderer;
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
                if (!item.purchased) {
                    this.entityRenderer.drawShopItem(renderer, item);
                }
            });
            if (game.hoveredShopItem && !game.hoveredShopItem.purchased) {
                game.hoveredShopItem.drawTooltip(
                    renderer,
                    game.gold >= game.hoveredShopItem.data.price
                );
            }

            game.treasureChests.forEach(chest => {
                if (!chest.opened) {
                    this.entityRenderer.drawTreasureChest(renderer, chest);
                }
            });
            if (game.hoveredTreasureChest && !game.hoveredTreasureChest.opened) {
                game.hoveredTreasureChest.drawTooltip(renderer, true);
            }

            if (game.vaultChests) {
                game.vaultChests.forEach(chest => {
                    this.entityRenderer.drawVaultChest(renderer, chest);
                });
            }
            if (game.hoveredVaultChest && !game.hoveredVaultChest.opened) {
                game.hoveredVaultChest.drawTooltip(
                    renderer,
                    game.playerShip.hp,
                    game.gold
                );
            }

            game.projectiles.forEach(projectile =>
                this.drawProjectile(renderer, projectile));
            game.drones.forEach(drone =>
                this.entityRenderer.drawDrone(renderer, drone));

            this.drawDebugHitboxes(game, shipCos, shipSin);

            if (!game.playerShip.isDead) {
                this.entityRenderer.drawShip(
                    renderer,
                    game.playerShip,
                    worldMouseX,
                    worldMouseY
                );
            }

            game.effects.drawWorld();
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

        if (game.floor === 1 && room.gridX === 0 && room.gridY === 0) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = "bold 24px 'Press Start 2P'";
            ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
            const centerX = room.x + room.width / 2;
            const centerY = room.y + room.height / 2;
            ctx.fillText('wasd: move', centerX - 100, centerY - 150);
            ctx.fillText('l-click: shoot', centerX - 100, centerY - 80);
            ctx.fillText('e: interact', centerX - 100, centerY - 10);
            ctx.fillText('tab: hangar', centerX - 100, centerY + 60);
            ctx.fillText('m: map', centerX - 100, centerY + 130);
            ctx.restore();
        }
    }
}
