import { HostGameSimulation } from '../game/systems/HostGameSimulation.js';
import { PeerWorldReplicator } from '../game/systems/PeerWorldReplicator.js';
import { HostAuthoritySession } from '../shared/multiplayer/HostAuthoritySession.js';
import { PeerSessionClient } from '../shared/multiplayer/PeerSessionClient.js';
import { PeerConnectionCoordinator } from './PeerConnectionCoordinator.js';
import { SocketIOSignalingClient } from './SocketIOSignalingClient.js';

const MAX_PENDING_ACTIONS = 8;

export class PeerNetworkManager {
    constructor(game, {
        createSignaling = () => new SocketIOSignalingClient(),
        createSimulation = target => new HostGameSimulation(target),
        createAuthority = simulation => new HostAuthoritySession(simulation),
        createReplicator = target => new PeerWorldReplicator(target),
        createCoordinator = options =>
            new PeerConnectionCoordinator(options),
        createClient = (transport, options) =>
            new PeerSessionClient(transport, options),
        guestReadyTimeoutMs = 10_000,
        guestLivenessTimeoutMs = 15_000,
        scheduleTimeout = scheduleDeadline,
        cancelTimeout = handle => clearTimeout(handle)
    } = {}) {
        this.game = game;
        this.createSignaling = createSignaling;
        this.createSimulation = createSimulation;
        this.createAuthority = createAuthority;
        this.createReplicator = createReplicator;
        this.createCoordinator = createCoordinator;
        this.createClient = createClient;
        this.guestReadyTimeoutMs = guestReadyTimeoutMs;
        this.guestLivenessTimeoutMs = guestLivenessTimeoutMs;
        this.scheduleTimeout = scheduleTimeout;
        this.cancelTimeout = cancelTimeout;
        this.signaling = null;
        this.simulation = null;
        this.authority = null;
        this.replicator = null;
        this.coordinator = null;
        this.client = null;
        this.role = null;
        this.connected = false;
        this.resumeToken = null;
        this.lastFireIntent = null;
        this.pendingActions = [];
        this.guestReadyTimer = null;
        this.guestLivenessTimer = null;
        this.guestHostPeerId = null;
        this.onStatus = null;
        this.onHosted = null;
        this.onReady = null;
    }

    get isConnected() {
        return this.connected || this.role === 'host';
    }

    get isHost() {
        return this.role === 'host';
    }

    get isGuest() {
        return this.role === 'guest';
    }

    get isGuestAuthorityClient() {
        return this.isGuest;
    }

    get otherPlayers() {
        if (this.isGuest) return this.replicator?.remotePlayers || new Map();
        if (!this.simulation) return new Map();
        return new Map(
            [...this.simulation.peers.entries()]
                .filter(([, peer]) => !peer.suspended)
                .map(([id, peer]) => [id, peer.ship])
        );
    }

    get spectatorTarget() {
        for (const player of this.otherPlayers.values()) {
            if (!player.isDead && !player.suspended) return player;
        }
        return null;
    }

    canSpectateLocalDeath() {
        return Boolean(this.role && this.spectatorTarget);
    }

    handleBossDefeated() {
        if (!this.isHost || !this.simulation) return [];
        const resurrected = this.simulation.resurrectDeadPlayers?.() || [];
        if (resurrected.includes('host')) {
            this.game.isSpectating = false;
            this.game.isGameOver = false;
            this.game.paused = false;
        }
        return resurrected;
    }

    host() {
        this.disconnect();
        try {
            this.game.networkManager?.disconnect();
            this.role = 'host';
            this.simulation = this.createSimulation(this.game);
            this.authority = this.createAuthority(this.simulation);
            this.signaling = this.createSignaling();
            this.coordinator = this.createCoordinator({
                signaling: this.signaling,
                hostSession: this.authority
            });
            this.bindCoordinator();
            this.game.network = this;
            this.coordinator.host();
            return true;
        } catch (error) {
            return this.failStart(error);
        }
    }

    join(code) {
        this.disconnect();
        try {
            this.game.networkManager?.disconnect();
            this.role = 'guest';
            this.replicator = this.createReplicator(this.game);
            this.signaling = this.createSignaling();
            this.coordinator = this.createCoordinator({
                signaling: this.signaling,
                createClient: transport => {
                    const client = this.createClient(transport, {
                        resumeToken: this.resumeToken
                    });
                    this.configureClient(client);
                    this.client = client;
                    return client;
                }
            });
            this.bindCoordinator();
            this.game.network = this;
            if (!this.coordinator.join(code)) {
                this.disconnect();
                return false;
            }
            return true;
        } catch (error) {
            return this.failStart(error);
        }
    }

