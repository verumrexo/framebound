import { PartsLibrary } from '../../shared/parts/Part.js';
import { Asteroid } from '../../shared/entities/Asteroid.js';
import { Boss } from '../../shared/entities/Boss.js';
import { Drone } from '../../shared/entities/Drone.js';
import { Enemy } from '../../shared/entities/Enemy.js';
import { GoldOrb } from '../../shared/entities/GoldOrb.js';
import { HPOrb } from '../../shared/entities/HPOrb.js';
import { ItemPickup } from '../../shared/entities/ItemPickup.js';
import { LootCrate } from '../../shared/entities/LootCrate.js';
import { Projectile } from '../../shared/entities/Projectile.js';
import { ShopItem } from '../../shared/entities/ShopItem.js';
import { Shipwreck } from '../../shared/entities/Shipwreck.js';
import { TreasureChest } from '../../shared/entities/TreasureChest.js';
import { VaultChest } from '../../shared/entities/VaultChest.js';
import { XPOrb } from '../../shared/entities/XPOrb.js';
import { Decoy } from '../../shared/entities/Decoy.js';
import {
    createVaultState,
    isVaultContractId,
    isVaultPhase,
    VaultPhase
} from '../../shared/vault/VaultDefinitions.js';
import { isProjectileLook, isProjectileTrail } from '../../shared/combat/ProjectileVisuals.js';

const MAX_ROOMS = 512;
const MAX_ENTITIES = 1024;
const deterministicRandom = () => 0.5;

const ENEMY_STATE_KEYS = [
    'x', 'y', 'rotation', 'rotationOffset', 'isDead', 'spotted',
    'freezeMeter', 'frozenTimer', 'lastFreezeTick', 'isWarpingIn',
    'warpTimer', 'maxHp', 'hp', 'radius', 'speed', 'turnRate',
    'engagementDist', 'detectionDist', 'damageMultiplier',
    'shootRate', 'shootCooldown', 'aimAngle', 'coopTargetId',
    'circleAngle', 'circleDirection', 'supportCooldown',
    'supportPulseTimer', 'supportTargetX', 'supportTargetY',
    'empTimer', 'hackTimer', 'hackedByPlayerId'
];
const PROJECTILE_STATE_KEYS = [
    'x', 'y', 'vx', 'vy', 'angle', 'type', 'owner', 'damage',
    'life', 'maxLife', 'radius', 'railStayTime', 'isDead', 'delay',
    'isBeam', 'beamLength', 'wavyTime', 'wavySpeed', 'wavyAmp',
    'baseAngle', 'speed', 'driftDirection', 'secondaryWavySpeed',
    'secondaryWavyAmp', 'homingStrength', 'spinAngle', 'clusterCount',
    'explosionRadius', 'hitCount', 'remainingPierces', 'chainCount',
    'blastRadiusMul', 'shouldExplode', 'armed', 'triggered',
    'armingTime', 'armingTimeRemaining', 'triggerRadius', 'blastRadius',
    'explosionDamage', 'shrapnelCount', 'shrapnelDamage',
    'ricochetCount', 'ricochetRange', 'ricochetDamageMul',
    'sourcePlayerId', 'sourcePartId', 'sourcePartKey', 'sourcePartName',
    'projectileLook', 'projectileTrail',
    'weaponFamily', 'hackDuration', 'isVisualOnly', 'prismChild'
];
const DRONE_STATE_KEYS = [
    'x', 'y', 'owner', 'isDead', 'hp', 'speed', 'turnRate', 'radius',
    'rotation', 'cooldown', 'maxCooldown', 'range', 'state',
    'ownerPlayerId', 'droneType', 'damage', 'sourcePartId',
    'sourcePartKey', 'sourcePartName'
];
const DECOY_STATE_KEYS = [
    'x', 'y', 'isDead', 'hp', 'maxHp', 'radius', 'duration', 'life'
];

