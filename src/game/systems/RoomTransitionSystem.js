import { hasLoadedSound } from './GameAudio.js';

export class RoomTransitionSystem {
    constructor(game) {
        this.game = game;
    }

    update() {
        const game = this.game;
        const trigger = this.findTransitioningPlayer();
        const nextRoom = trigger?.nextRoom;

        if (!nextRoom || nextRoom === game.currentRoom) return false;
        if (game.currentRoom?.locked) return false;

        // Save outside a new room so continuing never resumes inside fresh combat.
        if (!nextRoom.visited && game.playerShip) {
            game.autoSave();
        }

        const entryX = roomEntryCoordinate(
            trigger.player.x,
            nextRoom.x,
            nextRoom.width
        );
        const entryY = roomEntryCoordinate(
            trigger.player.y,
            nextRoom.y,
            nextRoom.height
        );

        game.currentRoom?.deactivate?.(game);
        game.asteroids = [];
        game.lootCrates = [];
        game.shipwrecks = [];
        game.xpOrbs = [];
        game.goldOrbs = [];
        game.hpOrbs = [];
        game.itemPickups = [];
        game.shopItems = [];
        game.treasureChests = [];
        game.vaultChests = [];
        game.explosions = [];

        game.currentRoom = nextRoom;
        this.moveTeam(entryX, entryY);
        nextRoom.onEnter(game);
        return true;
    }

    findTransitioningPlayer() {
        const game = this.game;
        const simulation = game.peerNetwork?.isHost
            ? game.peerNetwork.simulation
            : null;
        const players = simulation?.getPickupPlayers?.() || (
            game.playerShip?.isDead
                ? []
                : [{
                    id: 'host',
                    ship: game.playerShip,
                    x: game.x,
                    y: game.y
                }]
        );
        for (const player of players) {
            const nextRoom = game.levelGen.getRoomAtWorldPos(
                player.x,
                player.y
            );
            if (nextRoom && nextRoom !== game.currentRoom) {
                return { player, nextRoom };
            }
        }
        return null;
    }

    moveTeam(x, y) {
        const game = this.game;
        game.x = x;
        game.y = y;
        game.vx = 0;
        game.vy = 0;
        const simulation = game.peerNetwork?.isHost
            ? game.peerNetwork.simulation
            : null;
        for (const peer of simulation?.peers?.values() || []) {
            peer.ship.x = x;
            peer.ship.y = y;
            peer.ship.vx = 0;
            peer.ship.vy = 0;
        }
    }

    enforceCurrentRoomBounds() {
        const game = this.game;
        const room = game.currentRoom;
        if (!room) return;

        const margin = 30;
        if (room.locked) {
            if (game.x < room.x + margin) {
                game.x = room.x + margin;
                game.vx = 0;
            } else if (game.x > room.x + room.width - margin) {
                game.x = room.x + room.width - margin;
                game.vx = 0;
            }

            if (game.y < room.y + margin) {
                game.y = room.y + margin;
                game.vy = 0;
            } else if (game.y > room.y + room.height - margin) {
                game.y = room.y + room.height - margin;
                game.vy = 0;
            }
            return;
        }

        if (game.x < room.x + margin) {
            const neighbor = game.levelGen.getRoomAtWorldPos(
                room.x - 10,
                game.y
            );
            if (!neighbor) {
                game.x = room.x + margin;
                game.vx = 0;
            }
        } else if (game.x > room.x + room.width - margin) {
            const neighbor = game.levelGen.getRoomAtWorldPos(
                room.x + room.width + 10,
                game.y
            );
            if (!neighbor) {
                game.x = room.x + room.width - margin;
                game.vx = 0;
            }
        }

        if (game.y < room.y + margin) {
            const neighbor = game.levelGen.getRoomAtWorldPos(
                game.x,
                room.y - 10
            );
            if (!neighbor) {
                game.y = room.y + margin;
                game.vy = 0;
            }
        } else if (game.y > room.y + room.height - margin) {
            const neighbor = game.levelGen.getRoomAtWorldPos(
                game.x,
                room.y + room.height + 10
            );
            if (!neighbor) {
                game.y = room.y + room.height - margin;
                game.vy = 0;
            }
        }
    }

    teleportToRoom(room) {
        if (!room) return false;

        const game = this.game;
        game.currentRoom?.deactivate?.(game);
        this.moveTeam(
            room.x + room.width / 2,
            room.y + room.height / 2
        );
        game.currentRoom = room;

        game.projectiles = [];
        game.asteroids = [];
        game.lootCrates = [];
        game.shipwrecks = [];
        game.xpOrbs = [];
        game.goldOrbs = [];
        game.hpOrbs = [];
        game.itemPickups = [];
        game.shopItems = [];
        game.treasureChests = [];
        game.vaultChests = [];
        game.explosions = [];
        room.onEnter?.(game);

        game.showNotification('teleported!', '#00ffff');
        game.audio.play('respawn', { volume: 0.5 });
        if (!hasLoadedSound(game.audio, 'respawn')) {
            game.audio.play('dash', { volume: 0.5, pitch: 0.5 });
        }

        return true;
    }
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function roomEntryCoordinate(value, origin, size) {
    if (!Number.isFinite(origin) || !Number.isFinite(size)) return value;
    return clamp(value, origin + 30, origin + size - 30);
}