    bindCoordinator() {
        const coordinator = this.coordinator;
        coordinator.onStatus = (status, detail) => {
            this.onStatus?.(status, detail);
        };
        coordinator.onHosted = data => {
            this.connected = true;
            this.onHosted?.(data);
        };
        coordinator.onConnected = data => {
            if (this.isHost) {
                this.connected = true;
                this.onReady?.({
                    role: 'host',
                    peerId: data?.peerId
                });
            } else if (this.isGuest) {
                this.guestHostPeerId = data?.peerId || null;
                this.armGuestReadyTimeout(data?.peerId);
            }
        };
        coordinator.onDisconnected = () => {
            if (this.isGuest) {
                this.cancelGuestReadyTimeout();
                this.cancelGuestLivenessTimeout();
                this.guestHostPeerId = null;
                this.connected = false;
            }
        };
        coordinator.onClosed = () => {
            if (this.coordinator !== coordinator) return;
            const endedGuestRun = this.isGuest && this.game.running;
            const abortedHostStart = (
                this.isHost &&
                !this.connected &&
                this.game.running
            );
            const signaling = this.signaling;
            this.releasePeerState();
            try {
                signaling?.disconnect();
            } catch {
                // Local state is already released; teardown cannot escape.
            }
            if (endedGuestRun) this.endGuestSession();
            if (abortedHostStart) this.endPendingHostSession();
        };
    }

    configureClient(client) {
        client.onFullResync = (state, message) => {
            if (!this.replicator.applyFullState(state, message.tick)) {
                this.onStatus?.('invalid_resync');
                return;
            }
            this.applyRemoteAbilityState(state);
            this.cancelGuestReadyTimeout();
            this.resumeToken = client.resumeToken;
            this.connected = true;
            this.noteGuestActivity();
            this.onReady?.({ role: 'guest', state });
        };
        client.onSnapshot = (state, message) => {
            if (!this.replicator.applySnapshot(state, message.tick)) {
                client.requestResync();
                return;
            }
            this.applyRemoteAbilityState(state);
            this.noteGuestActivity();
        };
        client.onEvent = event => {
            if (event.eventType === 'room_state') {
                this.onStatus?.('room_state', event.payload);
            }
        };
        client.onActivity = message => {
            if (message.type === 'ping') this.noteGuestActivity();
        };
        client.onError = error => {
            this.onStatus?.('peer_error', error.message);
        };
    }

    sendInput(input) {
        if (!this.isGuest || !this.client?.connected) return false;
        return this.client.sendInput(input);
    }

    sendFireIntent(active, aimAngle) {
        if (!this.isGuest || !this.client?.connected) return false;
        const intent = `${active}:${aimAngle.toFixed(4)}`;
        if (intent === this.lastFireIntent) return false;
        const sent = this.client.requestAction('shoot', {
            active,
            aimAngle
        });
        if (sent) this.lastFireIntent = intent;
        return sent;
    }

    sendAbility(abilityId, aimAngle) {
        if (
            !this.isGuest ||
            !this.client?.connected ||
            !['blink', 'decoy', 'stealth', 'emp'].includes(abilityId) ||
            !Number.isFinite(aimAngle)
        ) {
            return false;
        }
        return this.sendOrQueueAction('ability', {
            abilityId,
            aimAngle
        });
    }

    sendInteraction(targetKind, targetIndex) {
        if (!this.isGuest || !this.client?.connected) return false;
        return this.sendOrQueueAction('interact', {
            targetKind,
            targetIndex
        });
    }

    sendSalvageSweep() {
        if (!this.isGuest || !this.client?.connected) return false;
        return this.sendOrQueueAction('sweep', {});
    }

    sendShipEdit(parts) {
        if (
            !this.isGuest ||
            !this.client?.connected ||
            !Array.isArray(parts)
        ) {
            return false;
        }
        return this.sendOrQueueAction('ship_edit', {
            parts: parts.map(part => ({ ...part }))
        });
    }

    sendLevelUpChoice(index) {
        if (
            !this.isGuest ||
            !this.client?.connected ||
            !Number.isInteger(index)
        ) {
            return false;
        }
        return this.sendOrQueueAction('level_up', { index });
    }

    beginSharedLevelUp() {
        if (!this.isHost || !this.simulation) return false;
        return this.simulation.beginPeerLevelUps?.(
            ship => this.game.levelUpManager.generateChoices(null, ship)
        ) || false;
    }

    completeLocalLevelUp() {
        if (!this.isHost || !this.simulation) return false;
        const complete = this.simulation.completeHostLevelUp?.() || false;
        this.flushAuthoritativeState();
        return complete;
    }

    sendOrQueueAction(action, payload) {
        if (!this.client?.connected) return false;
        if (this.pendingActions.length === 0) {
            const sent = this.client.requestAction(action, payload);
            if (sent) return sent;
        }
        if (this.pendingActions.length >= MAX_PENDING_ACTIONS) return false;
        this.pendingActions.push({ action, payload });
        return true;
    }

    flushPendingActions() {
        if (!this.isGuest || !this.client?.connected) return false;
        let sent = false;
        while (this.pendingActions.length > 0) {
            const next = this.pendingActions[0];
            if (!this.client.requestAction(next.action, next.payload)) break;
            this.pendingActions.shift();
            sent = true;
        }
        return sent;
    }

    sendShoot() {
        // Peer guests send fire intent from the frame input path. Legacy shot
        // packets with client-authored muzzle coordinates are never forwarded.
        return false;
    }