export function snapshotRooms(game) {
    return (game.rooms || []).map(room => {
        const active = room === game.currentRoom;
        const source = (roomKey, gameKey = roomKey) =>
            active ? (game[gameKey] || []) : (room[roomKey] || []);

        return {
            gridX: room.gridX,
            gridY: room.gridY,
            visited: Boolean(room.visited),
            cleared: Boolean(room.cleared),
            sweepUsed: Boolean(room.sweepUsed),
            sweepChargeRemaining: Number.isFinite(room.sweepChargeRemaining)
                ? room.sweepChargeRemaining
                : null,
            locked: Boolean(room.locked),
            shopUsed: Boolean(room.shopUsed),
            ambushStarted: Boolean(room.ambushStarted),
            waveCount: finiteOr(room.waveCount, 0),
            maxWaves: finiteOr(room.maxWaves, 0),
            waveWaiting: Boolean(room.waveWaiting),
            vaultState: snapshotVaultState(room.vaultState),
            asteroids: source('asteroids').map(snapshotAsteroid),
            lootCrates: source('lootCrates').map(snapshotLootCrate),
            shipwrecks: source('shipwrecks').map(snapshotShipwreck),
            xpOrbs: source('xpOrbs').map(snapshotOrb),
            goldOrbs: source('goldOrbs').map(snapshotOrb),
            hpOrbs: source('hpOrbs').map(snapshotOrb),
            itemPickups: source('itemPickups').map(snapshotItemPickup),
            shopItems: snapshotOptionalRoomEntities(
                room,
                game,
                active,
                'shopItems',
                snapshotShopItem
            ),
            treasureChests: snapshotOptionalRoomEntities(
                room,
                game,
                active,
                'treasureChests',
                snapshotTreasureChest
            ),
            vaultChests: snapshotOptionalRoomEntities(
                room,
                game,
                active,
                'vaultChests',
                snapshotVaultChest
            )
        };
    });
}

export function snapshotActiveWorld(game) {
    return {
        enemies: (game.enemies || []).map(snapshotEnemy),
        bosses: (game.bosses || []).map(snapshotEnemy),
        projectiles: (game.projectiles || []).map(snapshotProjectile),
        drones: (game.drones || []).map(snapshotDrone),
        decoys: (game.decoys || []).map(snapshotDecoy),
        xpOrbs: (game.xpOrbs || []).map(snapshotOrb),
        goldOrbs: (game.goldOrbs || []).map(snapshotOrb),
        hpOrbs: (game.hpOrbs || []).map(snapshotOrb),
        itemPickups: (game.itemPickups || []).map(snapshotItemPickup),
        shopItems: (game.shopItems || []).map(snapshotShopItem),
        treasureChests: (game.treasureChests || []).map(
            snapshotTreasureChest
        ),
        vaultChests: (game.vaultChests || []).map(snapshotVaultChest),
        vaultState: snapshotVaultState(game.currentRoom?.vaultState)
    };
}

export function restoreRoomSnapshots(game, snapshots) {
    for (const state of snapshots || []) {
        const room = game.levelGen.getRoom(state.gridX, state.gridY);
        if (!room) continue;

        room.visited = state.visited;
        room.cleared = state.cleared;
        room.sweepUsed = Boolean(state.sweepUsed);
        room.sweepChargeRemaining = Number.isFinite(state.sweepChargeRemaining)
            ? state.sweepChargeRemaining
            : null;
        room.locked = state.locked;
        room.shopUsed = state.shopUsed;
        room.ambushStarted = state.ambushStarted;
        room.waveCount = state.waveCount;
        room.maxWaves = state.maxWaves;
        room.waveWaiting = false;
        room.asteroids = state.asteroids.map(restoreAsteroid);
        room.lootCrates = state.lootCrates.map(restoreLootCrate);
        room.shipwrecks = state.shipwrecks.map(restoreShipwreck);
        room.xpOrbs = state.xpOrbs.map(data => restoreOrb(data, XPOrb));
        room.goldOrbs = state.goldOrbs.map(data => restoreOrb(data, GoldOrb));
        room.hpOrbs = state.hpOrbs.map(data => restoreOrb(data, HPOrb));
        room.itemPickups = state.itemPickups.map(restoreItemPickup);
        room.shopItems = state.shopItems?.map(restoreShopItem) ?? null;
        room.treasureChests =
            state.treasureChests?.map(restoreTreasureChest) ?? null;
        room.vaultChests =
            state.vaultChests?.map(restoreVaultChest) ?? null;
        room.vaultState = restoreVaultState(
            state.vaultState,
            room.vaultChests
        );
    }
}

