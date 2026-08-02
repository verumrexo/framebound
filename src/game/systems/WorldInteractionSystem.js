import { ItemPickup } from '../../shared/entities/ItemPickup.js';
import { PartsLibrary } from '../../shared/parts/Part.js';

const MAX_REMOTE_INTERACTION_DISTANCE = 1200;

export class WorldInteractionSystem {
    constructor(game, {
        random = Math.random,
        partsLibrary = PartsLibrary,
        ItemPickupClass = ItemPickup
    } = {}) {
        this.game = game;
        this.random = random;
        this.partsLibrary = partsLibrary;
        this.ItemPickupClass = ItemPickupClass;
    }

    update(dt) {
        const game = this.game;
        this.updatePresentation(dt);
        this.updateHoveredTargets();

        const eDown = game.input.isKeyDown('KeyE');
        const ePressed = eDown && !game.eKeyLastFrame;
        const clicked = game.input.isMouseDown() && !game.mouseDownLastFrame;

        if ((ePressed || clicked) && game.hoveredShopItem) {
            this.purchaseShopItem(game.hoveredShopItem);
        }
        if ((ePressed || clicked) && game.hoveredTreasureChest) {
            this.openTreasureChest(game.hoveredTreasureChest);
        }
        if ((ePressed || clicked) && game.hoveredVaultChest) {
            this.tryActivateVaultChest(game.hoveredVaultChest);
        }

        game.eKeyLastFrame = eDown;
    }

    updateGuest(dt) {
        const game = this.game;
        this.updatePresentation(dt);
        this.updateHoveredTargets();

        const eDown = game.input.isKeyDown('KeyE');
        const ePressed = eDown && !game.eKeyLastFrame;
        const clicked = game.input.isMouseDown() && !game.mouseDownLastFrame;
        if (ePressed || clicked) {
            const target = this.hoveredTarget();
            if (target) {
                game.peerNetwork?.sendInteraction?.(
                    target.kind,
                    target.index
                );
            }
        }
        game.eKeyLastFrame = eDown;
    }

    updatePresentation(dt) {
        const game = this.game;
        if (Number.isFinite(dt)) {
            for (const item of game.shopItems) {
                if (!item.purchased) item.update(dt);
            }
            for (const chest of game.treasureChests) {
                if (!chest.opened) chest.update(dt);
            }
            for (const chest of game.vaultChests) {
                chest.update(dt);
            }
        }
    }

    updateHoveredTargets() {
        const game = this.game;
        const mouse = game.input.getMousePos();
        const zoom = game.camera.zoom || 1;
        const worldMouseX = (mouse.x / zoom) + game.camera.x;
        const worldMouseY = (mouse.y / zoom) + game.camera.y;

        game.hoveredShopItem = this.findHovered(
            game.shopItems,
            worldMouseX,
            worldMouseY,
            item => item.purchased
        );
        game.hoveredTreasureChest = this.findHovered(
            game.treasureChests,
            worldMouseX,
            worldMouseY,
            chest => chest.opened
        );
        game.hoveredVaultChest = this.findHovered(
            game.vaultChests,
            worldMouseX,
            worldMouseY,
            chest => chest.opened
        );
    }

    hoveredTarget() {
        const game = this.game;
        if (game.hoveredShopItem) {
            return {
                kind: 'shop',
                index: game.shopItems.indexOf(game.hoveredShopItem)
            };
        }
        if (game.hoveredTreasureChest) {
            return {
                kind: 'treasure',
                index: game.treasureChests.indexOf(
                    game.hoveredTreasureChest
                )
            };
        }
        if (game.hoveredVaultChest) {
            return {
                kind: 'vault',
                index: game.vaultChests.indexOf(game.hoveredVaultChest)
            };
        }
        return null;
    }

    findHovered(items, worldMouseX, worldMouseY, isUnavailable) {
        for (const item of items) {
            if (isUnavailable(item)) continue;

            const dx = worldMouseX - item.x;
            const dy = worldMouseY - item.y;
            if (Math.sqrt(dx * dx + dy * dy) < item.radius + 20) {
                return item;
            }
        }

        return null;
    }

    interactForPlayer(player, targetKind, targetIndex) {
        if (!player || player.ship?.isDead || player.suspended) return false;
        const targets = {
            shop: this.game.shopItems,
            treasure: this.game.treasureChests,
            vault: this.game.vaultChests,
            portal: this.game.portals
        }[targetKind];
        const target = targets?.[targetIndex];
        if (!target || !this.canReach(player, target)) return false;

        if (targetKind === 'shop') {
            return this.purchaseShopItem(target, player);
        }
        if (targetKind === 'treasure') {
            return this.openTreasureChest(target);
        }
        if (targetKind === 'vault') {
            return this.tryActivateVaultChest(target, player);
        }
        return false;
    }

