import { ItemPickup } from '../../shared/entities/ItemPickup.js';
import { PartsLibrary } from '../../shared/parts/Part.js';
import { VaultPhase } from '../../shared/vault/VaultDefinitions.js';
import { commitVaultContract } from '../vault/VaultEconomy.js';
import { claimVaultReward } from '../vault/VaultRewardSystem.js';
import { DOCTRINE_PART_SPECS } from '../../shared/parts/arsenal/DoctrineParts.js';

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
            if (game.hoveredShopItem.data?.type === 'doctrine_terminal') {
                game.doctrineTerminal?.open();
            } else {
                this.purchaseShopItem(game.hoveredShopItem);
            }
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
                if (target.kind === 'shop' && game.hoveredShopItem?.data?.type === 'doctrine_terminal') {
                    game.doctrineTerminal?.open();
                    game.eKeyLastFrame = eDown;
                    return;
                }
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
        if (targetKind === 'doctrine') {
            const terminal = this.game.shopItems?.find(item => item.data?.type === 'doctrine_terminal');
            if (!terminal || !this.canReach(player, terminal)) return false;
            const spec = DOCTRINE_PART_SPECS[targetIndex];
            return spec ? this.purchaseDoctrine(spec.id, player, terminal) : false;
        }
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
        if (shopItem.data.type === 'doctrine_terminal') {
            if (!player) return this.game.doctrineTerminal?.open() || false;
            return false;
        }

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

    purchaseDoctrine(partId, player = null, terminal = null) {
        const game = this.game;
        const definition = this.partsLibrary[partId];
        if (!definition || definition.shopCategory !== 'doctrine') return false;
        const price = definition.shopPrice || 90;
        if (game.gold < price) return false;
        const buyer = player || { id: 'host', ship: game.playerShip };
        const source = terminal || game.shopItems?.find(item => item.data?.type === 'doctrine_terminal');
        if (!source) return false;
        game.gold -= price;
        const pickup = new this.ItemPickupClass(source.x, source.y, partId, this.random);
        pickup.ownerId = buyer.id;
        game.itemPickups.push(pickup);
        if (buyer.id === 'host') {
            game.showNotification(`unlocked: ${definition.name}! pick it up.`, '#ffaa00');
        }
        return true;
    }

    openTreasureChest(chest) {
        if (!chest || chest.opened) return false;

        const game = this.game;
        const allParts = Object.entries(this.partsLibrary)
            .filter(([id, definition]) =>
                id !== 'core' && definition.shopCategory !== 'doctrine'
            )
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
        if (!chest || chest.opened || chest.ambushActive || chest.sealed) {
            return false;
        }

        const game = this.game;
        const buyer = player || {
            id: 'host',
            ship: game.playerShip
        };
        chest.contractId ||= chest.costType === 'hp' ? 'blood' : 'gilded';
        const state = game.currentRoom?.vaultState;
        if (
            state?.phase === VaultPhase.REWARD &&
            state.contractId === chest.contractId
        ) {
            return this.openVaultChest(chest, buyer);
        }

        if (
            chest.locked ||
            chest.wasPaid ||
            (state && state.phase !== VaultPhase.OFFER)
        ) {
            return false;
        }

        const result = commitVaultContract(chest, game, buyer);
        if (!result.ok) {
            if (buyer.id === 'host') {
                const resource = result.offer?.costType === 'hp' ?
                    'frame integrity' : 'shared gold';
                game.showNotification(`insufficient ${resource}`, '#ff4f70');
            }
            return false;
        }
        return true;
    }

    openVaultChest(chest, buyer = null) {
        if (!chest || chest.opened) return false;

        return claimVaultReward({
            room: this.game.currentRoom,
            chest,
            game: this.game,
            buyer,
            ItemPickupClass: this.ItemPickupClass,
            random: this.random
        });
    }
}