export function restoreActiveWorld(game, state) {
    if (!state) return;

    game.currentRoom?.activate?.(game);
    game.enemies = state.enemies.map(data => restoreEnemy(data, game));
    game.bosses = state.bosses.map(data => restoreEnemy(data, game));
    game.projectiles = state.projectiles.map(restoreProjectile);
    game.drones = state.drones.map(restoreDrone);
    game.decoys = (state.decoys || []).map(restoreDecoy);
    game.xpOrbs = state.xpOrbs.map(data => restoreOrb(data, XPOrb));
    game.goldOrbs = state.goldOrbs.map(data => restoreOrb(data, GoldOrb));
    game.hpOrbs = state.hpOrbs.map(data => restoreOrb(data, HPOrb));
    game.itemPickups = state.itemPickups.map(restoreItemPickup);
    game.shopItems = (state.shopItems || []).map(restoreShopItem);
    game.treasureChests = (state.treasureChests || []).map(
        restoreTreasureChest
    );
    game.vaultChests = (state.vaultChests || []).map(restoreVaultChest);
    if (game.currentRoom) {
        game.currentRoom.enemies = game.enemies;
        game.currentRoom.vaultState = restoreVaultState(
            state.vaultState,
            game.vaultChests
        );
    }
}

export function isValidSnapshotData(roomSnapshots, activeWorld) {
    if (!Array.isArray(roomSnapshots) || roomSnapshots.length > MAX_ROOMS) {
        return false;
    }
    if (!roomSnapshots.every(validRoomSnapshot)) return false;
    if (!activeWorld || typeof activeWorld !== 'object') return false;

    return validEntityArray(activeWorld.enemies, validEnemySnapshot) &&
        validEntityArray(activeWorld.bosses, validEnemySnapshot) &&
        validEntityArray(activeWorld.projectiles, validProjectileSnapshot) &&
        validEntityArray(activeWorld.drones, validDroneSnapshot) &&
        validEntityArray(activeWorld.decoys || [], validDecoySnapshot) &&
        validEntityArray(activeWorld.xpOrbs, validOrbSnapshot) &&
        validEntityArray(activeWorld.goldOrbs, validOrbSnapshot) &&
        validEntityArray(activeWorld.hpOrbs, validOrbSnapshot) &&
        validEntityArray(activeWorld.itemPickups, validItemPickupSnapshot) &&
        validEntityArray(
            activeWorld.shopItems || [],
            validShopItemSnapshot
        ) &&
        validEntityArray(
            activeWorld.treasureChests || [],
            validTreasureChestSnapshot
        ) &&
        validEntityArray(
            activeWorld.vaultChests || [],
            validVaultChestSnapshot
        ) && validOptionalVaultState(activeWorld.vaultState);
}

function snapshotEnemy(enemy) {
    const shipParts = (enemy.shipParts || []).map(part => ({
        x: part.x,
        y: part.y,
        partId: part.partId,
        rotation: part.rotation || 0
    }));
    const partIndex = part => enemy.shipParts?.indexOf(part) ?? -1;

    return {
        kind: enemy instanceof Boss || enemy.type === 'boss' ? 'boss' : 'enemy',
        id: String(enemy.id || '').slice(0, 100),
        type: String(enemy.type || 'basic').slice(0, 40),
        floorLevel: finiteOr(enemy.floorLevel, 1),
        level: finiteOr(enemy.level, enemy.floorLevel || 1),
        state: pickState(enemy, ENEMY_STATE_KEYS),
        shipParts,
        weaponCooldowns: (enemy.weaponCooldowns || []).map(weapon => ({
            partIndex: partIndex(weapon.part),
            cooldown: finiteOr(weapon.cooldown, 0),
            chargeTimer: finiteOr(weapon.chargeTimer, 0),
            lockedAngle: finiteOrNull(weapon.lockedAngle),
            isCharging: Boolean(weapon.isCharging)
        })),
        activeBursts: (enemy.activeBursts || []).map(burst => ({
            partIndex: partIndex(burst.part),
            count: finiteOr(burst.count, 0),
            timer: finiteOr(burst.timer, 0)
        }))
    };
}