    canReach(player, target) {
        const dx = player.x - target.x;
        const dy = player.y - target.y;
        return Number.isFinite(dx) &&
            Number.isFinite(dy) &&
            dx * dx + dy * dy <=
                MAX_REMOTE_INTERACTION_DISTANCE ** 2;
    }

    purchaseShopItem(shopItem, player = null) {
        if (!shopItem || shopItem.purchased || !shopItem.data) return;

        const game = this.game;
        const buyer = player || {
            id: 'host',
            ship: game.playerShip
        };
        const item = shopItem.data;
        if (game.gold < item.price) {
            if (buyer.id === 'host') {
                game.showNotification('not enough gold!', '#ff4444');
            }
            return false;
        }

        game.gold -= item.price;

        if (item.type === 'heal') {
            const healAmount = 50;
            buyer.ship.hp = Math.min(
                buyer.ship.hp + healAmount,
                buyer.ship.maxHp
            );
            if (buyer.id === 'host') {
                game.showNotification(`+${healAmount} HP!`, '#44ff44');
            }
        } else if (item.type === 'part') {
            const pickup = new this.ItemPickupClass(
                shopItem.x,
                shopItem.y,
                item.partId,
                this.random
            );
            pickup.ownerId = buyer.id;
            game.itemPickups.push(pickup);
            if (buyer.id === 'host') {
                game.showNotification(
                    `Unlocked: ${item.name}! Pick it up.`,
                    '#ffd700'
                );
            }
        }

        shopItem.purchased = true;
        if (game.currentRoom) {
            game.currentRoom.shopUsed = true;
        }
        return true;
    }

    openTreasureChest(chest) {
        if (!chest || chest.opened) return false;

        const game = this.game;
        const allParts = Object.entries(this.partsLibrary)
            .filter(([id]) => id !== 'core')
            .map(([id, def]) => ({ id, def }));

        if (allParts.length === 0) {
            game.showNotification('Chest is empty!', '#ff4444');
            chest.opened = true;
            return true;
        }

        const randomPart = allParts[Math.floor(this.random() * allParts.length)];
        chest.opened = true;
        game.itemPickups.push(new this.ItemPickupClass(
            chest.x,
            chest.y,
            randomPart.id,
            this.random
        ));

        const partName = randomPart.def.name || randomPart.id;
        game.showNotification(`Chest opened! Pick up: ${partName}`, '#ffd700');
        game.audio.play('hit', { volume: 0.6 });
        return true;
    }

    tryActivateVaultChest(chest, player = null) {
        if (!chest || chest.opened || chest.ambushActive) return;

        const game = this.game;
        const buyer = player || {
            id: 'host',
            ship: game.playerShip
        };
        if (game.currentRoom?.cleared && !chest.locked && chest.wasPaid) {
            this.openVaultChest(chest);
            return;
        }

        if (chest.locked || chest.wasPaid) return;

        if (chest.costType === 'gold') {
            if (game.gold >= chest.costAmount) {
                game.gold -= chest.costAmount;
                this.triggerVaultAmbush(chest);
            } else {
                if (buyer.id === 'host') {
                    game.showNotification('Not enough Gold!', '#ff0000');
                }
            }
        } else if (chest.costType === 'hp') {
            if (buyer.ship.hp > chest.costAmount) {
                buyer.ship.hp -= chest.costAmount;
                this.triggerVaultAmbush(chest);
            } else {
                if (buyer.id === 'host') {
                    game.showNotification('Not enough Health!', '#ff0000');
                }
            }
        }
        return chest.wasPaid || chest.opened;
    }

    triggerVaultAmbush(chest) {
        if (!chest) return;

        chest.wasPaid = true;
        this.game.currentRoom?.startAmbush(this.game);
    }

    openVaultChest(chest) {
        if (!chest || chest.opened) return;

        const game = this.game;
        chest.opened = true;
        game.showNotification('VAULT LOOT ACQUIRED!', '#00ff00');
        game.audio.play('hit', { volume: 0.8, pitch: 0.5 });
        game.spawnExplosion(chest.x, chest.y, 80, 0.8);

        const possibleParts = Object.keys(this.partsLibrary)
            .filter(id => id !== 'core');

        for (let i = 0; i < 3; i++) {
            if (possibleParts.length === 0) break;

            const partId = possibleParts[
                Math.floor(this.random() * possibleParts.length)
            ];
            const x = chest.x + (this.random() - 0.5) * 60;
            const y = chest.y + (this.random() - 0.5) * 60;
            game.itemPickups.push(new this.ItemPickupClass(
                x,
                y,
                partId,
                this.random
            ));
        }
    }
}
