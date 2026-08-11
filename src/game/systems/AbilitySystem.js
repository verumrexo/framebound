import { Decoy } from '../../shared/entities/Decoy.js';
import { PartsLibrary } from '../../shared/parts/Part.js';
import { partSoundEventKey } from '../audio/SoundEventRegistry.js';

export const ACTIVE_ABILITY_DEFINITIONS = Object.freeze({
    blink: Object.freeze({
        partId: 'warp_gate',
        label: 'warp gate',
        cooldown: 7,
        range: 260
    }),
    decoy: Object.freeze({
        partId: 'decoy',
        label: 'decoy',
        cooldown: 12,
        duration: 6,
        hp: 35,
        range: 180
    }),
    stealth: Object.freeze({
        partId: 'stealth',
        label: 'stealth',
        cooldown: 14,
        duration: 4
    }),
    emp: Object.freeze({
        partId: 'emp',
        label: 'emp',
        cooldown: 16,
        radius: 360,
        duration: 3,
        bossDuration: 1.25
    })
});

const ACTIVE_ABILITY_IDS = new Set(Object.keys(ACTIVE_ABILITY_DEFINITIONS));
const ROOM_MARGIN = 30;

export class AbilitySystem {
    constructor(game, { DecoyClass = Decoy } = {}) {
        this.game = game;
        this.DecoyClass = DecoyClass;
        this.selectedIndex = 0;
        this.decoySerial = 0;
    }

    getInstalledAbilities(ship = this.game.playerShip) {
        if (!ship?.getUniqueParts) return [];

        const installed = [...ship.getUniqueParts()]
            .map((part, index) => {
                const def = PartsLibrary[part.partId];
                const stats = def?.stats || {};
                const abilityId = stats.activeAbility || part.activeAbility ||
                    (ACTIVE_ABILITY_IDS.has(part.partId) ? part.partId : null);
                if (!abilityId || !ACTIVE_ABILITY_IDS.has(abilityId)) return null;
                const balance = ACTIVE_ABILITY_DEFINITIONS[abilityId];
                return {
                    id: abilityId,
                    label: def?.name || balance.label,
                    part,
                    def,
                    balance,
                    order: [
                        Number.isFinite(part.x) ? part.x : 0,
                        Number.isFinite(part.y) ? part.y : 0,
                        String(part.partId || ''),
                        index
                    ]
                };
            })
            .filter(Boolean)
            .sort((left, right) => comparePartOrder(left.order, right.order));

        const unique = [];
        const seen = new Set();
        for (const ability of installed) {
            if (seen.has(ability.id)) continue;
            seen.add(ability.id);
            unique.push(ability);
        }
        return unique;
    }

    selectedAbility(ship = this.game.playerShip) {
        const abilities = this.getInstalledAbilities(ship);
        if (abilities.length === 0) {
            this.selectedIndex = 0;
            return null;
        }
        this.selectedIndex = this.selectedIndex % abilities.length;
        return abilities[this.selectedIndex];
    }

    cycleSelection(ship = this.game.playerShip) {
        const abilities = this.getInstalledAbilities(ship);
        if (abilities.length <= 1) {
            this.selectedIndex = 0;
            return abilities[0] || null;
        }
        this.selectedIndex = (this.selectedIndex + 1) % abilities.length;
        return abilities[this.selectedIndex];
    }

    update(dt) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        for (const ship of this.controlledShips()) {
            const wasStealthed = finiteNonNegative(ship.stealthTimer) > 0;
            tickShipState(ship, dt);
            if (wasStealthed && ship.stealthTimer === 0) {
                const stealth = this.getInstalledAbilities(ship).find(candidate => candidate.id === 'stealth');
                if (stealth) this.playAbilitySound(stealth, 'reveal', 'hit');
            }
            for (const id of ACTIVE_ABILITY_IDS) {
                this.syncPartCooldowns(ship, id, ship.abilityCooldowns[id]);
            }
        }