function restoreEnemy(data, game) {
    const enemy = data.kind === 'boss'
        ? new Boss(data.state.x, data.state.y, data.level, deterministicRandom)
        : new Enemy(
            data.state.x,
            data.state.y,
            data.type,
            data.floorLevel,
            deterministicRandom,
            data.id
        );

    enemy.shipParts = data.shipParts.map(part => ({ ...part }));
    if (data.kind === 'boss') {
        enemy.recalculateStats();
    }
    applyState(enemy, data.state, ENEMY_STATE_KEYS);
    enemy.weaponCooldowns = data.weaponCooldowns.flatMap(weapon => {
        const part = enemy.shipParts[weapon.partIndex];
        const def = part && PartsLibrary[part.partId];
        if (!part || !def || def.type !== 'weapon') return [];
        return [{
            part,
            def,
            cooldown: weapon.cooldown,
            chargeTimer: weapon.chargeTimer,
            lockedAngle: weapon.lockedAngle,
            isCharging: weapon.isCharging
        }];
    });
    enemy.activeBursts = data.activeBursts.flatMap(burst => {
        const part = enemy.shipParts[burst.partIndex];
        const def = part && PartsLibrary[part.partId];
        if (!part || !def || def.type !== 'weapon') return [];
        return [{ part, def, count: burst.count, timer: burst.timer }];
    });
    enemy.game = game;
    return enemy;
}

function snapshotAsteroid(entity) {
    return {
        sizeCategory: entity.sizeCategory,
        type: entity.type,
        state: pickState(entity, [
            'x', 'y', 'isDead', 'isBroken', 'radius', 'maxHp', 'hp',
            'rotation', 'rotSpeed', 'vx', 'vy', 'breakAge'
        ]),
        vertices: (entity.vertices || []).map(vertex => ({
            x: vertex.x,
            y: vertex.y
        })),
        breakFragments: structuredClone(entity.breakFragments || [])
    };
}

function restoreAsteroid(data) {
    const entity = new Asteroid(
        data.state.x,
        data.state.y,
        data.sizeCategory,
        data.type,
        deterministicRandom
    );
    applyState(entity, data.state, Object.keys(data.state));
    entity.vertices = data.vertices.map(vertex => ({ ...vertex }));
    entity.breakFragments = structuredClone(data.breakFragments || []);
    if (entity.isBroken && entity.breakFragments.length === 0) {
        entity.createBreakFragments();
    }
    return entity;
}

function snapshotLootCrate(entity) {
    return {
        size: `${entity.wTiles}x${entity.hTiles}`,
        state: pickState(entity, [
            'x', 'y', 'vx', 'vy', 'rotation', 'rotSpeed', 'isDead',
            'isOpened', 'maxHp', 'hp', 'variant', 'breakAge'
        ]),
        breakFragments: structuredClone(entity.breakFragments || [])
    };
}

function restoreLootCrate(data) {
    const entity = new LootCrate(
        data.state.x,
        data.state.y,
        data.size,
        deterministicRandom
    );
    applyState(entity, data.state, Object.keys(data.state));
    entity.refreshVariantColors();
    entity.breakFragments = structuredClone(data.breakFragments || []);
    if (entity.isOpened && entity.breakFragments.length === 0) {
        entity.createBreakFragments();
    }
    return entity;
}

function snapshotShipwreck(entity) {
    return {
        x: entity.x,
        y: entity.y,
        level: entity.level,
        rotation: entity.rotation,
        isDead: Boolean(entity.isDead),
        radius: entity.radius,
        itemsDropped: entity.itemsDropped,
        maxItems: entity.maxItems,
        parts: [...entity.ship.getUniqueParts()].map(part => ({
            x: part.x,
            y: part.y,
            partId: part.partId,
            rotation: part.rotation || 0,
            hp: finiteOr(part.hp, 1),
            maxHp: finiteOr(part.maxHp, 1)
        }))
    };
}

function restoreShipwreck(data) {
    const wreck = new Shipwreck(
        data.x,
        data.y,
        data.level,
        deterministicRandom
    );
    wreck.ship.parts.clear();
    for (const part of data.parts) {
        const def = PartsLibrary[part.partId];
        if (!def) continue;
        const instance = { ...part };
        const rotated = part.rotation % 2 !== 0;
        const width = rotated ? def.height : def.width;
        const height = rotated ? def.width : def.height;
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                wreck.ship.parts.set(`${part.x + x},${part.y + y}`, instance);
            }
        }
    }
    wreck.rotation = data.rotation;
    wreck.isDead = data.isDead;
    wreck.radius = data.radius;
    wreck.itemsDropped = data.itemsDropped;
    wreck.maxItems = data.maxItems;
    return wreck;
}

