import { Enemy } from '../../shared/entities/Enemy.js';
import { VaultChest } from '../../shared/entities/VaultChest.js';
import { selectEnemyType } from '../../shared/enemies/EnemyRoster.js';
import { PartsLibrary } from '../../shared/parts/Part.js';
import {
    createVaultState,
    VAULT_CONTAINMENT_DURATION,
    VAULT_REWARD_COUNT,
    VAULT_SURGE_TIMES,
    VaultContract,
    VaultPhase
} from '../../shared/vault/VaultDefinitions.js';
import { getVaultLayout } from './VaultLayout.js';

export class VaultEncounterSystem {
    constructor(room) {
        this.room = room;
    }

    initialize(game) {
        const room = this.room;
        if (room.vaultChests) return false;
        room.vaultState = createVaultState();
        const layout = getVaultLayout(room);
        room.vaultChests = [
            new VaultChest(
                layout.contracts.gilded.x,
                layout.contracts.gilded.y,
                'gold',
                0,
                room.random,
                VaultContract.GILDED
            ),
            new VaultChest(
                layout.contracts.blood.x,
                layout.contracts.blood.y,
                'hp',
                0,
                room.random,
                VaultContract.BLOOD
            )
        ];
        game.vaultChests = room.vaultChests;
        game.audio?.play?.('vault_offer', { volume: 0.7 });
        return true;
    }

    start(game, contractId = VaultContract.GILDED, payerId = 'host') {
        const room = this.room;
        const state = room.vaultState || createVaultState();
        if (state.phase !== VaultPhase.OFFER) return false;
        room.vaultState = state;
        Object.assign(state, {
            phase: VaultPhase.CONTAINMENT,
            contractId,
            payerId,
            playerCount: this.getPlayerCount(game),
            elapsed: 0,
            nextSurge: 0,
            spawnSerial: 0,
            rewardPartIds: this.rollRewards(),
            rewardSpawned: false
        });
        room.ambushStarted = true;
        room.locked = true;
        room.cleared = false;
        room.waveCount = 0;
        room.maxWaves = VAULT_SURGE_TIMES.length;

        for (const chest of room.vaultChests || []) {
            const chosen = chest.contractId === contractId;
            chest.wasPaid = chosen;
            chest.sealed = !chosen;
            chest.ambushActive = chosen;
            chest.locked = true;
        }

        this.spawnSurge(game);
        game.audio?.play?.('vault_seal', { volume: 0.8 });
        game.showNotification('containment engaged // survive', '#ff4f70');
        return true;
    }

    update(game, dt = 0) {
        const room = this.room;
        const state = room.vaultState;
        if (!state || state.phase !== VaultPhase.CONTAINMENT) return;
        room.enemies = room.enemies.filter(enemy => !enemy.isDead);
        state.elapsed = Math.min(
            VAULT_CONTAINMENT_DURATION,
            state.elapsed + Math.max(0, Number(dt) || 0)
        );

        while (
            state.nextSurge < VAULT_SURGE_TIMES.length &&
            state.elapsed >= VAULT_SURGE_TIMES[state.nextSurge]
        ) {
            this.spawnSurge(game);
        }

        if (
            state.elapsed >= VAULT_CONTAINMENT_DURATION &&
            room.enemies.length === 0
        ) {
            state.phase = VaultPhase.REWARD;
            room.ambushStarted = false;
            room.cleared = true;
            room.locked = false;
            const chosen = room.vaultChests?.find(
                chest => chest.contractId === state.contractId
            );
            if (chosen) {
                chosen.ambushActive = false;
                chosen.locked = false;
            }
            game.showNotification('reliquary open // claim cache', '#55ffc2');
            game.audio?.play?.('vault_unlock', { volume: 0.9 });
            game.autoSave?.();
        }
    }

    cancel() {
        this.room.waveTimer = null;
        this.room.waveWaiting = false;
    }

    rollRewards() {
        const ids = Object.keys(PartsLibrary).filter(id =>
            id !== 'core' && PartsLibrary[id].shopCategory !== 'doctrine'
        );
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(this.room.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        return ids.slice(0, VAULT_REWARD_COUNT);
    }

    spawnSurge(game) {
        const room = this.room;
        const state = room.vaultState;
        if (!state || state.phase !== VaultPhase.CONTAINMENT) return;
        const surgeIndex = state.nextSurge;
        if (surgeIndex >= VAULT_SURGE_TIMES.length) return;
        state.nextSurge++;
        room.waveCount = state.nextSurge;
        game.showNotification(
            `containment surge ${state.nextSurge}/${VAULT_SURGE_TIMES.length}`,
            '#ff9b42'
        );
        game.audio?.play?.('vault_surge', { volume: 0.8 });

        const floor = game.floor || 1;
        const count = 3 + surgeIndex + Math.max(0, state.playerCount - 1);
        const layout = getVaultLayout(room);
        for (let i = 0; i < count; i++) {
            const gate = layout.gates[(i + surgeIndex) % layout.gates.length];
            const spread = (i - (count - 1) / 2) * 55;
            const verticalGate = gate.x === layout.center.x;
            const x = gate.x + (verticalGate ? spread : 0);
            const y = gate.y + (verticalGate ? 0 : spread);
            const type = selectEnemyType(floor, room.random(), {
                vault: true,
                large: true
            });
            if (!type) continue;
            const id = `e_${room.gridX}_${room.gridY}_vault_${state.spawnSerial++}`;
            const enemy = new Enemy(x, y, type, floor, room.random, id);
            enemy.maxHp *= 1.2;
            enemy.hp = enemy.maxHp;
            room.enemies.push(enemy);
            game.enemies.push(enemy);
        }
        game.autoSave?.();
    }

    getPlayerCount(game) {
        const players = game.peerNetwork?.simulation?.getPickupPlayers?.();
        if (!Array.isArray(players)) return 1;
        return Math.max(1, Math.min(4, players.length));
    }
}
