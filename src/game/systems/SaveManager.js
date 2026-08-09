import { Biomes } from '../environment/Biomes.js';
import {
    isValidSnapshotData,
    snapshotActiveWorld,
    snapshotRooms
} from './RoomSnapshotSystem.js';
import {
    isValidPermanentStats,
    normalizePermanentStats
} from '../../shared/combat/WeaponFamilies.js';

const SAVE_KEY = 'framebound_save';
const SAVE_VERSION = 2;
const LEGACY_SAVE_VERSION = 1;
const MAX_SAVED_PARTS = 512;
const MAX_VISITED_ROOMS = 512;
const MAX_GRID_COORDINATE = 512;
const MAX_SAVE_BYTES = 8 * 1024 * 1024;
const ACTIVE_ABILITY_IDS = ['blink', 'decoy', 'stealth', 'emp'];
const PART_RUNTIME_KEYS = [
    'cooldown',
    'recoil',
    'rampLevel',
    'peakMeter',
    'chargeLeft',
    'chargeReady',
    'burstLeft',
    'burstTimer',
    'shieldCooldown',
    'abilityCooldown'
];

export class SaveManager {
    static desktopInvoke = null;

    static getDesktopInvoke() {
        return SaveManager.desktopInvoke ??
            globalThis.__TAURI__?.core?.invoke ??
            null;
    }

    static async hydrateDesktopBackup() {
        const invoke = SaveManager.getDesktopInvoke();
        if (!invoke) return false;

        try {
            const loaded = await invoke('load_run_save');
            const nativeCandidates = (
                Array.isArray(loaded) ? loaded : [loaded]
            ).filter(raw => typeof raw === 'string');
            const nativeSelection = nativeCandidates
                .map((raw, index) => ({
                    index,
                    raw,
                    save: SaveManager.parseStoredSave(raw)
                }))
                .find(candidate => candidate.save);
            const nativeRaw = nativeSelection?.raw ?? null;
            const localRaw = localStorage.getItem(SAVE_KEY);
            const native = nativeSelection?.save ?? null;
            const local = SaveManager.parseStoredSave(localRaw);

            if (!native) {
                if (nativeCandidates.length > 0) {
                    await invoke('clear_run_save');
                }
                if (local && localRaw) {
                    await invoke('write_run_save', { raw: localRaw });
                }
                return Boolean(local);
            }

            if (nativeSelection.index > 0) {
                await invoke('write_run_save', { raw: nativeRaw });
            }

            if (
                !local ||
                (native.timestamp ?? 0) > (local.timestamp ?? 0)
            ) {
                localStorage.setItem(SAVE_KEY, nativeRaw);
            } else if (localRaw) {
                await invoke('write_run_save', { raw: localRaw });
            }
            return true;
        } catch (error) {
            console.error('[Save] Failed to hydrate native backup:', error);
            return false;
        }
    }

    static parseStoredSave(raw) {
        if (
            typeof raw !== 'string' ||
            raw.length === 0 ||
            raw.length > MAX_SAVE_BYTES
        ) {
            return null;
        }
        try {
            return SaveManager.normalizeSave(JSON.parse(raw));
        } catch {
            return null;
        }
    }

    static mirrorDesktop(command, args) {
        const invoke = SaveManager.getDesktopInvoke();
        if (!invoke) return false;
        Promise.resolve(invoke(command, args)).catch(error => {
            console.error('[Save] Native backup failed:', error);
        });
        return true;
    }