function snapshotProjectile(entity) {
    return { state: pickState(entity, PROJECTILE_STATE_KEYS) };
}

function restoreProjectile(data) {
    const state = data.state;
    const entity = new Projectile(
        state.x,
        state.y,
        state.angle,
        state.type,
        Math.hypot(state.vx || 0, state.vy || 0),
        state.owner,
        state.damage,
        state.maxLife,
        deterministicRandom
    );
    applyState(entity, state, PROJECTILE_STATE_KEYS);
    if (entity.isBeam || state.isBeam === true) entity.targetHits = new Map();
    if (state.type === 'ricochet_slug') entity.hitTargets = new Set();
    return entity;
}

function snapshotDrone(entity) {
    return { state: pickState(entity, DRONE_STATE_KEYS) };
}

function restoreDrone(data) {
    const state = data.state;
    const entity = new Drone(
        state.x,
        state.y,
        null,
        state.owner,
        deterministicRandom,
        {
            type: state.droneType,
            damage: state.damage,
            attackCooldown: state.maxCooldown,
            sourcePartId: state.sourcePartId,
            sourcePartKey: state.sourcePartKey,
            sourcePartName: state.sourcePartName
        }
    );
    applyState(entity, state, DRONE_STATE_KEYS);
    entity.ownerPlayerId = typeof state.ownerPlayerId === 'string'
        ? state.ownerPlayerId
        : (state.owner === 'player' ? 'host' : null);
    entity.target = null;
    return entity;
}

function snapshotDecoy(entity) {
    return {
        id: String(entity.id || '').slice(0, 100),
        ownerPlayerId: entity.ownerPlayerId == null
            ? null
            : String(entity.ownerPlayerId).slice(0, 100),
        state: pickState(entity, DECOY_STATE_KEYS)
    };
}

function restoreDecoy(data) {
    const state = data.state;
    const entity = new Decoy(
        data.id,
        state.x,
        state.y,
        data.ownerPlayerId,
        {
            hp: state.hp,
            maxHp: state.maxHp,
            radius: state.radius,
            duration: state.duration,
            life: state.life
        }
    );
    applyState(entity, state, DECOY_STATE_KEYS);
    return entity;
}

function snapshotOrb(entity) {
    return {
        state: pickState(entity, [
            'x', 'y', 'value', 'radius', 'isDead', 'forced',
            'pulseAngle', 'rotation', 'spinSpeed'
        ])
    };
}

function restoreOrb(data, OrbClass) {
    const entity = new OrbClass(
        data.state.x,
        data.state.y,
        data.state.value
    );
    applyState(entity, data.state, Object.keys(data.state));
    return entity;
}

function snapshotItemPickup(entity) {
    return {
        partId: entity.partId,
        ownerId: entity.ownerId || null,
        state: pickState(entity, [
            'x', 'y', 'vx', 'vy', 'bobOffset', 'life', 'isDead',
            'magnetRadius', 'magnetForce', 'radius'
        ])
    };
}

function restoreItemPickup(data) {
    const entity = new ItemPickup(
        data.state.x,
        data.state.y,
        data.partId,
        deterministicRandom
    );
    applyState(entity, data.state, Object.keys(data.state));
    entity.ownerId = data.ownerId || null;
    return entity;
}

function snapshotShopItem(entity) {
    return {
        x: entity.x,
        y: entity.y,
        data: { ...entity.data },
        purchased: Boolean(entity.purchased),
        life: finiteOr(entity.life, 0),
        bobOffset: finiteOr(entity.bobOffset, 0)
    };
}

function restoreShopItem(data) {
    const entity = new ShopItem(data.x, data.y, { ...data.data });
    entity.purchased = data.purchased;
    entity.life = data.life;
    entity.bobOffset = data.bobOffset;
    return entity;
}

function snapshotTreasureChest(entity) {
    return {
        x: entity.x,
        y: entity.y,
        opened: Boolean(entity.opened),
        life: finiteOr(entity.life, 0),
        bobOffset: finiteOr(entity.bobOffset, 0),
        rotation: finiteOr(entity.rotation, 0)
    };
}

function restoreTreasureChest(data) {
    const entity = new TreasureChest(data.x, data.y, deterministicRandom);
    Object.assign(entity, data);
    return entity;
}

