import { RemotePlayer } from '../../engine/RemotePlayer.js';
import { Portal } from '../../shared/entities/Portal.js';
import {
    isValidSnapshotData,
    restoreActiveWorld,
    restoreRoomSnapshots
} from './RoomSnapshotSystem.js';
import {
    isValidPermanentStats,
    normalizePermanentStats
} from '../../shared/combat/WeaponFamilies.js';

export class PeerWorldReplicator {
    constructor(game, {
        RemotePlayerClass = RemotePlayer,
        PortalClass = Portal,
        restoreActive = restoreActiveWorld,
        restoreRooms = restoreRoomSnapshots
    } = {}) {
        this.game = game;
        this.RemotePlayerClass = RemotePlayerClass;
        this.PortalClass = PortalClass;
        this.restoreActive = restoreActive;
        this.restoreRooms = restoreRooms;
        this.selfId = null;
        this.remotePlayers = new Map();
        this.lastTick = 0;
    }

    applyFullState(state, tick = 0) {
        if (!validFullState(state)) return false;
        const game = this.game;
        const self = state.players.find(player => player.id === state.self);
        if (!self?.parts) return false;
        const staged = game.session.stageSavedShip({
            hp: self.hp,
            maxHp: self.maxHp,
            permanentStats: self.permanentStats,
            parts: self.parts
        });
        if (!staged) return false;

        game.session.resetRunState();
        game.floor = state.floor;
        game.session.createLocalPlayer();
        game.session.startGame(state.levelSeed, {
            enterStartRoom: false,
            roomCount: roomCountForFloor(state.floor)
        });

        game.level = state.level;
        game.score = state.score;
        game.xp = state.xp;
        game.gold = state.gold;
        game.xpToNext = state.xpToNext;
        this.applyInventory(state.inventory, true);
        this.applySharedPause(state);
        this.restoreRooms(game, state.roomSnapshots);
        this.selectCurrentRoom(state.currentRoom);
        this.restoreActive(game, state.activeWorld);
        this.restorePortals(state.portals);

        game.playerShip.parts = staged.parts;
        game.playerShip.stats = { ...staged.stats };
        game.playerShip.permanentStats = normalizePermanentStats(
            staged.permanentStats
        );
        game.playerShip.maxHp = staged.maxHp;
        game.playerShip.hp = Math.min(self.hp, staged.maxHp);
        game.playerShip.isDead = self.isDead;

        this.selfId = state.self;
        game.combatTelemetry?.replaceFor?.(
            state.self,
            state.combatTelemetry || []
        );
        game.salvageSweep?.applyRemoteState?.(state.salvageSweep);
        this.applyPlayerState(self, true);
        this.reconcileRemotePlayers(state.players, true);
        this.lastTick = tick;
        game.running = true;
        return true;
    }

    applySnapshot(state, tick = 0) {
        if (
            tick < this.lastTick ||
            !validSnapshotState(state) ||
            state.self !== this.selfId
        ) {
            return false;
        }
        const self = state.players.find(player => player.id === this.selfId);
        if (!self) return false;

        this.selectCurrentRoom(state.currentRoom);
        this.restoreActive(this.game, state.activeWorld);
        this.restorePortals(state.portals);
        this.applyPlayerState(self, false);
        this.reconcileRemotePlayers(state.players, false);
        this.game.floor = state.floor;
        this.game.level = state.level;
        this.game.score = state.score;
        this.game.xp = state.xp;
        this.game.gold = state.gold;
        this.game.xpToNext = state.xpToNext;
        this.game.combatTelemetry?.replaceFor?.(
            this.selfId,
            state.combatTelemetry || []
        );
        this.game.salvageSweep?.applyRemoteState?.(state.salvageSweep);
        this.applyInventory(state.inventory, false);
        this.applySharedPause(state);
        this.lastTick = tick;
        return true;
    }

    selectCurrentRoom(roomState) {
        if (!roomState) return;
        const room = this.game.levelGen.getRoom(
            roomState.gridX,
            roomState.gridY
        );
        if (!room) return;
        room.locked = roomState.locked;
        room.cleared = roomState.cleared;
        this.game.currentRoom = room;
    }

    restorePortals(portals) {
        this.game.portals = portals.map(portal =>
            new this.PortalClass(portal.x, portal.y)
        );
    }

