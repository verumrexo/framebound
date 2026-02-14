
import { HighScoreManager } from '../systems/HighScoreManager.js';
import { SaveManager } from '../systems/SaveManager.js';
import { CHANGELOG } from '../../version.js';
import { Settings } from '../systems/Settings.js';

export class MainMenu {
    constructor(game) {
        this.game = game;
        this.overlay = null;
    }

    show() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.id = 'main-menu';
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

        const hasSave = SaveManager.hasSave();

        // Build start button(s) based on save state
        let startButtons;
        if (hasSave) {
            startButtons = `
                <button id="btn-continue" class="menu-btn start-btn">continue operation</button>
                <button id="btn-new" class="menu-btn start-btn">initiate new run</button>
                <button id="btn-seed" class="menu-btn start-btn">inject custom seed</button>
            `;
        } else {
            startButtons = `
                <button id="btn-start" class="menu-btn start-btn">launch mission</button>
                <button id="btn-seed" class="menu-btn start-btn">inject custom seed</button>
            `;
        }

        this.overlay.innerHTML = `
            <h1 style="
                font-family: 'Press Start 2P', cursive;
                font-size: 64px;
                color: #00ffff;
                margin: 0 0 30px 0;
                text-shadow: 4px 4px 0px #005555, 0 0 20px rgba(0,255,255,0.6);
                font-weight: normal;
                line-height: 1.2;
                letter-spacing: -2px;
                text-transform: lowercase;
            ">framebound:uplink</h1>
            <p style="color: #666; font-size: 16px; margin-bottom: 60px; text-transform: lowercase; letter-spacing: 4px;">${this.game.version} // ${this.game.versionName}</p>
            <div id="loading-text" style="color: #ffd700; font-size: 16px; display: none;">initializing systems...</div>

            <div style="display: flex; flex-direction: column; gap: 25px; width: 400px;">
                ${startButtons}
                <button id="btn-settings" class="menu-btn">system settings</button>
                <button id="btn-leaderboard" class="menu-btn">global rankings</button>
                <button id="btn-changelog" class="menu-btn">patch notes</button>
            </div>

            <style>
                .menu-btn {
                    position: relative;
                    padding: 16px 0;
                    font-size: 16px;
                    background: rgba(0, 20, 30, 0.6);
                    border: 1px solid rgba(0, 255, 255, 0.2);
                    color: #acc;
                    cursor: pointer;
                    font-family: 'Press Start 2P', cursive;
                    text-transform: lowercase;
                    letter-spacing: 4px;
                    transition: all 0.2s ease-out;
                    overflow: hidden;
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                    backdrop-filter: blur(5px);
                }

                .menu-btn::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0;
                    width: 4px;
                    height: 100%;
                    background: #00ffff;
                    transform: scaleY(0);
                    transition: transform 0.2s ease-out;
                    transform-origin: bottom;
                }

                .menu-btn:hover {
                    background: rgba(0, 40, 60, 0.8);
                    color: #fff;
                    border-color: rgba(0, 255, 255, 0.6);
                    padding-left: 20px;
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.1);
                    text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
                }

                .menu-btn:hover::before {
                    transform: scaleY(1);
                    transform-origin: top;
                }

                /* Specific Button Accents on Hover (Optional, or distinct theming) */
                #btn-continue:hover { border-color: #0f0; box-shadow: 0 0 20px rgba(0, 255, 0, 0.2); }
                #btn-continue:hover::before { background: #0f0; }

                #btn-new:hover { border-color: #f00; box-shadow: 0 0 20px rgba(255, 0, 0, 0.2); }
                #btn-new:hover::before { background: #f00; }

                #btn-seed:hover { border-color: #0ff; box-shadow: 0 0 20px rgba(0, 255, 255, 0.2); }
                #btn-seed:hover::before { background: #0ff; }
            </style>
        `;

