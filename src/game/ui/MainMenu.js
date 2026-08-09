
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
        const firstUtilityIndex = hasSave ? 3 : 2;
        const menuIndex = offset => String(firstUtilityIndex + offset).padStart(2, '0');

        // Build start button(s) based on save state
        let localButtons;
        if (hasSave) {
            localButtons = `
                <button id="btn-continue" class="menu-btn start-btn" data-index="01">continue sortie</button>
                <button id="btn-new" class="menu-btn start-btn" data-index="02">new sortie</button>
            `;
        } else {
            localButtons = `
                <button id="btn-start" class="menu-btn start-btn" data-index="01">new sortie</button>
            `;
        }

        this.overlay.innerHTML = `
            <main class="ui-shell main-menu-screen">
                <section class="ui-brand-panel">
                    <div>
                        <div class="ui-kicker">independent frame operations</div>
                        <h1 class="main-menu-title">framebound<span>uplink</span></h1>
                        <p class="main-menu-version">build ${this.game.version} // ${this.game.versionName}</p>
                        <div id="loading-text" class="main-menu-loading">initializing systems...</div>
                    </div>
                    <div class="ui-command-rail">
                        combat frame authorization terminal<br>
                        pilot link // nominal
                    </div>
                </section>
                <div class="main-menu-actions">
                    <div class="ui-section-code">sortie selection // 01</div>
                    ${localButtons}
                    <button id="btn-online" class="menu-btn start-btn" data-index="${menuIndex(0)}">online play</button>
                    <button id="btn-seed" class="menu-btn start-btn" data-index="${menuIndex(1)}">custom seed</button>
                    <button id="btn-settings" class="menu-btn" data-index="${menuIndex(2)}">system settings</button>
                    <button id="btn-leaderboard" class="menu-btn" data-index="${menuIndex(3)}">global rankings</button>
                    <button id="btn-changelog" class="menu-btn" data-index="${menuIndex(4)}">patch notes</button>
                </div>
            </main>
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
            <main class="ui-screen online-screen">
                <header class="ui-screen-header">
                    <div>
                        <div class="ui-kicker">peer uplink // direct session</div>
                        <h2 class="ui-screen-title">online play</h2>
                    </div>
                    <div id="peer-status" class="ui-status ${signalingReady ? '' : 'ui-status-error'}">${signalingReady
                        ? 'host a run or enter a six-character join code'
                        : 'online unavailable: signaling service is not configured in this build'
                    }</div>
                </header>

                <div class="online-grid">
                    <section class="ui-panel ui-panel-accent">
                        <div class="ui-section-code">host protocol // 01</div>
                        <div class="ui-panel-title">host game</div>
                        <div class="ui-panel-copy">
                        your game runs the session. send the code to a friend.
                        </div>
                        <button id="btn-peer-host" class="menu-btn" data-index="a"
                            ${signalingReady ? '' : 'disabled'}>create code</button>
                        <div id="peer-host-code" class="peer-code"></div>
                    </section>

                    <section class="ui-panel">
                        <div class="ui-section-code">guest protocol // 02</div>
                        <div class="ui-panel-title">join game</div>
                        <div class="ui-panel-copy">
                        enter the code from the host. no ip address bullshit.
                        </div>
                        <input id="input-peer-code" class="ui-text-input peer-code" type="text" maxlength="6"
                            ${signalingReady ? '' : 'disabled'}
                            autocomplete="off" spellcheck="false" aria-label="join code">
                        <button id="btn-peer-join" class="menu-btn" data-index="b" disabled>join host</button>
                    </section>
                </div>

                <footer class="online-footer">
                    <div class="ui-note">gameplay travels directly between players. signaling only introduces the connection.</div>
                    <button id="btn-peer-back" class="menu-btn" data-index="esc">back</button>
                </footer>
            </main>
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
                <main class="ui-screen seed-panel">
                    <header class="ui-screen-header">
                        <div>
                            <div class="ui-kicker">world generation override</div>
                            <h2 class="ui-screen-title">custom seed</h2>
                        </div>
                    </header>
                    <div id="seed-display" class="seed-display">${this.currentSeedInput || 'enter-seed'}</div>

                    <div class="seed-keypad">
                        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'c', '0', 'run'].map(key => `
                            <button class="keypad-btn" data-seed-key="${key}">${key}</button>
                        `).join('')}
                    </div>
                    <button id="btn-seed-back" class="menu-btn" data-index="esc">back</button>
                </main>
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
                <div class="changelog-entry">
                    <div class="changelog-entry-header">
                        <span class="changelog-version">${escapeHtml(versionLabel).toLowerCase()}</span>
                        <span class="changelog-date">${escapeHtml(c.date).toLowerCase()}</span>
                    </div>
                    <ul class="changelog-items">
                        ${(c.changes || c.items || []).map(i => `
                            <li>${escapeHtml(i).toLowerCase()}</li>
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
            <main class="ui-screen">
                <header class="ui-screen-header">
                    <h2 class="ui-screen-title">global rankings</h2>
                </header>
                <p class="ui-status">loading global leaderboard...</p>
            </main>
        `;

        const scores = await HighScoreGateway.getHighScores();

        let html = `
            <main class="ui-screen">
                <header class="ui-screen-header">
                    <div>
                        <div class="ui-kicker">sortie archive // global</div>
                        <h2 class="ui-screen-title">global rankings</h2>
                    </div>
                </header>
                <div class="leaderboard-list">
        `;

        if (scores.length === 0) {
            html += `<p class="ui-status">no scores yet. be the first.</p>`;
        } else {
            scores.forEach((score, index) => {
                const rank = index + 1;
                const rankLabel = String(rank).padStart(2, '0');
                const color = rank === 1 ? '#c99b55' : rank === 2 ? '#b6b7af' : rank === 3 ? '#9a7251' : '#777b74';

                html += `
                    <div class="leaderboard-row" style="--rank-color: ${color}">
                        <span class="leaderboard-rank">${rankLabel}</span>
                        <span>${escapeHtml(score.name).toLowerCase()}</span>
                        <span class="leaderboard-score">${escapeHtml(score.score)}</span>
                    </div>
                `;
            });
        }

        html += `
                </div>
                <footer class="ui-screen-footer">
                    <div class="ui-note">ranking data // verified uplink</div>
                    <button id="btn-back" class="menu-btn" data-index="esc">back</button>
                </footer>
            </main>
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
