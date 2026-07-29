import { PeerConnectionCoordinator } from '../../engine/PeerConnectionCoordinator.js';
import { SocketIOSignalingClient } from '../../engine/SocketIOSignalingClient.js';
import { HostAuthoritySession } from '../../shared/multiplayer/HostAuthoritySession.js';
import { PeerSessionClient } from '../../shared/multiplayer/PeerSessionClient.js';

export function runPeerSessionSmoke(
    role,
    code = null,
    resumeToken = null
) {
    report({ role, status: 'starting', code });
    const signaling = new SocketIOSignalingClient();
    const cleanups = [];
    let coordinator;

    if (role === 'host') {
        const simulation = createSmokeSimulation();
        const authority = new HostAuthoritySession(simulation);
        coordinator = new PeerConnectionCoordinator({
            signaling,
            hostSession: authority
        });
        bindCoordinatorReports(coordinator, role, () => coordinator.code);
        coordinator.onHosted = session => {
            report({
                role,
                status: 'hosted',
                code: session.code
            });
        };
        coordinator.onConnected = () => {
            report({
                role,
                status: 'peer_connected',
                code: coordinator.code,
                suspended: authority.suspendedPeers.size
            });
        };
        coordinator.onDisconnected = () => {
            report({
                role,
                status: 'peer_disconnected',
                code: coordinator.code,
                suspended: authority.suspendedPeers.size
            });
        };
        const timer = setInterval(() => coordinator.update(0.05), 50);
        cleanups.push(() => clearInterval(timer));
        coordinator.host();
    } else {
        coordinator = new PeerConnectionCoordinator({
            signaling,
            createClient: transport => {
                const client = new PeerSessionClient(transport, {
                    resumeToken
                });
                client.onFullResync = () => {
                    report({
                        role,
                        status: 'resynced',
                        code,
                        peerId: client.peerId,
                        resumeToken: client.resumeToken
                    });
                    client.sendInput({
                        up: false,
                        down: false,
                        left: false,
                        right: true,
                        shift: false
                    });
                };
                client.onSnapshot = state => {
                    const self = state.players?.find(player =>
                        player.id === state.self
                    );
                    if (self?.x > 0) {
                        report({
                            role,
                            status: 'round_trip',
                            code,
                            x: self.x,
                            peerId: client.peerId,
                            resumeToken: client.resumeToken
                        });
                    }
                };
                return client;
            }
        });
        bindCoordinatorReports(coordinator, role, () => code);
        if (!coordinator.join(code)) {
            report({ role, status: 'invalid_code', code });
        }
    }

    const cleanup = () => {
        for (const dispose of cleanups) dispose();
        coordinator.disconnect('smoke_closed');
        signaling.disconnect();
    };
    window.addEventListener('beforeunload', cleanup, { once: true });
    return { coordinator, cleanup };
}

function bindCoordinatorReports(coordinator, role, getCode) {
    coordinator.onStatus = (status, detail) => {
        report({
            role,
            status,
            code: getCode(),
            detail: detail == null ? undefined : String(detail)
        });
    };
    coordinator.onClosed = ({ reason }) => {
        report({
            role,
            status: 'closed',
            code: getCode(),
            reason
        });
    };
    coordinator.onPeerState = ({ peerId, state }) => {
        report({
            role,
            status: 'peer_state',
            code: getCode(),
            peerId,
            state
        });
    };

    const signaling = coordinator.signaling;
    const sendSignal = signaling.sendSignal.bind(signaling);
    signaling.sendSignal = (peerId, signal) => {
        report({
            role,
            status: 'signal_sent',
            code: getCode(),
            peerId,
            signal: signalType(signal)
        });
        return sendSignal(peerId, signal);
    };
    const receiveSignal = signaling.onSignal;
    signaling.onSignal = data => {
        report({
            role,
            status: 'signal_received',
            code: getCode(),
            peerId: data.fromId,
            signal: signalType(data.signal)
        });
        return receiveSignal(data);
    };
}

function signalType(signal) {
    if (signal?.description?.type) return signal.description.type;
    const candidate = signal?.candidate?.candidate;
    if (typeof candidate === 'string') {
        const type = candidate.match(/\btyp\s+(\w+)/)?.[1] || 'unknown';
        const protocol = candidate.split(/\s+/)[2] || 'unknown';
        return `candidate:${type}:${protocol}`;
    }
    return signal?.candidate ? 'candidate' : 'unknown';
}

function createSmokeSimulation() {
    const players = new Map();
    return {
        addPeer(connectionId) {
            players.set(connectionId, {
                id: connectionId,
                x: 0,
                input: {}
            });
            return { playerId: connectionId };
        },
        removePeer(playerId) {
            players.delete(playerId);
        },
        suspendPeer() {
            return true;
        },
        resumePeer() {
            return true;
        },
        applyInput(playerId, input) {
            const player = players.get(playerId);
            if (player) player.input = input;
        },
        requestAction() {
            return false;
        },
        step(dt) {
            for (const player of players.values()) {
                if (player.input.right) player.x += 100 * dt;
            }
        },
        snapshotFor(playerId) {
            return {
                self: playerId,
                players: [...players.values()].map(player => ({
                    id: player.id,
                    x: player.x
                }))
            };
        },
        fullStateFor(playerId) {
            return this.snapshotFor(playerId);
        }
    };
}

function report(state) {
    const raw = JSON.stringify(state);
    document.documentElement.dataset.peerSession = raw;
    const invoke = window.__TAURI__?.core?.invoke;
    if (typeof invoke === 'function') {
        invoke('write_peer_smoke_report', { raw }).catch(error => {
            console.error('[peer smoke] report failed:', error);
        });
    }
}