function snapshotVaultChest(entity) {
    return {
        x: entity.x,
        y: entity.y,
        costType: entity.costType,
        costAmount: entity.costAmount,
        contractId: entity.contractId,
        opened: Boolean(entity.opened),
        locked: Boolean(entity.locked),
        ambushActive: Boolean(entity.ambushActive),
        wasPaid: Boolean(entity.wasPaid),
        sealed: Boolean(entity.sealed),
        life: finiteOr(entity.life, 0),
        bobOffset: finiteOr(entity.bobOffset, 0),
        rotation: finiteOr(entity.rotation, 0)
    };
}

function snapshotVaultState(state) {
    if (!state) return null;
    return {
        version: finiteOr(state.version, 1),
        phase: state.phase,
        contractId: state.contractId,
        payerId: state.payerId,
        playerCount: finiteOr(state.playerCount, 1),
        elapsed: finiteOr(state.elapsed, 0),
        nextSurge: finiteOr(state.nextSurge, 0),
        spawnSerial: finiteOr(state.spawnSerial, 0),
        rewardPartIds: [...(state.rewardPartIds || [])],
        rewardSpawned: Boolean(state.rewardSpawned)
    };
}

function restoreVaultState(data, chests) {
    if (data) return { ...createVaultState(), ...data };
    if (!chests?.length) return null;

    const state = createVaultState();
    const paid = chests.find(chest => chest.wasPaid);
    const opened = chests.find(chest => chest.opened);
    if (!paid && !opened) return state;

    const chosen = opened || paid;
    state.contractId = chosen.contractId;
    state.payerId = 'host';
    if (opened) {
        state.phase = VaultPhase.COMPLETED;
        state.rewardSpawned = true;
    } else if (chosen.ambushActive) {
        state.phase = VaultPhase.CONTAINMENT;
    } else {
        state.phase = VaultPhase.REWARD;
    }
    for (const chest of chests) {
        chest.sealed = chest !== chosen;
    }
    return state;
}

function restoreVaultChest(data) {
    const entity = new VaultChest(
        data.x,
        data.y,
        data.costType,
        data.costAmount,
        deterministicRandom
    );
    Object.assign(entity, data);
    return entity;
}

function validRoomSnapshot(value) {
    if (!isObject(value)) return false;
    if (!Number.isInteger(value.gridX) || !Number.isInteger(value.gridY)) {
        return false;
    }
    if (![
        'visited', 'cleared', 'locked', 'shopUsed',
        'ambushStarted', 'waveWaiting'
    ].every(key => typeof value[key] === 'boolean')) return false;
    if (
        value.sweepUsed !== undefined &&
        typeof value.sweepUsed !== 'boolean'
    ) return false;
    if (
        value.sweepChargeRemaining !== undefined &&
        value.sweepChargeRemaining !== null &&
        (
            !Number.isFinite(value.sweepChargeRemaining) ||
            value.sweepChargeRemaining < 0
        )
    ) return false;
    if (
        !Number.isInteger(value.waveCount) ||
        value.waveCount < 0 ||
        !Number.isInteger(value.maxWaves) ||
        value.maxWaves < 0
    ) {
        return false;
    }

    return validEntityArray(value.asteroids, validAsteroidSnapshot) &&
        validEntityArray(value.lootCrates, validLootCrateSnapshot) &&
        validEntityArray(value.shipwrecks, validShipwreckSnapshot) &&
        validEntityArray(value.xpOrbs, validOrbSnapshot) &&
        validEntityArray(value.goldOrbs, validOrbSnapshot) &&
        validEntityArray(value.hpOrbs, validOrbSnapshot) &&
        validEntityArray(value.itemPickups, validItemPickupSnapshot) &&
        validOptionalEntityArray(value.shopItems, validShopItemSnapshot) &&
        validOptionalEntityArray(
            value.treasureChests,
            validTreasureChestSnapshot
        ) &&
        validOptionalEntityArray(value.vaultChests, validVaultChestSnapshot) &&
        validOptionalVaultState(value.vaultState);
}

function validEntityArray(values, validator) {
    return Array.isArray(values) &&
        values.length <= MAX_ENTITIES &&
        values.every(validator);
}

function validOptionalEntityArray(values, validator) {
    return values === null || validEntityArray(values, validator);
}