        // Attach Listeners
        setTimeout(() => {
            const btnStart = document.getElementById('btn-start');
            const btnContinue = document.getElementById('btn-continue');
            const btnNew = document.getElementById('btn-new');
            const btnSettings = document.getElementById('btn-settings');
            const btnLeaderboard = document.getElementById('btn-leaderboard');
            const btnChange = document.getElementById('btn-changelog');
            const btnSeed = document.getElementById('btn-seed');

            if (btnStart) btnStart.onclick = () => this.startGame();
            if (btnContinue) btnContinue.onclick = () => this.continueGame();
            if (btnNew) btnNew.onclick = () => this.startNewGame();
            if (btnSettings) btnSettings.onclick = () => this.renderSettings();
            if (btnLeaderboard) btnLeaderboard.onclick = () => this.renderLeaderboard();
            if (btnChange) btnChange.onclick = () => this.renderChangelog();
            if (btnSeed) btnSeed.onclick = () => this.renderSeedInput();
        }, 0);
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
                        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'RUN'].map(key => `
                            <button class="keypad-btn" style="
                                background: rgba(0, 55, 55, 0.5);
                                border: 1px solid #00ffff;
                                color: #00ffff;
                                padding: 20px;
                                font-family: 'Press Start 2P';
                                font-size: 14px;
                                cursor: pointer;
                                width: 90px;
                                text-align: center;
                            " onclick="window.game.mainMenu.handleSeedKey('${key}')">${key}</button>
                        `).join('')}
                    </div>

                    <button id="btn-seed-back" class="menu-btn" style="background: transparent; border: none; color: #666; font-size: 12px; margin-top: 10px;">[abort_injection]</button>
                </div>
            `;

            setTimeout(() => {
                const back = document.getElementById('btn-seed-back');
                if (back) back.onclick = () => this.renderMenu();
            }, 0);
        };

        this.handleSeedKey = (key) => {
            if (key === 'C') {
                this.currentSeedInput = "";
            } else if (key === 'RUN') {
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

    startSeededGame(seed) {
        // Clear existing save
        SaveManager.clearSave();
        this.game.hasPendingSave = false;

        // Initialize level with seed
        this.game.initLevel(seed);

        this.startGame();
    }

    renderSettings() {
        if (!this.overlay) return;
        this.game.settings.render(this.overlay, () => this.renderMenu());
    }


    renderChangelog() {
        if (!this.overlay) return;

        const changes = CHANGELOG;

        let html = `
            <h2 style="color: #888; margin-bottom: 40px; font-size: 24px;">changelog</h2>
            <div style="
                max-height: 400px; 
                overflow-y: auto; 
                width: 600px; 
                text-align: left; 
                margin-bottom: 40px;
                padding-right: 20px;
            ">
        `;

        changes.forEach(c => {
            html += `
                <div style="margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; color: #00ffff; margin-bottom: 10px; border-bottom: 1px solid #333; align-items: baseline;">
                        <span style="font-size: 16px;">${c.ver}${c.name ? ' // ' + c.name : ''}</span>
                        <span style="font-size: 10px; color: #666;">${c.date}</span>
                    </div>
                    <ul style="color: #aaa; list-style-type: square; padding-left: 20px; font-size: 12px; line-height: 1.4;">
                        ${(c.changes || c.items || []).map(i => `<li style="margin-bottom: 5px;">${i}</li>`).join('')}
                    </ul>
                </div>
            `;
        });

        html += `</div>
            <button id="btn-back" class="menu-btn" style="background: transparent; color: white; border: 1px solid #fff; width: 200px;">back</button>
        `;

        this.overlay.innerHTML = html;

        setTimeout(() => {
            document.getElementById('btn-back').onclick = () => this.renderMenu();
        }, 0);
    }

    async renderLeaderboard() {
        if (!this.overlay) return;

        // Show loading state
        this.overlay.innerHTML = `
            <h2 style="color: #ffff00; margin-bottom: 40px; font-size: 32px; text-shadow: 0 0 10px #ffff00;">high scores</h2>
            <p style="color: #888; font-size: 16px;">loading global leaderboard...</p>
        `;

        const scores = await HighScoreManager.getHighScores();

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
                        <span style="color: white; font-size: 16px; flex: 1;">${score.name}</span>
                        <span style="color: #ffff00; font-size: 16px; font-weight: bold;">${score.score}</span>
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

    startGame() {
        // Unlock Audio
        if (this.game.audio.context.state === 'suspended') {
            this.game.audio.context.resume();
        }

        // Start Loop
        this.game.loop.start();
        this.game.audio.playMusic('bgm', 0.4);

        // Fade Out
        this.overlay.style.opacity = '0';
        setTimeout(() => {
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
            }
        }, 500);
    }

    continueGame() {
        // Unlock Audio
        if (this.game.audio.context.state === 'suspended') {
            this.game.audio.context.resume();
        }

        // Load save data
        this.game.loadFromSave();

        // Start Loop
        this.game.loop.start();
        this.game.audio.playMusic('bgm', 0.4);

        // Fade Out
        this.overlay.style.opacity = '0';
        setTimeout(() => {
            this.overlay.remove();
            this.overlay = null;
        }, 500);
    }

    startNewGame() {
        // Clear existing save
        SaveManager.clearSave();
        this.game.hasPendingSave = false;

        // Unlock Audio
        if (this.game.audio.context.state === 'suspended') {
            this.game.audio.context.resume();
        }

        // Start Loop
        this.game.loop.start();
        this.game.audio.playMusic('bgm', 0.4);

        // Fade Out
        this.overlay.style.opacity = '0';
        setTimeout(() => {
            this.overlay.remove();
            this.overlay = null;
        }, 500);
    }
}
