import { Ship } from '../../shared/entities/Ship.js';
import {
    snapshotActiveWorld,
    snapshotRooms
} from './RoomSnapshotSystem.js';
import { recoverShip } from './PlayerRecoverySystem.js';
import { applyUpgradeToShip } from './LevelUpManager.js';
import { WeaponSystem } from './WeaponSystem.js';
import { applyRandomStarterLoadout } from '../../shared/combat/StarterLoadouts.js';
import { AbilitySystem } from './AbilitySystem.js';

export class HostGameSimulation {
    constructor(game, {
        ShipClass = Ship,
        WeaponSystemClass = WeaponSystem,
        random = () => game.levelGen?.random?.() ?? Math.random(),
        starterLoadout = null,
        maxPlayers = 4,
        AbilitySystemClass = AbilitySystem
    } = {}) {
        this.game = game;
        this.ShipClass = ShipClass;
        this.WeaponSystemClass = WeaponSystemClass;
        this.random = random;
        this.starterLoadout = starterLoadout || (
            ShipClass === Ship ? applyRandomStarterLoadout : null
        );
        this.maxPlayers = maxPlayers;
        this.abilitySystem = game.abilitySystem || new AbilitySystemClass(game);
        this.peers = new Map();
        this.nextPlayerId = 1;
        this.levelUpInProgress = false;
        this.levelUpChoiceFactory = null;
    }

    addPeer(_connectionId, profile) {
        if (this.peers.size >= this.maxPlayers - 1) return false;

        const playerId = `guest_${this.nextPlayerId++}`;
        const ship = new this.ShipClass();
        this.starterLoadout?.(ship, this.random);
        ship.x = this.game.x;
        ship.y = this.game.y;
        const runtime = this.createWeaponRuntime(ship, playerId);
        this.peers.set(playerId, {
            id: playerId,
            displayName: profile.displayName,
            ship,
            input: {},
            firing: false,
            aimAngle: 0,
            suspended: false,
            inventory: {},
            pendingLevelUpChoices: this.levelUpInProgress
                ? this.createPeerLevelUpChoices()
                : null,
            runtime
        });
        return { playerId };
    }

    suspendPeer(playerId) {
        const peer = this.peers.get(playerId);
        if (!peer) return false;
        peer.suspended = true;
        peer.firing = false;
        peer.pendingLevelUpChoices = null;
        this.finishLevelUpIfReady();
        return true;
    }

    resumePeer(playerId) {
        const peer = this.peers.get(playerId);
        if (!peer) return false;
        peer.suspended = false;
        return true;
    }

    removePeer(playerId) {
        const removed = this.peers.delete(playerId);
        if (removed) this.finishLevelUpIfReady();
        return removed;
    }

    resurrectDeadPlayers() {
        const resurrected = [];
        if (this.game.playerShip?.isDead) {
            this.resurrectShip(this.game.playerShip);
            this.game.vx = 0;
            this.game.vy = 0;
            resurrected.push('host');
        }

        for (const peer of this.peers.values()) {
            if (!peer.ship.isDead) continue;
            this.resurrectShip(peer.ship);
            peer.input = {};
            peer.firing = false;
            resurrected.push(peer.id);
        }
        return resurrected;
    }

    resurrectShip(ship) {
        ship.hp = ship.maxHp;
        ship.isDead = false;
        ship.vx = 0;
        ship.vy = 0;
    }

    applyInput(playerId, input) {
        const peer = this.peers.get(playerId);
        if (!peer || peer.suspended) return false;
        peer.input = input;
        return true;
    }