function validStateSnapshot(value, requiredKeys) {
    return isObject(value) &&
        isSafeJson(value) &&
        requiredKeys.every(key => Number.isFinite(value[key]));
}

function validOptionalStateFields(
    value,
    { numbers = [], strings = [], booleans = [] } = {}
) {
    return numbers.every(key =>
        value[key] === undefined || Number.isFinite(value[key])
    ) && strings.every(key =>
        value[key] === undefined ||
        value[key] === null ||
        typeof value[key] === 'string'
    ) && booleans.every(key =>
        value[key] === undefined || typeof value[key] === 'boolean'
    );
}

function validEnemySnapshot(value) {
    return isObject(value) &&
        (value.kind === 'enemy' || value.kind === 'boss') &&
        typeof value.id === 'string' &&
        typeof value.type === 'string' &&
        Number.isFinite(value.floorLevel) &&
        Number.isFinite(value.level) &&
        validStateSnapshot(value.state, ['x', 'y']) &&
        validOptionalStateFields(value.state, {
            numbers: ['empTimer', 'hackTimer'],
            strings: ['hackedByPlayerId']
        }) &&
        validEntityArray(value.shipParts, part =>
            isObject(part) &&
            Number.isInteger(part.x) &&
            Number.isInteger(part.y) &&
            typeof part.partId === 'string' &&
            Number.isInteger(part.rotation) &&
            isSafeJson(part)
        ) &&
        validEntityArray(value.weaponCooldowns, isSafeJson) &&
        validEntityArray(value.activeBursts, isSafeJson);
}

function validProjectileSnapshot(value) {
    return isObject(value) &&
        validStateSnapshot(value.state, [
            'x', 'y', 'angle', 'damage', 'maxLife'
        ]) &&
        typeof value.state.type === 'string' &&
        typeof value.state.owner === 'string' &&
        validOptionalStateFields(value.state, {
            numbers: [
                'armingTime', 'armingTimeRemaining', 'triggerRadius',
                'blastRadius', 'explosionDamage', 'shrapnelCount',
                'shrapnelDamage', 'ricochetCount', 'ricochetRange',
                'ricochetDamageMul', 'hitCount', 'remainingPierces',
                'chainCount', 'hackDuration', 'beamLength',
                'explosionRadius', 'blastRadiusMul'
            ],
            strings: [
                'sourcePlayerId', 'sourcePartId', 'sourcePartKey',
                'sourcePartName', 'weaponFamily', 'projectileLook', 'projectileTrail'
            ],
            booleans: [
                'shouldExplode', 'armed', 'triggered', 'isBeam',
                'isVisualOnly', 'prismChild'
            ]
        }) &&
        (value.state.projectileLook === undefined || isProjectileLook(value.state.projectileLook)) &&
        (value.state.projectileTrail === undefined || isProjectileTrail(value.state.projectileTrail));
}

function validDroneSnapshot(value) {
    return isObject(value) &&
        validStateSnapshot(value.state, ['x', 'y']) &&
        typeof value.state.owner === 'string' &&
        (
            value.state.ownerPlayerId == null ||
            typeof value.state.ownerPlayerId === 'string'
        );
}

function validDecoySnapshot(value) {
    return isObject(value) &&
        typeof value.id === 'string' &&
        value.id.length > 0 &&
        value.id.length <= 100 &&
        (value.ownerPlayerId === null || typeof value.ownerPlayerId === 'string') &&
        validStateSnapshot(value.state, ['x', 'y']) &&
        ['hp', 'maxHp', 'radius', 'duration', 'life'].every(key =>
            Number.isFinite(value.state[key]) && value.state[key] >= 0
        );
}

function validAsteroidSnapshot(value) {
    return isObject(value) &&
        typeof value.sizeCategory === 'string' &&
        typeof value.type === 'string' &&
        validStateSnapshot(value.state, ['x', 'y']) &&
        validEntityArray(value.vertices, vertex =>
            isObject(vertex) &&
            Number.isFinite(vertex.x) &&
            Number.isFinite(vertex.y)
        ) &&
        (value.breakFragments == null || isSafeJson(value.breakFragments));
}

function validLootCrateSnapshot(value) {
    return isObject(value) &&
        typeof value.size === 'string' &&
        validStateSnapshot(value.state, ['x', 'y']) &&
        (value.breakFragments == null || isSafeJson(value.breakFragments));
}