    applyPlayerState(player, force) {
        const game = this.game;
        const distance = Math.hypot(game.x - player.x, game.y - player.y);
        if (force || distance > 100) {
            game.x = player.x;
            game.y = player.y;
            game.vx = player.vx;
            game.vy = player.vy;
            game.rotation = player.rotation;
        }
        if (!samePermanentStats(
            game.playerShip.permanentStats,
            player.permanentStats
        )) {
            game.playerShip.permanentStats = normalizePermanentStats(
                player.permanentStats
            );
            game.playerShip.recalculateStats?.();
        }
        game.playerShip.hp = Math.min(player.hp, game.playerShip.maxHp);
        game.playerShip.isDead = player.isDead;
        game.playerShip.combatSilenceTimer = Number.isFinite(player.combatSilenceTimer)
            ? player.combatSilenceTimer
            : 0;
        game.playerShip.ambushReady = player.ambushReady === true;
    }

    applySharedPause(state) {
        const game = this.game;
        game.levelUpManager?.applyRemoteLevelUp?.(state.levelUp);
        if (state.levelUp) {
            game.paused = state.paused;
            game.pauseMenu?.hide?.();
            return;
        }
        game.pauseMenu?.applyRemotePaused?.(state.paused);
    }

    reconcileRemotePlayers(players, includeParts) {
        const activeIds = new Set();
        for (const player of players) {
            if (player.id === this.selfId) continue;
            activeIds.add(player.id);
            let remote = this.remotePlayers.get(player.id);
            if (!remote) {
                remote = new this.RemotePlayerClass(player.id);
                this.remotePlayers.set(player.id, remote);
            }
            if (includeParts && player.parts) {
                remote.setShipData(player.parts);
            }
            remote.isDead = player.isDead;
            remote.suspended = player.suspended;
            remote.addSnapshot?.(player);
        }
        for (const id of this.remotePlayers.keys()) {
            if (!activeIds.has(id)) this.remotePlayers.delete(id);
        }
    }

    applyInventory(inventory, force) {
        const current = this.game.hangar.inventory;
        if (!force && sameInventory(current, inventory)) return;
        this.game.hangar.inventory = { ...inventory };
        this.game.hangar.updateUI?.();
    }
}

function validFullState(state) {
    return validSnapshotState(state) &&
        Number.isInteger(state.seed) &&
        Number.isInteger(state.levelSeed) &&
        Number.isFinite(state.score) &&
        Number.isFinite(state.xp) &&
        Number.isFinite(state.gold) &&
        Number.isFinite(state.xpToNext) &&
        typeof state.paused === 'boolean' &&
        validCombatTelemetry(state.combatTelemetry) &&
        validSalvageSweep(state.salvageSweep) &&
        validLevelUp(state.levelUp) &&
        validInventory(state.inventory) &&
        isValidSnapshotData(state.roomSnapshots, state.activeWorld) &&
        state.players.every(player =>
            Array.isArray(player.parts) &&
            player.parts.length > 0 &&
            player.parts.length <= 1024 &&
            player.parts.every(part =>
                Number.isInteger(part.x) &&
                Number.isInteger(part.y) &&
                typeof part.partId === 'string' &&
                Number.isInteger(part.rotation)
            )
        );
}

function validCombatTelemetry(entries) {
    return entries === undefined || (
        Array.isArray(entries) &&
        entries.length <= 256 &&
        entries.every(entry =>
            entry !== null &&
            typeof entry === 'object' &&
            ['key', 'partId', 'label', 'family'].every(key =>
                typeof entry[key] === 'string' &&
                entry[key].length > 0 &&
                entry[key].length <= 128
            ) &&
            Number.isFinite(entry.damage) &&
            entry.damage >= 0
        )
    );
}

function validSalvageSweep(state) {
    return state === undefined || state === null || (
        typeof state === 'object' &&
        ['idle', 'charging', 'ready', 'sweeping'].includes(state.status) &&
        (state.roomKey === null || typeof state.roomKey === 'string') &&
        Number.isFinite(state.originX) &&
        Number.isFinite(state.originY) &&
        Number.isFinite(state.elapsed) &&
        state.elapsed >= 0 &&
        (state.chargeRemaining === null || (
            Number.isFinite(state.chargeRemaining) &&
            state.chargeRemaining >= 0
        ))
    );
}