    requestAction(playerId, action, payload) {
        const peer = this.peers.get(playerId);
        if (!peer || peer.suspended) return false;

        if (action === 'shoot') {
            peer.firing = payload.active;
            peer.aimAngle = payload.aimAngle;
            return {
                type: 'fire_intent',
                payload: {
                    peerId: playerId,
                    active: peer.firing,
                    aimAngle: peer.aimAngle
                }
            };
        }

        if (action === 'interact') {
            const player = this.getPlayerContext(playerId);
            const accepted = this.game.worldInteractions?.interactForPlayer?.(
                player,
                payload.targetKind,
                payload.targetIndex
            );
            if (!accepted) return false;
            return {
                type: 'reward',
                payload: {
                    playerId,
                    targetKind: payload.targetKind,
                    targetIndex: payload.targetIndex
                }
            };
        }

        if (action === 'ship_edit') {
            if (!this.applyShipEdit(peer, payload.parts)) return false;
            return {
                type: 'ship_state',
                payload: { playerId }
            };
        }

        if (action === 'level_up') {
            return this.applyPeerLevelUp(peer, payload.index);
        }

        if (action === 'sweep') {
            const player = this.getPlayerContext(playerId);
            if (!this.game.salvageSweep?.triggerFor?.(player)) return false;
            return {
                type: 'room_state',
                payload: { salvageSweep: true }
            };
        }

        if (action === 'ability') {
            const outcome = this.abilitySystem.activateForPlayer(
                playerId,
                peer.ship,
                payload
            );
            if (!outcome) return false;
            return {
                type: 'room_state',
                payload: {
                    playerId,
                    abilityId: outcome.abilityId,
                    activeWorld: snapshotActiveWorld(this.game)
                }
            };
        }

        // Explicit transition claims stay rejected. The host derives room and
        // portal crossings from authoritative ship positions instead.
        return false;
    }

    step(dt) {
        for (const peer of this.peers.values()) {
            if (peer.suspended || peer.ship.isDead) continue;

            peer.ship.update(dt, peer.input, {
                movementMultiplier: this.game.currentRoom?.cleared
                    ? 2.0
                    : 1.0
            });
            this.constrainToActiveRoom(peer.ship);
            this.updatePeerWeapons(peer, dt);
        }
    }

    recoverPeers(dt, levelBonus) {
        const hasActiveEnemies = this.hasActiveEnemies();
        for (const peer of this.peers.values()) {
            if (peer.suspended) continue;
            recoverShip(peer.ship, dt, levelBonus, hasActiveEnemies);
        }
    }

    snapshotFor(playerId) {
        return {
            self: playerId,
            floor: this.game.floor,
            level: this.game.level,
            score: this.game.score,
            xp: this.game.xp,
            gold: this.game.gold,
            xpToNext: this.game.xpToNext,
            combatTelemetry: this.game.combatTelemetry?.snapshotFor?.(playerId) || [],
            salvageSweep: this.game.salvageSweep?.snapshot?.() || null,
            paused: Boolean(this.game.paused),
            levelUp: this.snapshotLevelUpFor(playerId),
            inventory: { ...this.inventoryFor(playerId) },
            currentRoom: this.game.currentRoom
                ? {
                    gridX: this.game.currentRoom.gridX,
                    gridY: this.game.currentRoom.gridY,
                    locked: Boolean(this.game.currentRoom.locked),
                    cleared: Boolean(this.game.currentRoom.cleared)
                }
                : null,
            players: this.snapshotPlayers(false),
            activeWorld: snapshotActiveWorld(this.game),
            portals: (this.game.portals || []).map(portal => ({
                x: portal.x,
                y: portal.y
            }))
        };
    }

    fullStateFor(playerId) {
        return {
            ...this.snapshotFor(playerId),
            seed: this.game.seed,
            levelSeed: this.game.levelGen?.seed ?? this.game.seed,
            roomSnapshots: snapshotRooms(this.game),
            players: this.snapshotPlayers(true)
        };
    }

    snapshotPlayers(includeParts) {
        const players = [];
        if (this.game.playerShip) {
            players.push(this.snapshotShip(
                'host',
                this.game.playerShip,
                this.game.x,
                this.game.y,
                this.game.rotation,
                includeParts
            ));
        }
        for (const peer of this.peers.values()) {
            players.push(this.snapshotShip(
                peer.id,
                peer.ship,
                peer.ship.x,
                peer.ship.y,
                peer.ship.rotation,
                includeParts,
                peer.suspended
            ));
        }
        return players;
    }

    snapshotShip(
        id,
        ship,
        x,
        y,
        rotation,
        includeParts,
        suspended = false
    ) {
        const state = {
            id,
            x,
            y,
            vx: ship.vx || 0,
            vy: ship.vy || 0,
            rotation,
            hp: ship.hp,
            maxHp: ship.maxHp,
            isDead: Boolean(ship.isDead),
            suspended,
            stealthTimer: Number.isFinite(ship.stealthTimer)
                ? Math.max(0, ship.stealthTimer)
                : 0,
            abilityCooldowns: this.abilitySystem.snapshotShipState(ship).cooldowns
        };
        state.permanentStats = { ...ship.permanentStats };
        if (includeParts) {
            state.parts = [...ship.getUniqueParts()].map(part => ({
                x: part.x,
                y: part.y,
                partId: part.partId,
                rotation: part.rotation || 0
            }));
        }
        return state;
    }