    sendEnemyHit() {
        return false;
    }

    sendJoinGame() {
        return false;
    }

    updateHost(dt) {
        if (this.isHost) this.coordinator?.update(dt);
    }

    updatePeerRecovery(dt, levelBonus) {
        if (!this.isHost) return;
        this.simulation?.recoverPeers?.(dt, levelBonus);
    }

    flushAuthoritativeState() {
        if (!this.isHost) return false;
        return this.authority?.flushSnapshots?.() || false;
    }

    flushAuthoritativeFullState() {
        if (!this.isHost) return false;
        return this.authority?.flushFullResyncs?.() || false;
    }

    updateGuest(dt) {
        if (!this.isGuest) return;
        for (const player of this.otherPlayers.values()) {
            player.update?.(dt);
        }
        this.flushPendingActions();
    }

    applyRemoteAbilityState(state) {
        if (!state?.players || !this.game.abilitySystem) return;
        const self = state.players.find(player => player.id === state.self);
        if (!self) return;
        this.game.abilitySystem.restoreShipState(this.game.playerShip, {
            cooldowns: self.abilityCooldowns,
            stealthTimer: self.stealthTimer
        });
    }

    disconnect() {
        const coordinator = this.coordinator;
        const signaling = this.signaling;
        try {
            coordinator?.disconnect('network_closed');
        } catch {
            // Cleanup must continue even if a half-built coordinator is broken.
        }
        try {
            signaling?.disconnect();
        } catch {
            // Always release the local facade after signaling cleanup fails.
        }
        this.releasePeerState();
    }

    failStart(error) {
        this.disconnect();
        this.onStatus?.('error', peerStartError(error));
        return false;
    }

    armGuestReadyTimeout(peerId) {
        this.cancelGuestReadyTimeout();
        if (
            !this.isGuest ||
            !peerId ||
            this.guestReadyTimeoutMs <= 0
        ) {
            return false;
        }
        const coordinator = this.coordinator;
        const timer = this.scheduleTimeout(() => {
            if (this.guestReadyTimer !== timer) return;
            this.guestReadyTimer = null;
            if (
                this.coordinator !== coordinator ||
                !this.isGuest ||
                this.connected
            ) {
                return;
            }
            coordinator?.failPeer?.(
                peerId,
                new Error('authoritative session timed out')
            );
        }, this.guestReadyTimeoutMs);
        this.guestReadyTimer = timer;
        return true;
    }

    cancelGuestReadyTimeout() {
        if (this.guestReadyTimer === null) return;
        this.cancelTimeout(this.guestReadyTimer);
        this.guestReadyTimer = null;
    }

    noteGuestActivity() {
        if (!this.connected || !this.guestHostPeerId) return false;
        return this.armGuestLivenessTimeout(this.guestHostPeerId);
    }

    armGuestLivenessTimeout(peerId) {
        this.cancelGuestLivenessTimeout();
        if (
            !this.isGuest ||
            !peerId ||
            this.guestLivenessTimeoutMs <= 0
        ) {
            return false;
        }
        const coordinator = this.coordinator;
        const timer = this.scheduleTimeout(() => {
            if (this.guestLivenessTimer !== timer) return;
            this.guestLivenessTimer = null;
            if (
                this.coordinator !== coordinator ||
                !this.isGuest ||
                !this.connected
            ) {
                return;
            }
            coordinator?.failPeer?.(
                peerId,
                new Error('host stopped responding')
            );
        }, this.guestLivenessTimeoutMs);
        this.guestLivenessTimer = timer;
        return true;
    }

    cancelGuestLivenessTimeout() {
        if (this.guestLivenessTimer === null) return;
        this.cancelTimeout(this.guestLivenessTimer);
        this.guestLivenessTimer = null;
    }

    releasePeerState() {
        this.cancelGuestReadyTimeout();
        this.cancelGuestLivenessTimeout();
        this.coordinator = null;
        this.signaling = null;
        this.simulation = null;
        this.authority = null;
        this.replicator = null;
        this.client = null;
        this.connected = false;
        this.lastFireIntent = null;
        this.pendingActions = [];
        this.guestHostPeerId = null;
        this.role = null;
        if (this.game.network === this) {
            this.game.network = this.game.networkManager;
        }
    }

    endGuestSession() {
        this.game.running = false;
        this.game.paused = false;
        this.game.isSpectating = false;
        this.game.pauseMenu?.hide?.();
        this.game.loop?.stop?.();
        this.game.audio?.stopMusic?.();
        this.game.mainMenu?.show?.();
        this.onStatus?.('host_left');
    }

    endPendingHostSession() {
        this.game.running = false;
        this.game.paused = false;
        this.game.isSpectating = false;
    }
}

function peerStartError(error) {
    const message = typeof error?.message === 'string'
        ? error.message
        : 'online session startup failed';
    return message.slice(0, 200);
}

function scheduleDeadline(callback, delay) {
    const handle = setTimeout(callback, delay);
    handle?.unref?.();
    return handle;
}