function validShipwreckSnapshot(value) {
    return isObject(value) &&
        ['x', 'y', 'level', 'rotation', 'radius', 'itemsDropped', 'maxItems']
            .every(key => Number.isFinite(value[key])) &&
        typeof value.isDead === 'boolean' &&
        validEntityArray(value.parts, part =>
            isObject(part) &&
            Number.isInteger(part.x) &&
            Number.isInteger(part.y) &&
            typeof part.partId === 'string' &&
            Number.isInteger(part.rotation) &&
            Number.isFinite(part.hp) &&
            Number.isFinite(part.maxHp)
        );
}

function validOrbSnapshot(value) {
    return isObject(value) &&
        validStateSnapshot(value.state, ['x', 'y', 'value']);
}

function validItemPickupSnapshot(value) {
    return isObject(value) &&
        typeof value.partId === 'string' &&
        (
            value.ownerId == null ||
            typeof value.ownerId === 'string'
        ) &&
        validStateSnapshot(value.state, ['x', 'y']);
}

function validShopItemSnapshot(value) {
    return isObject(value) &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y) &&
        isObject(value.data) &&
        isSafeJson(value.data) &&
        typeof value.purchased === 'boolean' &&
        Number.isFinite(value.life) &&
        Number.isFinite(value.bobOffset);
}

function validTreasureChestSnapshot(value) {
    return isObject(value) &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y) &&
        typeof value.opened === 'boolean' &&
        ['life', 'bobOffset', 'rotation'].every(key =>
            Number.isFinite(value[key])
        );
}

function validVaultChestSnapshot(value) {
    return validTreasureChestSnapshot(value) &&
        typeof value.costType === 'string' &&
        Number.isFinite(value.costAmount) &&
        (
            value.contractId === undefined ||
            isVaultContractId(value.contractId)
        ) &&
        ['locked', 'ambushActive', 'wasPaid'].every(key =>
            typeof value[key] === 'boolean'
        ) && (
            value.sealed === undefined || typeof value.sealed === 'boolean'
        );
}

function validOptionalVaultState(value) {
    if (value === undefined || value === null) return true;
    return isObject(value) &&
        Number.isInteger(value.version) &&
        value.version >= 1 &&
        isVaultPhase(value.phase) &&
        (
            value.contractId === null ||
            isVaultContractId(value.contractId)
        ) &&
        (value.payerId === null || typeof value.payerId === 'string') &&
        Number.isInteger(value.playerCount) &&
        value.playerCount >= 1 && value.playerCount <= 4 &&
        Number.isFinite(value.elapsed) && value.elapsed >= 0 &&
        Number.isInteger(value.nextSurge) && value.nextSurge >= 0 &&
        Number.isInteger(value.spawnSerial) && value.spawnSerial >= 0 &&
        Array.isArray(value.rewardPartIds) &&
        value.rewardPartIds.length <= 32 &&
        value.rewardPartIds.every(id => typeof id === 'string') &&
        typeof value.rewardSpawned === 'boolean';
}

function isObject(value) {
    return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value);
}

function snapshotOptionalRoomEntities(
    room,
    game,
    active,
    key,
    snapshot
) {
    if (!active && room[key] === null) return null;
    return (active ? game[key] : room[key] || []).map(snapshot);
}

function isSafeJson(value, depth = 0) {
    if (depth > 8) return false;
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.length <= 200;
    if (Array.isArray(value)) {
        return value.length <= MAX_ENTITIES &&
            value.every(item => isSafeJson(item, depth + 1));
    }
    if (typeof value !== 'object') return false;
    const entries = Object.entries(value);
    return entries.length <= 128 &&
        entries.every(([key, item]) =>
            key !== '__proto__' &&
            key !== 'constructor' &&
            isSafeJson(item, depth + 1)
        );
}

function pickState(source, keys) {
    const state = {};
    for (const key of keys) {
        const value = source[key];
        if (
            typeof value === 'boolean' ||
            typeof value === 'string' ||
            Number.isFinite(value) ||
            value === null
        ) {
            state[key] = value;
        }
    }
    return state;
}

function applyState(target, state, keys) {
    for (const key of keys) {
        if (Object.hasOwn(state, key)) target[key] = state[key];
    }
}

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value) {
    return Number.isFinite(value) ? value : null;
}