function validSnapshotState(state) {
    return state !== null &&
        typeof state === 'object' &&
        typeof state.self === 'string' &&
        Number.isInteger(state.floor) &&
        state.floor >= 1 &&
        Number.isInteger(state.level) &&
        state.level >= 1 &&
        Number.isFinite(state.score) &&
        Number.isFinite(state.xp) &&
        Number.isFinite(state.gold) &&
        Number.isFinite(state.xpToNext) &&
        typeof state.paused === 'boolean' &&
        validCombatTelemetry(state.combatTelemetry) &&
        validSalvageSweep(state.salvageSweep) &&
        validInventory(state.inventory) &&
        Array.isArray(state.players) &&
        state.players.length > 0 &&
        state.players.length <= 4 &&
        state.players.every(validPlayer) &&
        Array.isArray(state.portals) &&
        state.portals.every(portal =>
            Number.isFinite(portal.x) &&
            Number.isFinite(portal.y)
        ) &&
        validCurrentRoom(state.currentRoom) &&
        isValidSnapshotData([], state.activeWorld);
}

function validPlayer(player) {
    return player !== null &&
        typeof player === 'object' &&
        typeof player.id === 'string' &&
        [
            'x', 'y', 'vx', 'vy', 'rotation', 'hp', 'maxHp'
        ].every(key => Number.isFinite(player[key])) &&
        player.hp >= 0 &&
        player.maxHp > 0 &&
        player.hp <= player.maxHp &&
        (player.combatSilenceTimer === undefined || (
            Number.isFinite(player.combatSilenceTimer) &&
            player.combatSilenceTimer >= 0
        )) &&
        (player.ambushReady === undefined || typeof player.ambushReady === 'boolean') &&
        isValidPermanentStats(player.permanentStats, { allowLegacy: true }) &&
        typeof player.isDead === 'boolean' &&
        typeof player.suspended === 'boolean';
}

function validLevelUp(levelUp) {
    return levelUp === null || (
        levelUp !== null &&
        typeof levelUp === 'object' &&
        !Array.isArray(levelUp) &&
        Array.isArray(levelUp.choices) &&
        [0, 3].includes(levelUp.choices.length) &&
        levelUp.choices.every(validUpgradeChoice)
    );
}

function validUpgradeChoice(choice) {
    return choice !== null &&
        typeof choice === 'object' &&
        !Array.isArray(choice) &&
        choice.rarity !== null &&
        typeof choice.rarity === 'object' &&
        ['id', 'name', 'color'].every(key =>
            typeof choice.rarity[key] === 'string' &&
            choice.rarity[key].length > 0 &&
            choice.rarity[key].length <= 64
        ) &&
        typeof choice.name === 'string' &&
        choice.name.length > 0 &&
        choice.name.length <= 100 &&
        Number.isFinite(choice.value) &&
        choice.value >= 0 &&
        choice.value <= 1000 &&
        (
            [
            'maxHp',
            'regen',
            'mobility',
            'velocityRateAdd',
            'velocityDamageMul',
            'velocityPierce',
            'laserRateAdd',
            'laserDamageMul',
            'laserChain',
            'rocketRateAdd',
            'rocketDamageMul',
            'droneRateAdd',
            'droneDamageMul',
            'droneCapacityAdd',
            'missileSpeedMul',
            'rocketBlastMul'
            ].includes(choice.stat) || /^doctrine_(interceptor|hive|bastion|siege|reaver|phantom|disruptor|demolition|gunship|warden)_stacks$/.test(choice.stat)
        ) &&
        ['add', 'multiply', 'integer', 'doctrine'].includes(choice.mode) &&
        typeof choice.desc === 'string' &&
        choice.desc.length > 0 &&
        choice.desc.length <= 200;
}

function validCurrentRoom(room) {
    return room === null || (
        room !== null &&
        typeof room === 'object' &&
        Number.isInteger(room.gridX) &&
        Number.isInteger(room.gridY) &&
        typeof room.locked === 'boolean' &&
        typeof room.cleared === 'boolean'
    );
}

function roomCountForFloor(floor) {
    return floor > 1 ? 15 + floor * 2 : 15;
}

function validInventory(inventory) {
    return inventory !== null &&
        typeof inventory === 'object' &&
        !Array.isArray(inventory) &&
        Object.entries(inventory).length <= 256 &&
        Object.entries(inventory).every(([partId, count]) =>
            typeof partId === 'string' &&
            partId.length > 0 &&
            partId.length <= 128 &&
            Number.isInteger(count) &&
            count >= 0 &&
            count <= 9999
        );
}

function sameInventory(first, second) {
    const firstEntries = Object.entries(first || {});
    const secondEntries = Object.entries(second || {});
    if (firstEntries.length !== secondEntries.length) return false;
    return firstEntries.every(([partId, count]) =>
        second[partId] === count
    );
}

function samePermanentStats(first, second) {
    const firstEntries = Object.entries(first || {});
    const secondEntries = Object.entries(second || {});
    if (firstEntries.length !== secondEntries.length) return false;
    return firstEntries.every(([key, value]) => second[key] === value);
}