    createWeaponRuntime(ship, playerId = 'host') {
        const context = {
            playerShip: ship,
            x: ship.x,
            y: ship.y,
            rotation: ship.rotation,
            projectiles: this.game.projectiles,
            audio: this.game.audio,
            designer: { active: false },
            network: null,
            sourcePlayerId: playerId
        };
        Object.defineProperties(context, {
            enemies: {
                enumerable: true,
                get: () => this.game.enemies || []
            },
            bosses: {
                enumerable: true,
                get: () => this.game.bosses || []
            }
        });
        const weaponSystem = new this.WeaponSystemClass(context, {
            random: this.random
        });
        context.spawnProjectile = (...args) =>
            weaponSystem.spawnProjectile(...args);
        return { context, weaponSystem };
    }

    getPlayerContext(playerId) {
        if (playerId === 'host') {
            return {
                id: 'host',
                displayName: 'host',
                ship: this.game.playerShip,
                x: this.game.x,
                y: this.game.y,
                rotation: this.game.rotation,
                inventory: this.game.hangar?.inventory || {},
                suspended: false
            };
        }

        const peer = this.peers.get(playerId);
        if (!peer) return null;
        return {
            id: peer.id,
            displayName: peer.displayName,
            ship: peer.ship,
            x: peer.ship.x,
            y: peer.ship.y,
            rotation: peer.ship.rotation,
            inventory: peer.inventory,
            suspended: peer.suspended
        };
    }

    getPickupPlayers() {
        const players = [];
        const host = this.getPlayerContext('host');
        if (host?.ship && !host.ship.isDead) players.push(host);
        for (const peer of this.peers.values()) {
            const player = this.getPlayerContext(peer.id);
            if (
                player &&
                !player.suspended &&
                !player.ship.isDead
            ) {
                players.push(player);
            }
        }
        return players;
    }

    beginPeerLevelUps(createChoices) {
        if (typeof createChoices !== 'function') return false;
        this.levelUpInProgress = true;
        this.levelUpChoiceFactory = createChoices;
        for (const peer of this.peers.values()) {
            peer.pendingLevelUpChoices = peer.suspended
                ? null
                : this.createPeerLevelUpChoices(peer.ship);
        }
        return true;
    }

    createPeerLevelUpChoices(ship) {
        return this.levelUpChoiceFactory?.(ship).map(copyUpgradeChoice) || null;
    }

    applyPeerLevelUp(peer, index) {
        if (
            !this.levelUpInProgress ||
            !Array.isArray(peer.pendingLevelUpChoices) ||
            !Number.isInteger(index) ||
            index < 0 ||
            index >= peer.pendingLevelUpChoices.length
        ) {
            return false;
        }
        const choice = peer.pendingLevelUpChoices[index];
        if (!applyUpgradeToShip(peer.ship, choice)) return false;
        peer.pendingLevelUpChoices = null;
        this.finishLevelUpIfReady();
        return {
            type: 'reward',
            payload: {
                playerId: peer.id,
                rewardKind: 'level_up'
            }
        };
    }

    completeHostLevelUp() {
        return this.finishLevelUpIfReady();
    }

    finishLevelUpIfReady() {
        if (!this.levelUpInProgress) return true;
        const hostReady = Boolean(
            this.game.levelUpManager?.selectionPending
        );
        const peerPending = [...this.peers.values()].some(peer =>
            !peer.suspended &&
            Array.isArray(peer.pendingLevelUpChoices)
        );
        if (!hostReady || peerPending) {
            this.game.paused = true;
            return false;
        }

        this.levelUpInProgress = false;
        this.levelUpChoiceFactory = null;
        this.game.levelUpManager?.completeSharedLevelUp?.();
        this.game.paused = false;
        return true;
    }

    snapshotLevelUpFor(playerId) {
        if (!this.levelUpInProgress) return null;
        const peer = this.peers.get(playerId);
        const choices = peer?.pendingLevelUpChoices || [];
        return {
            choices: choices.map(copyUpgradeChoice)
        };
    }

    inventoryFor(playerId) {
        return this.getPlayerContext(playerId)?.inventory || {};
    }

    hasActiveEnemies() {
        return this.game.enemies.length > 0 ||
            this.game.bosses.some(boss => !boss.isDead);
    }

