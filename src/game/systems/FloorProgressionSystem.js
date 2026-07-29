import { Biomes, getRandomBiome } from '../environment/Biomes.js';

const FLOOR_SCOPED_COLLECTIONS = [
    'projectiles',
    'enemies',
    'drones',
    'bosses',
    'portals',
    'explosions',
    'xpOrbs',
    'goldOrbs',
    'hpOrbs',
    'itemPickups',
    'shipwrecks',
    'asteroids',
    'lootCrates',
    'shopItems',
    'treasureChests',
    'vaultChests',
    'damageNumbers'
];

export class FloorProgressionSystem {
    constructor(game, {
        randomBiome = getRandomBiome,
        defaultBiome = Biomes.DEFAULT
    } = {}) {
        this.game = game;
        this.randomBiome = randomBiome;
        this.defaultBiome = defaultBiome;
    }

    updatePortals(dt) {
        const game = this.game;

        for (const portal of game.portals) {
            portal.update(dt);

            if (this.anyLivingPlayerTouches(portal)) {
                game.nextLevel();
                return true;
            }
        }

        return false;
    }

    nextLevel() {
        const game = this.game;
        game.floor++;

        this.applyBiome(
            game.floor > 1 ? this.randomBiome() : this.defaultBiome
        );
        game.showNotification(
            `WARPING TO FLOOR ${game.floor}...`,
            '#aa00ff'
        );

        for (const room of game.rooms || []) {
            room.cancelPendingEvents?.();
        }

        for (const key of FLOOR_SCOPED_COLLECTIONS) {
            game[key] = [];
        }
        game.hoveredShopItem = null;
        game.hoveredTreasureChest = null;
        game.hoveredVaultChest = null;

        game.rooms = game.levelGen.generate(15 + game.floor * 2);
        game.currentRoom = game.levelGen.getRoom(0, 0);
        game.x = 1000;
        game.y = 1000;
        game.vx = 0;
        game.vy = 0;
        for (
            const peer of
            game.peerNetwork?.simulation?.peers?.values() || []
        ) {
            peer.ship.x = 1000;
            peer.ship.y = 1000;
            peer.ship.vx = 0;
            peer.ship.vy = 0;
        }

        game.currentRoom.onEnter(game);
    }

    anyLivingPlayerTouches(portal) {
        const game = this.game;
        const players = game.peerNetwork?.isHost
            ? game.peerNetwork.simulation?.getPickupPlayers?.()
            : null;
        const living = players || (
            game.playerShip?.isDead
                ? []
                : [{ x: game.x, y: game.y }]
        );
        return living.some(player =>
            Math.hypot(player.x - portal.x, player.y - portal.y) <
            portal.radius + 80
        );
    }

    applyBiome(biome, { notify = true } = {}) {
        const game = this.game;
        console.log(`[Biome] Applying: ${biome.name}`);
        game.currentBiome = biome;
        game.renderer.setBackgroundColor(biome.colors.background);
        game.grid.setColor(biome.colors.grid);

        if (game.starfield) {
            game.starfield.setColor(biome.colors.stars);
            game.starfield.generate();
        }

        if (notify) {
            game.showNotification(
                `entering ${biome.name}`,
                biome.colors.grid
            );
        }
    }
}
