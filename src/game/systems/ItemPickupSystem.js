import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';

const PICKUP_BROAD_PHASE_RADIUS = 300;

export class ItemPickupSystem {
    constructor(game, {
        partsLibrary = PartsLibrary,
        tileSize = TILE_SIZE
    } = {}) {
        this.game = game;
        this.partsLibrary = partsLibrary;
        this.tileSize = tileSize;
    }

    update(dt) {
        const game = this.game;

        for (let i = game.itemPickups.length - 1; i >= 0; i--) {
            const item = game.itemPickups[i];
            const players = this.eligiblePlayers(item);
            const target = this.nearestPlayer(item, players);
            item.update(dt, target ? { x: target.x, y: target.y } : null);

            const collector = this.nearestPlayer(
                item,
                players.filter(player => this.touchesShip(item, player))
            );
            if (!collector) continue;

            this.collect(item, collector);
            game.itemPickups.splice(i, 1);
        }
    }

    eligiblePlayers(item) {
        const simulation = this.game.peerNetwork?.isHost
            ? this.game.peerNetwork.simulation
            : null;
        const players = simulation?.getPickupPlayers?.() || [
            {
                id: 'host',
                ship: this.game.playerShip,
                x: this.game.x,
                y: this.game.y,
                rotation: this.game.rotation,
                inventory: this.game.hangar.inventory
            }
        ];
        return players.filter(player =>
            player?.ship &&
            !player.ship.isDead &&
            (!item.ownerId || item.ownerId === player.id)
        );
    }

    nearestPlayer(item, players) {
        let nearest = null;
        let nearestDistance = Infinity;
        for (const player of players) {
            const dx = player.x - item.x;
            const dy = player.y - item.y;
            const distance = dx * dx + dy * dy;
            if (distance >= nearestDistance) continue;
            nearest = player;
            nearestDistance = distance;
        }
        return nearest;
    }

    touchesShip(item, player) {
        const dxGlobal = player.x - item.x;
        const dyGlobal = player.y - item.y;
        if (
            dxGlobal * dxGlobal + dyGlobal * dyGlobal
            > PICKUP_BROAD_PHASE_RADIUS * PICKUP_BROAD_PHASE_RADIUS
        ) {
            return false;
        }

        const cos = Math.cos(player.rotation);
        const sin = Math.sin(player.rotation);

        for (const partRef of player.ship.getUniqueParts()) {
            const def = this.partsLibrary[partRef.partId];
            if (!def) continue;

            const width = def.width || 1;
            const height = def.height || 1;
            const localX = (partRef.x + (width - 1) / 2) * this.tileSize;
            const localY = (partRef.y + (height - 1) / 2) * this.tileSize;
            const partX = player.x + (localX * cos - localY * sin);
            const partY = player.y + (localX * sin + localY * cos);
            const dx = partX - item.x;
            const dy = partY - item.y;
            const partRadius = (
                Math.sqrt(width * width + height * height) * this.tileSize
            ) / 2;
            const pickupDistance = partRadius + item.radius;

            if (dx * dx + dy * dy < pickupDistance * pickupDistance) {
                return true;
            }
        }

        return false;
    }

    collect(item, player) {
        const game = this.game;
        const inventory = player.inventory;
        inventory[item.partId] = inventory[item.partId] === undefined
            ? 1
            : inventory[item.partId] + 1;
        if (player.id === 'host') game.hangar.updateUI();

        const def = this.partsLibrary[item.partId];
        const name = def ? (def.name || item.partId) : item.partId;
        let color = '#00ff00';
        if (def && def.rarity === 'rare') color = '#0088ff';
        if (def && def.rarity === 'epic') color = '#aa00ff';

        if (player.id === 'host') {
            game.notifications.push({
                text: `+1 ${name}`,
                life: 2.0,
                color
            });
        }
        game.audio.play('item_pickup', { volume: 0.5 });
    }
}