    static save(game) {
        try {
            // Serialize player ship parts
            const shipParts = [];
            for (const part of game.playerShip.getUniqueParts()) {
                shipParts.push({
                    x: part.x,
                    y: part.y,
                    partId: part.partId,
                    rotation: part.rotation || 0,
                    state: Object.fromEntries(
                        PART_RUNTIME_KEYS.flatMap(key => {
                            const value = part[key];
                            if (Number.isFinite(value)) {
                                return [[key, Math.max(0, value)]];
                            }
                            return typeof value === 'boolean'
                                ? [[key, value]]
                                : [];
                        })
                    )
                });
            }

            // Collect visited rooms
            const visitedRooms = [];
            for (const room of game.rooms) {
                if (room.visited) {
                    visitedRooms.push(`${room.gridX},${room.gridY}`);
                }
            }

            const saveData = {
                version: SAVE_VERSION,
                level: game.level,
                floor: game.floor,
                score: game.score,
                levelSeed: game.levelGen.seed, // Store the seed for deterministic regeneration
                randomState: game.levelGen.random?.getState?.(),
                isTainted: game.isTainted || false,
                biome: SaveManager.getBiomeId(game.currentBiome),
                xp: game.xp,
                gold: game.gold,
                xpToNext: game.xpToNext,
                playerPosition: {
                    x: game.x,
                    y: game.y,
                    rotation: game.rotation,
                    vx: game.vx,
                    vy: game.vy,
                    dashCooldown: Number.isFinite(game.dashCooldown)
                        ? Math.max(0, game.dashCooldown)
                        : 0,
                    dashActiveTimer: Number.isFinite(game.dashActiveTimer)
                        ? Math.max(0, game.dashActiveTimer)
                        : 0
                },
                playerShip: {
                    hp: game.playerShip.hp,
                    maxHp: game.playerShip.maxHp,
                    permanentStats: {
                        ...game.playerShip.permanentStats
                    },
                    parts: shipParts
                },
                playerAbilityState: game.abilitySystem?.snapshotShipState?.(
                    game.playerShip
                ) || {
                    cooldowns: {},
                    stealthTimer: 0
                },
                inventory: { ...game.hangar.inventory },
                currentRoomGrid: {
                    x: game.currentRoom.gridX,
                    y: game.currentRoom.gridY
                },
                visitedRooms: visitedRooms,
                roomSnapshots: snapshotRooms(game),
                activeWorld: snapshotActiveWorld(game),
                exitPortal: game.portals?.length > 0
                    ? {
                        x: game.portals[0].x,
                        y: game.portals[0].y
                    }
                    : null,
                timestamp: Date.now()
            };

            const raw = JSON.stringify(saveData);
            localStorage.setItem(SAVE_KEY, raw);
            SaveManager.mirrorDesktop('write_run_save', { raw });
            console.log('[Save] Game saved successfully');
            return true;
        } catch (e) {
            console.error('[Save] Failed to save game:', e);
            return false;
        }
    }

    static load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;

            const data = JSON.parse(raw);

            const normalized = SaveManager.normalizeSave(data);
            if (!normalized) {
                console.warn('[Save] Save version mismatch, clearing save');
                SaveManager.clearSave();
                return null;
            }

            // check for dead player
            if (normalized.playerShip && normalized.playerShip.hp <= 0) {
                console.warn('[Save] Player is dead in save file (Exploit Prevention). Clearing.');
                SaveManager.clearSave();
                return null;
            }