        const decoys = this.game.decoys || [];
        for (const decoy of decoys) {
            decoy.update?.(dt);
            if (decoy.isDead && !decoy.destroySoundPlayed && decoy.sourcePartId) {
                this.playPartSound(decoy.sourcePartId, 'destroyed', 'hit');
                decoy.destroySoundPlayed = true;
            }
        }
        this.game.decoys = decoys.filter(decoy => !decoy.isDead);
    }

    activateForPlayer(playerId, ship, payload) {
        if (!ship || ship.isDead || !isRecord(payload)) return false;
        const abilityId = payload.abilityId;
        if (typeof abilityId !== 'string' || !ACTIVE_ABILITY_IDS.has(abilityId)) {
            return false;
        }
        const aimAngle = normalizeAimAngle(payload.aimAngle);
        if (aimAngle === null) return false;

        const ability = this.getInstalledAbilities(ship)
            .find(candidate => candidate.id === abilityId);
        if (!ability) return false;

        const cooldowns = ensureCooldowns(ship);
        if (cooldowns[abilityId] > 0) return false;
        cooldowns[abilityId] = ability.balance.cooldown;
        this.syncPartCooldowns(ship, abilityId, cooldowns[abilityId]);

        const origin = this.positionFor(playerId, ship);
        const result = {
            abilityId,
            playerId,
            aimAngle
        };

        if (abilityId === 'blink') {
            this.playAbilitySound(ability, 'departure', 'dash');
            const destination = this.pointAlong(origin, aimAngle, ability.balance.range);
            const clamped = this.clampToRoom(destination.x, destination.y);
            this.setPosition(playerId, ship, clamped.x, clamped.y);
            this.playAbilitySound(ability, 'arrival', 'nova');
            return { ...result, x: clamped.x, y: clamped.y };
        }

        if (abilityId === 'decoy') {
            const point = this.pointAlong(origin, aimAngle, ability.balance.range);
            const clamped = this.clampToRoom(point.x, point.y);
            const id = this.nextDecoyId(playerId);
            const decoy = new this.DecoyClass(
                id,
                clamped.x,
                clamped.y,
                String(playerId || 'host'),
                {
                    hp: ability.balance.hp,
                    maxHp: ability.balance.hp,
                    duration: ability.balance.duration,
                    life: ability.balance.duration
                }
            );
            this.game.decoys ||= [];
            decoy.sourcePartId = ability.def.id;
            this.game.decoys.push(decoy);
            this.playAbilitySound(ability, 'deploy', 'reload');
            return { ...result, x: clamped.x, y: clamped.y, decoyId: id };
        }

        if (abilityId === 'stealth') {
            ship.stealthTimer = Math.max(
                Number.isFinite(ship.stealthTimer) ? ship.stealthTimer : 0,
                ability.balance.duration
            );
            this.playAbilitySound(ability, 'cloak', 'dash');
            return { ...result, duration: ability.balance.duration };
        }

        this.playAbilitySound(ability, 'activate', 'reload');
        const radius = ability.balance.radius;
        const originPoint = this.positionFor(playerId, ship);
        const affected = [];
        for (const enemy of [
            ...(this.game.enemies || []),
            ...(this.game.bosses || [])
        ]) {
            if (enemy.isDead) continue;
            if (distanceSquared(originPoint, enemy) > radius * radius) continue;
            const duration = enemy.type === 'boss' || enemy.isBoss
                ? ability.balance.bossDuration
                : ability.balance.duration;
            enemy.empTimer = Math.max(
                Number.isFinite(enemy.empTimer) ? enemy.empTimer : 0,
                duration
            );
            affected.push(String(enemy.id || enemy.type || 'enemy'));
        }
        this.playAbilitySound(ability, 'pulse', 'nova');
        return {
            ...result,
            radius,
            duration: ability.balance.duration,
            affected
        };
    }

    nextDecoyId(playerId) {
        const ownerId = String(playerId || 'host');
        const existingIds = new Set();
        let highestSerial = this.decoySerial;

        for (const decoy of this.game.decoys || []) {
            if (typeof decoy?.id !== 'string') continue;
            existingIds.add(decoy.id);
            const match = /^decoy_.+_(\d+)$/.exec(decoy.id);
            if (match) highestSerial = Math.max(
                highestSerial,
                Number(match[1])
            );
        }

        let serial = highestSerial;
        let id;
        do {
            serial += 1;
            id = `decoy_${ownerId}_${serial}`;
        } while (existingIds.has(id));

        this.decoySerial = serial;
        return id;
    }

    snapshotShipState(ship) {
        if (!ship) return { cooldowns: {}, stealthTimer: 0 };
        return {
            cooldowns: { ...ensureCooldowns(ship) },
            stealthTimer: finiteNonNegative(ship.stealthTimer)
        };
    }

    restoreShipState(ship, state) {
        if (!ship || !isRecord(state)) return false;
        const cooldowns = {};
        if (isRecord(state.cooldowns)) {
            for (const id of ACTIVE_ABILITY_IDS) {
                if (Number.isFinite(state.cooldowns[id])) {
                    cooldowns[id] = Math.max(0, state.cooldowns[id]);
                }
            }
        }
        ship.abilityCooldowns = cooldowns;
        ship.stealthTimer = finiteNonNegative(state.stealthTimer);
        for (const id of ACTIVE_ABILITY_IDS) {
            this.syncPartCooldowns(ship, id, cooldowns[id] || 0);
        }
        return true;
    }

    syncPartCooldowns(ship, abilityId, value) {
        for (const ability of this.getInstalledAbilities(ship)) {
            if (ability.id === abilityId) ability.part.abilityCooldown = value;
        }
    }

    playAbilitySound(ability, slot, fallback) {
        return this.playPartSound(ability?.def?.id || ability?.part?.partId, slot, fallback);
    }

    playPartSound(partId, slot, fallback) {
        if (!partId || !this.game.audio) return null;
        if (this.game.audio.playEvent) {
            return this.game.audio.playEvent(
                partSoundEventKey(partId, slot),
                fallback,
                { volume: 0.55 }
            );
        }
        return this.game.audio.play?.(fallback, { volume: 0.55 });
    }

    reset() {
        this.selectedIndex = 0;
        this.decoySerial = 0;
    }

    controlledShips() {
        const ships = [];
        if (this.game.playerShip) ships.push(this.game.playerShip);
        if (this.game.partLabSimulation?.active) return ships;
        for (const peer of this.game.peerNetwork?.simulation?.peers?.values?.() || []) {
            if (peer.ship) ships.push(peer.ship);
        }
        return ships;
    }

    positionFor(playerId, ship) {
        if (playerId === 'host' && ship === this.game.playerShip) {
            return { x: finiteOr(this.game.x, ship.x), y: finiteOr(this.game.y, ship.y) };
        }
        return { x: finiteOr(ship.x, 0), y: finiteOr(ship.y, 0) };
    }

    setPosition(playerId, ship, x, y) {
        ship.x = x;
        ship.y = y;
        if (playerId === 'host' && ship === this.game.playerShip) {
            this.game.x = x;
            this.game.y = y;
            ship.vx = this.game.vx;
            ship.vy = this.game.vy;
        }
    }

    pointAlong(origin, angle, range) {
        return {
            x: origin.x + Math.cos(angle) * range,
            y: origin.y + Math.sin(angle) * range
        };
    }

    clampToRoom(x, y) {
        const room = this.game.currentRoom;
        if (!room) return { x, y };
        return {
            x: Math.min(room.x + room.width - ROOM_MARGIN, Math.max(room.x + ROOM_MARGIN, x)),
            y: Math.min(room.y + room.height - ROOM_MARGIN, Math.max(room.y + ROOM_MARGIN, y))
        };
    }
}

function ensureCooldowns(ship) {
    if (!isRecord(ship.abilityCooldowns)) ship.abilityCooldowns = {};
    for (const id of ACTIVE_ABILITY_IDS) {
        if (!Number.isFinite(ship.abilityCooldowns[id])) {
            ship.abilityCooldowns[id] = 0;
        }
    }
    return ship.abilityCooldowns;
}

function tickShipState(ship, dt) {
    const cooldowns = ensureCooldowns(ship);
    for (const id of ACTIVE_ABILITY_IDS) {
        cooldowns[id] = Math.max(0, cooldowns[id] - dt);
    }
    ship.stealthTimer = Math.max(0, finiteNonNegative(ship.stealthTimer) - dt);
}

function normalizeAimAngle(value) {
    if (!Number.isFinite(value) || Math.abs(value) > Math.PI * 4) return null;
    let angle = value;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

function comparePartOrder(left, right) {
    for (let index = 0; index < left.length; index++) {
        if (left[index] < right[index]) return -1;
        if (left[index] > right[index]) return 1;
    }
    return 0;
}

function distanceSquared(left, right) {
    return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function finiteNonNegative(value) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
