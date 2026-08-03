import { Ship } from '../../shared/entities/Ship.js';
import { Portal } from '../../shared/entities/Portal.js';
import { Biomes } from '../environment/Biomes.js';
import { normalizePermanentStats } from '../../shared/combat/WeaponFamilies.js';
import { RoomType } from '../environment/RoomType.js';
import { SaveManager } from './SaveManager.js';
import {
    restoreActiveWorld,
    restoreRoomSnapshots
} from './RoomSnapshotSystem.js';

const RUN_SCOPED_COLLECTIONS = [
    'projectiles',
    'enemies',
    'drones',
    'bosses',
    'portals',
    'explosions',
    'notifications',
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
const PART_RUNTIME_KEYS = [
    'cooldown',
    'recoil',
    'rampLevel',
    'peakMeter',
    'chargeLeft',
    'chargeReady',
    'burstLeft',
    'burstTimer',
    'shieldCooldown'
];

export class GameSessionSystem {
    constructor(game, {
        ShipClass = Ship,
        PortalClass = Portal,
        saveManager = SaveManager,
        random = Math.random
    } = {}) {
        this.game = game;
        this.ShipClass = ShipClass;
        this.PortalClass = PortalClass;
        this.saveManager = saveManager;
        this.random = random;
    }

    startOffline(seed, isLoad = false) {
        const game = this.game;
        console.log('[Game] Starting Offline Mode');
        game.peerNetwork?.disconnect?.();
        if (game.networkManager?.disconnect) {
            game.networkManager.disconnect();
        } else if (game.networkManager?.isConnected) {
            game.networkManager.socket.disconnect();
            game.networkManager.isConnected = false;
        }

        const save = isLoad ? this.saveManager.load() : null;
        if (isLoad && !save) {
            console.warn('[Save] Cannot continue without a valid save');
            return false;
        }

        this.resetRunState();

        const finalSeed =
            seed ??
            save?.levelSeed ??
            Math.floor(this.random() * 2147483647);
        if (save) {
            game.floor = save.floor ?? 1;
        }
        this.createLocalPlayer();
        this.startGame(finalSeed, {
            enterStartRoom: !isLoad,
            roomCount: roomCountForFloor(game.floor)
        });

        if (save) {
            const loaded = this.loadFromSave(save, {
                regenerateLevel: false
            });
            if (!loaded) {
                game.running = false;
                this.saveManager.clearSave?.();
                return false;
            }
        }

        return true;
    }

    resetRunState() {
        const game = this.game;

        for (const room of game.rooms || []) {
            room.cancelPendingEvents?.();
        }
        for (const key of RUN_SCOPED_COLLECTIONS) {
            game[key] = [];
        }

        game.running = false;
        game.playerShip = null;
        game.currentRoom = null;
        game.level = 1;
        game.floor = 1;
        game.score = 0;
        game.xp = 0;
        game.gold = 0;
        game.xpToNext = 100;
        game.isTainted = false;
        game.x = 1000;
        game.y = 1000;
        game.vx = 0;
        game.vy = 0;
        game.rotation = 0;
        game.dashCooldown = 0;
        game.dashActiveTimer = 0;
        game.coreSpinAngle = 0;
        game.paused = false;
        game.isGameOver = false;
        game.isSpectating = false;
        game.nameEntry = '';
        game.nameEntryActive = false;
        game.fullscreenMapOpen = false;
        game.mouseDownLastFrame = false;
        game.eKeyLastFrame = false;
        game.hoveredShopItem = null;
        game.hoveredTreasureChest = null;
        game.hoveredVaultChest = null;

        if (game.hangar) {
            if (game.hangar.resetRunState) {
                game.hangar.resetRunState();
            } else {
                game.hangar.active = false;
                game.hangar.draftShip = null;
                game.hangar.hasInfiniteParts = false;
                game.hangar.inventory = {};
            }
        }
        if (game.shipBuilder) {
            if (game.shipBuilder.resetRunState) {
                game.shipBuilder.resetRunState();
            } else {
                game.shipBuilder.active = false;
                game.shipBuilder.draftShip = null;
            }
        }
        if (game.designer) {
            if (game.designer.active && game.designer.close) {
                game.designer.close();
            } else {
                game.designer.active = false;
            }
        }
        if (game.devTools) {
            if (game.devTools.resetRunState) {
                game.devTools.resetRunState();
            } else {
                game.devTools.active = false;
                game.devTools.placementMode = false;
                game.devTools.freezeEnemies = false;
                game.devTools.showHitboxes = false;
            }
        }
        if (game.levelUpManager) {
            game.levelUpManager.active = false;
            game.levelUpManager.choices = [];
            game.levelUpManager.selectionPending = false;
        }
        game.pauseMenu?.hide();
        if (game.input?.resetActiveState) {
            game.input.resetActiveState();
        } else {
            game.input?.clearPressed();
        }

        if (
            game.currentBiome &&
            game.currentBiome !== Biomes.DEFAULT &&
            game.floorProgression
        ) {
            game.floorProgression.applyBiome(
                Biomes.DEFAULT,
                { notify: false }
            );
        }
    }

    createLocalPlayer(data) {
        const game = this.game;
        if (game.playerShip) return;
        console.log('[Game] Creating Local Player Ship');
        game.playerShip = new this.ShipClass();

        if (data) {
            if (data.x !== undefined) game.x = data.x;
            if (data.y !== undefined) game.y = data.y;
        } else {
            game.x = 1000;
            game.y = 1000;
        }

        if (game.networkManager && game.networkManager.isConnected) {
            game.networkManager.sendJoinGame();
        }
    }

    startGame(seed, {
        enterStartRoom = true,
        roomCount = 15
    } = {}) {
        const game = this.game;
        console.log(`[Game] Starting with seed: ${seed}`);
        game.seed = seed;

        if (game.starfield) {
            game.starfield.setSeed(seed);
        }

        for (const room of game.rooms || []) {
            room.cancelPendingEvents?.();
        }
        game.rooms = game.levelGen.generate(roomCount, seed);
        game.currentRoom = game.levelGen.getRoom(0, 0);

        if (game.currentRoom && enterStartRoom) {
            game.currentRoom.onEnter(game);
        } else if (!game.currentRoom) {
            console.error('[Game] Failed to generate start room!');
        }

        game.running = true;
    }

    loadFromSave(save = null, { regenerateLevel = true } = {}) {
        const game = this.game;
        if (!game.playerShip) {
            console.warn('[Save] Cannot load save yet - waiting for server init...');
            game.showNotification('waiting for uplink...', '#ff0000');
            return false;
        }

        save = save || this.saveManager.load();
        if (!save) {
            console.warn('[Save] No save data found');
            return false;
        }

        if (regenerateLevel && save.levelSeed !== undefined) {
            game.floor = save.floor ?? 1;
            game.seed = save.levelSeed;
            game.rooms = game.levelGen.generate(
                roomCountForFloor(game.floor),
                save.levelSeed
            );
        }

        game.level = save.level;
        game.floor = save.floor ?? game.floor ?? 1;
        game.score = save.score ?? 0;
        game.isTainted = Boolean(save.isTainted);
        game.xp = save.xp;
        game.gold = save.gold;
        game.xpToNext = save.xpToNext;
        game.x = save.playerPosition.x;
        game.y = save.playerPosition.y;
        game.rotation = save.playerPosition.rotation;
        game.vx = save.playerPosition.vx ?? 0;
        game.vy = save.playerPosition.vy ?? 0;
        game.dashCooldown = save.playerPosition.dashCooldown ?? 0;
        game.dashActiveTimer = save.playerPosition.dashActiveTimer ?? 0;

        const stagedShip = this.stageSavedShip(save.playerShip);
        if (!stagedShip) {
            console.warn('[Save] Saved ship layout is invalid');
            return false;
        }
        game.playerShip.parts = stagedShip.parts;
        game.playerShip.permanentStats = {
            ...stagedShip.permanentStats
        };
        game.playerShip.stats = {
            ...stagedShip.stats
        };
        game.playerShip.maxHp = stagedShip.maxHp;
        game.playerShip.hp = Math.min(
            save.playerShip.hp,
            game.playerShip.maxHp
        );
        game.playerShip.isDead = false;

        game.hangar.inventory = { ...save.inventory };
        game.hangar.updateUI();

        if (save.roomSnapshots?.length > 0) {
            restoreRoomSnapshots(game, save.roomSnapshots);
        } else {
            for (const roomKey of save.visitedRooms) {
                const [gridX, gridY] = roomKey.split(',').map(Number);
                const room = game.levelGen.getRoom(gridX, gridY);
                if (room) {
                    room.visited = true;
                    room.cleared = true;
                    room.locked = false;
                }
            }
        }

        const currentRoom = game.levelGen.getRoom(
            save.currentRoomGrid.x,
            save.currentRoomGrid.y
        );
        if (currentRoom) {
            game.currentRoom = currentRoom;
        }
        restoreActiveWorld(game, save.activeWorld);
        this.restoreExitPortal(save);
        game.levelGen.random?.setState?.(save.randomState);

        const savedBiome = save.biome && Biomes[save.biome];
        if (savedBiome && game.floorProgression) {
            game.floorProgression.applyBiome(savedBiome, { notify: false });
        }

        game.showNotification('save loaded!', '#00ff00');
        console.log('[Save] Game restored from save');
        return true;
    }

    restoreExitPortal(save) {
        const game = this.game;
        let position = save.exitPortal;

        // Version-one saves already interpret every visited room as cleared.
        // Match that existing contract for old boss saves instead of restoring
        // a dead boss room with no way out.
        if (!position && save.migratedFrom === 1) {
            const visited = new Set(save.visitedRooms);
            const clearedBossRoom = (game.rooms || []).find(room =>
                room.type === RoomType.BOSS &&
                visited.has(`${room.gridX},${room.gridY}`)
            );
            if (clearedBossRoom) {
                position = {
                    x: clearedBossRoom.x + clearedBossRoom.width / 2,
                    y: clearedBossRoom.y + clearedBossRoom.height / 2
                };
            }
        }

        if (position) {
            game.portals = [
                new this.PortalClass(position.x, position.y)
            ];
        }
    }

    stageSavedShip(savedShip) {
        const staged = new this.ShipClass();
        staged.parts.clear();
        staged.permanentStats = normalizePermanentStats(
            savedShip.permanentStats
        );

        const coreIndex = savedShip.parts.findIndex(part =>
            part.partId === 'core' && part.x === 0 && part.y === 0
        );
        if (coreIndex < 0) return null;

        const pending = [...savedShip.parts];
        const [core] = pending.splice(coreIndex, 1);
        if (!this.addSavedPart(staged, core)) return null;

        // Save order is not construction order. Keep retrying connected parts
        // until the complete valid layout has been rebuilt.
        while (pending.length > 0) {
            let madeProgress = false;
            for (let index = pending.length - 1; index >= 0; index--) {
                if (!this.addSavedPart(staged, pending[index])) continue;
                pending.splice(index, 1);
                madeProgress = true;
            }
            if (!madeProgress) return null;
        }
        staged.recalculateStats();

        if (
            !savedShip.permanentStats &&
            savedShip.maxHp > staged.maxHp &&
            staged.maxHp > 0
        ) {
            staged.permanentStats.hpMul =
                savedShip.maxHp / staged.maxHp;
            staged.recalculateStats();
        }

        return staged;
    }

    addSavedPart(ship, partData) {
        const added = ship.addPart(
            partData.x,
            partData.y,
            partData.partId,
            partData.rotation
        );
        if (added === false) return false;

        const part = ship.parts.get(`${partData.x},${partData.y}`);
        if (!part) return false;
        for (const key of PART_RUNTIME_KEYS) {
            if (Object.hasOwn(partData.state || {}, key)) {
                part[key] = partData.state[key];
            }
        }
        return true;
    }
}

function roomCountForFloor(floor) {
    return floor > 1 ? 15 + floor * 2 : 15;
}