            console.log('[Save] Save loaded successfully');
            if (normalized.isTainted) {
                console.log('[Save] This run is tainted (DevTools used).');
            }
            return normalized;
        } catch (e) {
            console.error('[Save] Failed to load save:', e);
            try {
                SaveManager.clearSave();
            } catch (clearError) {
                console.error('[Save] Failed to clear invalid save:', clearError);
            }
            return null;
        }
    }

    static hasSave() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return false;

            const data = SaveManager.normalizeSave(JSON.parse(raw));
            return Boolean(data && data.playerShip.hp > 0);
        } catch (error) {
            console.error('[Save] Failed to inspect save:', error);
            return false;
        }
    }

    static clearSave() {
        SaveManager.mirrorDesktop('clear_run_save');
        try {
            localStorage.removeItem(SAVE_KEY);
            console.log('[Save] Save cleared');
            return true;
        } catch (error) {
            console.error('[Save] Failed to clear save:', error);
            return false;
        }
    }

    static isValidSave(data) {
        const finite = value => Number.isFinite(value);
        const nonNegative = value => finite(value) && value >= 0;
        const positive = value => finite(value) && value > 0;
        const integer = value => Number.isInteger(value);
        const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
        const inGridRange = value =>
            integer(value) && Math.abs(value) <= MAX_GRID_COORDINATE;
        const validPartId = partId =>
            typeof partId === 'string' &&
            /^[a-zA-Z0-9_-]{1,80}$/.test(partId);
        const validPart = part =>
            object(part) &&
            inGridRange(part.x) &&
            inGridRange(part.y) &&
            validPartId(part.partId) &&
            integer(part.rotation) &&
            (
                part.state === undefined ||
                (
                    object(part.state) &&
                    Object.entries(part.state).every(([key, value]) =>
                        PART_RUNTIME_KEYS.includes(key) &&
                        (
                            (finite(value) && value >= 0) ||
                            typeof value === 'boolean'
                        )
                    )
                )
            );
        const validParts = parts => {
            if (
                !Array.isArray(parts) ||
                parts.length === 0 ||
                parts.length > MAX_SAVED_PARTS ||
                !parts.every(validPart)
            ) {
                return false;
            }

            const origins = new Set(
                parts.map(part => `${part.x},${part.y}`)
            );
            const cores = parts.filter(part =>
                part.x === 0 &&
                part.y === 0 &&
                part.partId === 'core'
            );
            return origins.size === parts.length && cores.length === 1;
        };
        const validInventory = inventory =>
            object(inventory) &&
            Object.entries(inventory).every(([partId, count]) =>
                validPartId(partId) &&
                integer(count) &&
                count >= 0
            );
        const validVisitedRoom = roomKey =>
            typeof roomKey === 'string' &&
            /^-?\d+,-?\d+$/.test(roomKey) &&
            roomKey.split(',').every(value =>
                Math.abs(Number(value)) <= MAX_GRID_COORDINATE
            );
        const validPermanentStats = stats =>
            stats === undefined || isValidPermanentStats(stats, {
                allowLegacy: true
            });
        const validBiome = biome =>
            biome === undefined ||
            (typeof biome === 'string' &&
                Object.prototype.hasOwnProperty.call(Biomes, biome));
        const validExitPortal = portal =>
            portal === undefined ||
            portal === null ||
            (object(portal) && finite(portal.x) && finite(portal.y));
        const validAbilityState = state => {
            if (state === undefined) return true;
            if (!object(state) || !object(state.cooldowns)) return false;
            if (!finite(state.stealthTimer) || state.stealthTimer < 0) return false;
            return Object.entries(state.cooldowns).every(([id, value]) =>
                ACTIVE_ABILITY_IDS.includes(id) && finite(value) && value >= 0
            );
        };

        const validBase = object(data) &&
            (data.version === LEGACY_SAVE_VERSION ||
                data.version === SAVE_VERSION) &&
            integer(data.level) &&
            data.level >= 1 &&
            integer(data.levelSeed) &&
            (data.randomState === undefined || finite(data.randomState)) &&
            nonNegative(data.xp) &&
            nonNegative(data.gold) &&
            positive(data.xpToNext) &&
            (data.floor === undefined ||
                (integer(data.floor) && data.floor >= 1)) &&
            (data.score === undefined || nonNegative(data.score)) &&
            (data.isTainted === undefined ||
                typeof data.isTainted === 'boolean') &&
            validBiome(data.biome) &&
            object(data.playerPosition) &&
            finite(data.playerPosition.x) &&
            finite(data.playerPosition.y) &&
            finite(data.playerPosition.rotation) &&
            (data.playerPosition.vx === undefined ||
                finite(data.playerPosition.vx)) &&
            (data.playerPosition.vy === undefined ||
                finite(data.playerPosition.vy)) &&
            (data.playerPosition.dashCooldown === undefined ||
                nonNegative(data.playerPosition.dashCooldown)) &&
            (data.playerPosition.dashActiveTimer === undefined ||
                nonNegative(data.playerPosition.dashActiveTimer)) &&
            object(data.playerShip) &&
            positive(data.playerShip.hp) &&
            positive(data.playerShip.maxHp) &&
            data.playerShip.hp <= data.playerShip.maxHp &&
            validPermanentStats(data.playerShip.permanentStats) &&
            validParts(data.playerShip.parts) &&
            validAbilityState(data.playerAbilityState) &&
            validInventory(data.inventory) &&
            object(data.currentRoomGrid) &&
            inGridRange(data.currentRoomGrid.x) &&
            inGridRange(data.currentRoomGrid.y) &&
            Array.isArray(data.visitedRooms) &&
            data.visitedRooms.length <= MAX_VISITED_ROOMS &&
            data.visitedRooms.every(validVisitedRoom) &&
            validExitPortal(data.exitPortal) &&
            (data.timestamp === undefined || finite(data.timestamp));

        if (!validBase) return false;
        if (data.version === LEGACY_SAVE_VERSION) return true;
        return isValidSnapshotData(
            data.roomSnapshots,
            data.activeWorld
        );
    }

    static normalizeSave(data) {
        if (!SaveManager.isValidSave(data)) return null;
        const normalizedStats = normalizePermanentStats(
            data.playerShip.permanentStats
        );
        if (data.version === SAVE_VERSION) {
            return {
                ...data,
                playerShip: {
                    ...data.playerShip,
                    permanentStats: normalizedStats
                }
            };
        }

        return {
            ...data,
            version: SAVE_VERSION,
            migratedFrom: LEGACY_SAVE_VERSION,
            playerShip: {
                ...data.playerShip,
                permanentStats: normalizedStats
            },
            roomSnapshots: [],
                activeWorld: {
                    enemies: [],
                    bosses: [],
                    projectiles: [],
                    drones: [],
                    decoys: [],
                xpOrbs: [],
                goldOrbs: [],
                hpOrbs: [],
                itemPickups: []
            }
        };
    }

    static getBiomeId(biome) {
        const match = Object.entries(Biomes).find(([, value]) => value === biome);
        return match?.[0] || 'DEFAULT';
    }
}
