
import { HighScoreGateway } from '../systems/HighScoreGateway.js';
import { SaveManager } from '../systems/SaveManager.js';
import { CHANGELOG } from '../../version.js';
import { Settings } from '../systems/Settings.js';
import { APP_CONFIG } from '../../engine/AppConfig.js';
import { escapeHtml } from './html.js';

export class MainMenu {
    constructor(game) {
        this.game = game;
        this.overlay = null;
        this.peerStartPending = false;
    }

    show() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.id = 'main-menu';
        this.overlay.className = 'main-menu-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            font-family: 'Press Start 2P', cursive;
            color: white;
            transition: opacity 0.5s;
        `;

        // Render Initial Menu
        this.renderMenu();
        document.body.appendChild(this.overlay);

        // Wait for assets (if loading)
        if (this.game.loadingPromise) {
            const btns = document.querySelectorAll('.start-btn');
            const loading = document.getElementById('loading-text');
            btns.forEach(btn => btn.style.display = 'none');
            if (loading) loading.style.display = 'block';

            this.game.loadingPromise.then(() => {
                const btns = document.querySelectorAll('.start-btn');
                const loading = document.getElementById('loading-text');
                if (loading) loading.style.display = 'none';
                btns.forEach(btn => btn.style.display = 'block');
            });
        }
    }

    renderMenu() {
        if (!this.overlay) return;
        this.game.gameSettings?.stopUpdating();

        const hasSave = SaveManager.hasSave();

        // Build start button(s) based on save state
        let localButtons;
        if (hasSave) {
            localButtons = `
                <button id="btn-continue" class="menu-btn start-btn">local: continue</button>
                <button id="btn-new" class="menu-btn start-btn">local: new run</button>
            `;
        } else {
            localButtons = `
                <button id="btn-start" class="menu-btn start-btn">local: new run</button>
            `;
        }

        this.overlay.innerHTML = `
            <div class="main-menu-screen">
                <h1 class="main-menu-title">framebound:uplink</h1>
                <p class="main-menu-version">${this.game.version} // ${this.game.versionName}</p>
                <div id="loading-text" class="main-menu-loading">initializing systems...</div>