    applyShipEdit(peer, parts) {
        if (!peer || !Array.isArray(parts)) return false;
        const available = countParts([
            ...peer.ship.getUniqueParts(),
            ...expandInventory(peer.inventory)
        ]);
        const requested = countParts(parts);
        if (
            requested.get('core') !== 1 ||
            [...requested].some(([partId, count]) =>
                count > (available.get(partId) || 0)
            )
        ) {
            return false;
        }

        const staged = this.game.session?.stageSavedShip?.({
            hp: peer.ship.hp,
            maxHp: peer.ship.maxHp,
            permanentStats: { ...peer.ship.permanentStats },
            parts
        });
        if (!staged) return false;

        const inventory = {};
        for (const [partId, count] of available) {
            const remaining = count - (requested.get(partId) || 0);
            if (remaining > 0) inventory[partId] = remaining;
        }
        staged.x = peer.ship.x;
        staged.y = peer.ship.y;
        staged.vx = peer.ship.vx;
        staged.vy = peer.ship.vy;
        staged.rotation = peer.ship.rotation;
        staged.hp = Math.min(peer.ship.hp, staged.maxHp);
        staged.isDead = peer.ship.isDead;
        peer.ship = staged;
        peer.inventory = inventory;
        peer.runtime = this.createWeaponRuntime(staged, peer.id);
        return true;
    }

    updatePeerWeapons(peer, dt) {
        const { context, weaponSystem } = peer.runtime;
        context.x = peer.ship.x;
        context.y = peer.ship.y;
        context.rotation = peer.ship.rotation;
        context.projectiles = this.game.projectiles;
        const targetDistance = 2000;
        weaponSystem.update(dt, {
            isMouseDown: peer.firing,
            worldMouseX:
                peer.ship.x + Math.cos(peer.aimAngle) * targetDistance,
            worldMouseY:
                peer.ship.y + Math.sin(peer.aimAngle) * targetDistance,
            levelBonus: 1 + (this.game.level - 1) * 0.01
        });
    }

    constrainToActiveRoom(ship) {
        const room = this.game.currentRoom;
        if (!room) return;
        const margin = 30;
        if (room.locked) {
            this.clampShipAxis(
                ship,
                'x',
                room.x + margin,
                room.x + room.width - margin,
                'vx'
            );
            this.clampShipAxis(
                ship,
                'y',
                room.y + margin,
                room.y + room.height - margin,
                'vy'
            );
            return;
        }

        if (
            ship.x < room.x + margin &&
            !this.game.levelGen.getRoomAtWorldPos?.(room.x - 10, ship.y)
        ) {
            ship.x = room.x + margin;
            ship.vx = 0;
        } else if (
            ship.x > room.x + room.width - margin &&
            !this.game.levelGen.getRoomAtWorldPos?.(
                room.x + room.width + 10,
                ship.y
            )
        ) {
            ship.x = room.x + room.width - margin;
            ship.vx = 0;
        }

        if (
            ship.y < room.y + margin &&
            !this.game.levelGen.getRoomAtWorldPos?.(ship.x, room.y - 10)
        ) {
            ship.y = room.y + margin;
            ship.vy = 0;
        } else if (
            ship.y > room.y + room.height - margin &&
            !this.game.levelGen.getRoomAtWorldPos?.(
                ship.x,
                room.y + room.height + 10
            )
        ) {
            ship.y = room.y + room.height - margin;
            ship.vy = 0;
        }
    }

    clampShipAxis(ship, axis, minimum, maximum, velocityAxis) {
        if (ship[axis] < minimum) {
            ship[axis] = minimum;
            ship[velocityAxis] = 0;
        } else if (ship[axis] > maximum) {
            ship[axis] = maximum;
            ship[velocityAxis] = 0;
        }
    }
}

function copyUpgradeChoice(choice) {
    return {
        rarity: {
            id: choice.rarity.id,
            name: choice.rarity.name,
            color: choice.rarity.color
        },
        name: choice.name,
        value: choice.value,
        stat: choice.stat,
        mode: choice.mode,
        desc: choice.desc
    };
}

function countParts(parts) {
    const counts = new Map();
    for (const part of parts) {
        counts.set(part.partId, (counts.get(part.partId) || 0) + 1);
    }
    return counts;
}

function expandInventory(inventory) {
    const parts = [];
    for (const [partId, count] of Object.entries(inventory || {})) {
        for (let index = 0; index < count; index++) {
            parts.push({ partId });
        }
    }
    return parts;
}