                <div class="main-menu-actions">
                    ${localButtons}
                    <button id="btn-online" class="menu-btn start-btn" style="border-color: #ffaa00; color: #ffddaa;">online play</button>
                    <button id="btn-seed" class="menu-btn start-btn">inject custom seed</button>
                    <button id="btn-settings" class="menu-btn">system settings</button>
                    <button id="btn-leaderboard" class="menu-btn">global rankings</button>
                    <button id="btn-changelog" class="menu-btn">patch notes</button>
                </div>
            </div>
        `;

        setTimeout(() => {
            const btnStart = document.getElementById('btn-start');
            const btnContinue = document.getElementById('btn-continue');
            const btnNew = document.getElementById('btn-new');
            const btnOnline = document.getElementById('btn-online');
            const btnSettings = document.getElementById('btn-settings');
            const btnLeaderboard = document.getElementById('btn-leaderboard');
            const btnChange = document.getElementById('btn-changelog');
            const btnSeed = document.getElementById('btn-seed');

            if (btnStart) btnStart.onclick = () => this.startNewGame();
            if (btnContinue) btnContinue.onclick = () => this.continueGame();
            if (btnNew) btnNew.onclick = () => this.startNewGame();
            if (btnOnline) btnOnline.onclick = () => this.renderOnlinePlay();
            if (btnSettings) btnSettings.onclick = () => this.renderSettings();
            if (btnLeaderboard) btnLeaderboard.onclick = () => this.renderLeaderboard();
            if (btnChange) btnChange.onclick = () => this.renderChangelog();
            if (btnSeed) btnSeed.onclick = () => this.renderSeedInput();
        }, 0);
    }

    renderOnlinePlay() {
        if (!this.overlay) return;
        const signalingReady = Boolean(APP_CONFIG.signalingUrl);

        this.overlay.innerHTML = `
            <h2 style="color: #ffaa00; margin-bottom: 24px; font-size: 24px;">
                online play
            </h2>
            <div id="peer-status" style="
                color: ${signalingReady ? '#888' : '#ff6666'};
                font-size: 11px;
                line-height: 1.8;
                text-align: center;
                min-height: 40px;
                max-width: 620px;
                margin-bottom: 24px;
            ">${signalingReady
                ? 'host a run or enter a six-character join code'
                : 'online unavailable: signaling service is not configured in this build'
            }</div>

            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
                width: 620px;
                margin-bottom: 28px;
            ">
                <div style="
                    border: 1px solid #665522;
                    background: rgba(40, 25, 0, 0.45);
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                ">
                    <div style="color: #ffcc66; font-size: 13px;">host game</div>
                    <div style="color: #777; font-size: 9px; line-height: 1.8;">
                        your game runs the session. send the code to a friend.
                    </div>
                    <button id="btn-peer-host" class="menu-btn"
                        ${signalingReady ? '' : 'disabled'}
                        style="font-size: 11px;">create code</button>
                    <div id="peer-host-code" style="
                        color: #00ffff;
                        font-size: 28px;
                        letter-spacing: 8px;
                        min-height: 34px;
                        text-align: center;
                    "></div>
                </div>

                <div style="
                    border: 1px solid #225566;
                    background: rgba(0, 25, 40, 0.45);
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                ">
                    <div style="color: #66ddff; font-size: 13px;">join game</div>
                    <div style="color: #777; font-size: 9px; line-height: 1.8;">
                        enter the code from the host. no ip address bullshit.
                    </div>
                    <input id="input-peer-code" type="text" maxlength="6"
                        ${signalingReady ? '' : 'disabled'}
                        autocomplete="off" spellcheck="false" style="
                            background: #001018;
                            border: 1px solid #447788;
                            color: white;
                            padding: 14px;
                            font-family: 'Press Start 2P';
                            text-transform: uppercase;
                            text-align: center;
                            letter-spacing: 6px;
                            font-size: 16px;
                        ">
                    <button id="btn-peer-join" class="menu-btn" disabled
                        style="font-size: 11px;">join host</button>
                </div>
            </div>

            <div style="
                color: #555;
                font-size: 8px;
                line-height: 1.8;
                text-align: center;
                width: 620px;
                margin-bottom: 24px;
            ">
                gameplay travels directly between players. the tiny signaling
                service only introduces the connection.
            </div>

            <button id="btn-peer-back" class="menu-btn" style="width: 200px;">
                back
            </button>
        `;

        this.bindPeerCallbacks();
        setTimeout(() => {
            const host = document.getElementById('btn-peer-host');
            const join = document.getElementById('btn-peer-join');
            const back = document.getElementById('btn-peer-back');
            const input = document.getElementById('input-peer-code');

            if (host) host.onclick = () => this.beginPeerHost();
            if (input && join) {
                input.oninput = () => {
                    const code = input.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 6);
                    input.value = code;
                    join.disabled = code.length !== 6;
                };
                input.onkeydown = event => {
                    if (event.key === 'Enter' && input.value.length === 6) {
                        this.beginPeerJoin(input.value);
                    }
                };
            }
            if (join && input) {
                join.onclick = () => this.beginPeerJoin(input.value);
            }
            if (back) back.onclick = () => this.cancelPeerSession();
        }, 0);
    }

    bindPeerCallbacks() {
        const peer = this.game.peerNetwork;
        if (!peer) return false;

        peer.onStatus = (status, detail) =>
            this.updatePeerStatus(status, detail);
        peer.onHosted = data => this.showHostedCode(data?.code);
        peer.onReady = data => this.completePeerStart(data?.role);
        return true;
    }

    beginPeerHost() {
        const peer = this.game.peerNetwork;
        if (!peer || this.peerStartPending) return false;

        const started = this.game.startOffline?.();
        if (started === false) {
            this.updatePeerStatus('error', 'could not create host run');
            return false;
        }

        this.peerStartPending = true;
        this.game.paused = true;
        this.bindPeerCallbacks();
        this.updatePeerStatus('creating_session');
        const hosting = peer.host();
        if (!hosting) {
            this.peerStartPending = false;
            this.game.paused = false;
            this.game.running = false;
            this.updatePeerStatus('error', 'could not create online session');
        }
        return hosting;
    }

    beginPeerJoin(code) {
        const peer = this.game.peerNetwork;
        if (!peer || this.peerStartPending) return false;

        const cleanCode = typeof code === 'string'
            ? code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
            : '';
        if (cleanCode.length !== 6) {
            this.updatePeerStatus('invalid_code');
            return false;
        }

        this.peerStartPending = true;
        this.bindPeerCallbacks();
        this.updatePeerStatus('joining_session');
        const joining = peer.join(cleanCode);
        if (!joining) this.peerStartPending = false;
        return joining;
    }

    completePeerStart(role) {
        if (!this.peerStartPending) return false;
        this.peerStartPending = false;
        this.game.paused = false;

        if (this.game.audio?.context?.state === 'suspended') {
            this.game.audio.context.resume();
        }
        this.game.loop.start();
        this.game.audio.playMusic('bgm', 0.4);
        this.updatePeerStatus('ready', role);
        this.dismissOverlay();
        return true;
    }

    dismissOverlay() {
        const overlay = this.overlay;
        if (!overlay) return false;

        overlay.style.opacity = '0';
        this.overlay = null;
        setTimeout(() => overlay.remove(), 500);
        return true;
    }

    cancelPeerSession() {
        this.peerStartPending = false;
        this.game.peerNetwork?.disconnect();
        this.game.running = false;
        this.game.paused = false;
        this.renderMenu();
    }

    showHostedCode(code) {
        const target = document.getElementById?.('peer-host-code');
        if (target) target.textContent = typeof code === 'string' ? code : '';
        this.updatePeerStatus('waiting_for_peers');
    }

    updatePeerStatus(status, detail) {
        const target = document.getElementById?.('peer-status');
        if (!target) return;
        const messages = {
            creating_session: 'creating a short join code...',
            waiting_for_peers: 'code ready // waiting for another player',
            joining_session: 'checking join code...',
            connecting_to_host: 'host found // opening direct connection...',
            peer_connecting: 'player found // opening direct connection...',
            connected: 'direct connection established // synchronizing...',
            reconnecting: `connection lost // retry ${detail || 1}`,
            invalid_code: 'that join code is invalid',
            join_timeout: 'join timed out // check the code and try again',
            connection_lost: 'direct connection lost',
            host_left: 'the host left the session',
            invalid_resync: 'host sent an invalid world state',
            peer_error: detail || 'peer protocol error',
            error: detail || 'online connection failed',
            ready: `${detail || 'peer'} synchronized // starting run`
        };
        target.textContent = messages[status] || String(status || 'connecting...');
        target.style.color = [
            'error',
            'peer_error',
            'invalid_code',
            'join_timeout',
            'connection_lost',
            'host_left',
            'invalid_resync'
        ].includes(status) ? '#ff6666' : '#888';
        if ([
            'error',
            'invalid_code',
            'join_timeout',
            'connection_lost'
        ].includes(status)) {
            this.peerStartPending = false;
        }
    }

    renderSeedInput() {
        if (!this.overlay) return;

        this.currentSeedInput = "";

        const renderInput = () => {
            this.overlay.innerHTML = `
                <h2 style="color: #00ffff; margin-bottom: 40px; font-size: 24px; text-transform: lowercase;">manual seed injection</h2>
                <div style="
                    background: rgba(0, 10, 20, 0.9);
                    border: 2px solid #00ffff;
                    padding: 40px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 30px;
                    box-shadow: 0 0 30px rgba(0, 255, 255, 0.2);
                ">
                    <div id="seed-display" style="
                        background: #001111;
                        border: 1px solid #00ffff;
                        padding: 20px;
                        width: 320px;
                        text-align: center;
                        font-size: 24px;
                        color: #fff;
                        min-height: 24px;
                    ">${this.currentSeedInput || 'enter-seed'}</div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'c', '0', 'run'].map(key => `
                            <button class="keypad-btn" data-seed-key="${key}" style="
                                background: rgba(0, 55, 55, 0.5);
                                border: 1px solid #00ffff;
                                color: #00ffff;
                                padding: 20px;
                                font-family: 'Press Start 2P';
                                font-size: 14px;
                                cursor: pointer;
                                width: 90px;
                                text-align: center;
                            ">${key}</button>
                        `).join('')}
                    </div>

                    <button id="btn-seed-back" class="menu-btn" style="background: transparent; border: none; color: #666; font-size: 12px; margin-top: 10px;">[abort_injection]</button>
                </div>
            `;

            setTimeout(() => {
                this.bindSeedControls();
            }, 0);
        };

        this.handleSeedKey = (key) => {
            if (key === 'c') {
                this.currentSeedInput = "";
            } else if (key === 'run') {
                if (this.currentSeedInput.length > 0) {
                    this.startSeededGame(parseInt(this.currentSeedInput));
                }
            } else if (this.currentSeedInput.length < 10) {
                this.currentSeedInput += key;
            }
            renderInput();
        };

        renderInput();
    }

    bindSeedControls() {
        if (!this.overlay) return false;

        const buttons = this.overlay.querySelectorAll?.('[data-seed-key]') || [];
        for (const button of buttons) {
            button.addEventListener('click', () => {
                this.handleSeedKey(button.dataset.seedKey);
            });
        }

        const back = this.overlay.querySelector?.('#btn-seed-back');
        back?.addEventListener('click', () => this.renderMenu());
        return true;
    }

    startSeededGame(seed) {
        // Clear existing save
        SaveManager.clearSave();
        this.game.hasPendingSave = false;

        // Initialize level with seed
        // this.game.initLevel(seed); // Handled in game.startOffline(seed)

        this.startNewGame(seed);
    }

    renderSettings() {
        if (!this.overlay) return;
        this.game.gameSettings.render(this.overlay, () => this.renderMenu());
    }


    renderChangelog() {
        if (!this.overlay) return;

        const changes = CHANGELOG;

        let html = `
            <div class="changelog-screen">
                <h2 class="changelog-title">patch notes</h2>
                <div class="changelog-scroll" tabindex="0" aria-label="patch notes history">
        `;

        changes.forEach(c => {
            const versionLabel = `${c.ver}${c.name ? ' // ' + c.name : ''}`;
            html += `
                <div style="margin-bottom: 30px;">
                    <div style="display: flex; gap: 20px; justify-content: space-between; color: #00ffff; margin-bottom: 10px; border-bottom: 1px solid #333; align-items: baseline;">
                        <span style="font-size: 14px; line-height: 1.5; flex: 1; min-width: 0;">${escapeHtml(versionLabel).toLowerCase()}</span>
                        <span style="font-size: 10px; color: #666; flex-shrink: 0; white-space: nowrap;">${escapeHtml(c.date).toLowerCase()}</span>
                    </div>
                    <ul style="color: #aaa; list-style-type: square; padding-left: 20px; font-size: 12px; line-height: 1.4;">
                        ${(c.changes || c.items || []).map(i => `
                            <li style="margin-bottom: 5px;">${escapeHtml(i).toLowerCase()}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        });

        html += `
                </div>
                <button id="btn-back" class="menu-btn changelog-back">back</button>
            </div>
        `;

        this.overlay.innerHTML = html;

        setTimeout(() => {
            const back = document.getElementById('btn-back');
            const scroll = this.overlay?.querySelector?.('.changelog-scroll');
            if (back) back.onclick = () => this.renderMenu();
            scroll?.focus?.({ preventScroll: true });
        }, 0);
    }

    async renderLeaderboard() {
        if (!this.overlay) return;

        // Show loading state
        this.overlay.innerHTML = `
            <h2 style="color: #ffff00; margin-bottom: 40px; font-size: 32px; text-shadow: 0 0 10px #ffff00;">high scores</h2>
            <p style="color: #888; font-size: 16px;">loading global leaderboard...</p>
        `;

        const scores = await HighScoreGateway.getHighScores();

        let html = `
            <h2 style="color: #ffff00; margin-bottom: 40px; font-size: 32px; text-shadow: 0 0 10px #ffff00;">high scores</h2>
            <div style="
                width: 500px; 
                text-align: left; 
                margin-bottom: 40px;
                background: rgba(0,0,0,0.5);
                padding: 30px;
                border: 2px solid #ffaa00;
            ">
        `;

        if (scores.length === 0) {
            html += `<p style="color: #888; text-align: center; font-size: 16px;">no scores yet. be the first!</p>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 15px;">`;
            scores.forEach((score, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
                const color = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#00ffff';

                html += `
                    <div style="
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center;
                        padding: 10px;
                        background: rgba(255,255,255,0.05);
                        border-left: 3px solid ${color};
                    ">
                        <span style="color: ${color}; font-size: 16px; width: 50px;">${medal}</span>
                        <span style="color: white; font-size: 16px; flex: 1;">${escapeHtml(score.name)}</span>
                        <span style="color: #ffff00; font-size: 16px; font-weight: bold;">${escapeHtml(score.score)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `
            </div>
            <button id="btn-back" class="menu-btn" style="background: transparent; color: white; border: 1px solid #fff; width: 200px;">back</button>
        `;

        this.overlay.innerHTML = html;

        setTimeout(() => {
            document.getElementById('btn-back').onclick = () => this.renderMenu();
        }, 0);
    }

    startGame(isOnline = false) {
        // Unlock Audio
        if (this.game.audio.context.state === 'suspended') {
            this.game.audio.context.resume();
        }

        // Handle Mode (If not online, assume Offline)
        if (!isOnline) {
             if (this.game.startOffline) this.game.startOffline();
             else console.error("Game.startOffline not implemented yet!");
        }

        // Start Loop
        this.game.loop.start();
        this.game.audio.playMusic('bgm', 0.4);

        this.dismissOverlay();
    }

    continueGame() {
        // Unlock Audio
        if (this.game.audio.context.state === 'suspended') {
            this.game.audio.context.resume();
        }

        // The game owns the complete continue pipeline so it cannot create a throwaway world first.
        const continued = this.game.startOffline ?
            this.game.startOffline(undefined, true) :
            false;
        if (continued === false) {
            this.game.hasPendingSave = false;
            this.renderMenu();
            return;
        }

        // Start Loop
        this.game.loop.start();
        this.game.audio.playMusic('bgm', 0.4);

        this.dismissOverlay();
    }

    startNewGame(seed) {
        // Clear existing save
        SaveManager.clearSave();
        this.game.hasPendingSave = false;

        // Unlock Audio
        if (this.game.audio.context.state === 'suspended') {
            this.game.audio.context.resume();
        }

        // Force Offline
        if (this.game.startOffline) this.game.startOffline(seed);

        // Start Loop
        this.game.loop.start();
        this.game.audio.playMusic('bgm', 0.4);

        this.dismissOverlay();
    }
}
