
import { HighScoreManager } from '../systems/HighScoreManager.js';
import { SaveManager } from '../systems/SaveManager.js';

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
            z-index: 2000;
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
            `;
        } else {
            startButtons = `
                <button id="btn-start" class="menu-btn start-btn">launch mission</button>
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
            ">framebound</h1>
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

            if (btnStart) btnStart.onclick = () => this.startGame();
            if (btnContinue) btnContinue.onclick = () => this.continueGame();
            if (btnNew) btnNew.onclick = () => this.startNewGame();
            if (btnSettings) btnSettings.onclick = () => this.renderSettings();
            if (btnLeaderboard) btnLeaderboard.onclick = () => this.renderLeaderboard();
            if (btnChange) btnChange.onclick = () => this.renderChangelog();
        }, 0);
    }

    renderSettings() {
        if (!this.overlay) return;

        const masterVol = Math.round(this.game.audio.masterGain.gain.value * 100);
        const musicVol = Math.round(this.game.audio.musicGain.gain.value * 100);
        const sfxVol = Math.round(this.game.audio.sfxGain.gain.value * 100);

        this.overlay.innerHTML = `
            <h2 style="color: #00ffff; margin-bottom: 40px; font-size: 32px; text-shadow: 0 0 10px #00ffff;">settings</h2>
            
            <div style="width: 400px; display: flex; flex-direction: column; gap: 30px;">
                <!-- Master Volume -->
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: white; font-size: 16px;">
                        <span>master volume</span>
                        <span id="val-master">${masterVol}%</span>
                    </div>
                    <input type="range" id="rng-master" min="0" max="100" value="${masterVol}" style="width: 100%; cursor: pointer;">
                </div>

                <!-- Music Volume -->
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: white; font-size: 16px;">
                        <span>music</span>
                        <span id="val-music">${musicVol}%</span>
                    </div>
                    <input type="range" id="rng-music" min="0" max="100" value="${musicVol}" style="width: 100%; cursor: pointer;">
                </div>

                <!-- SFX Volume -->
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: white; font-size: 16px;">
                        <span>sfx</span>
                        <span id="val-sfx">${sfxVol}%</span>
                    </div>
                    <input type="range" id="rng-sfx" min="0" max="100" value="${sfxVol}" style="width: 100%; cursor: pointer;">
                </div>
            </div>

            <button id="btn-back" class="menu-btn" style="background: transparent; color: white; border: 1px solid #fff; width: 200px; margin-top: 40px;">back</button>

            <style>
                input[type=range] {
                    -webkit-appearance: none;
                    background: transparent;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 20px;
                    width: 20px;
                    background: #00ffff;
                    cursor: pointer;
                    margin-top: -8px;
                    box-shadow: 0 0 10px #00ffff;
                }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 4px;
                    cursor: pointer;
                    background: #444;
                }
            </style>
        `;

        // Attach Listeners
        setTimeout(() => {
            const rngMaster = document.getElementById('rng-master');
            const rngMusic = document.getElementById('rng-music');
            const rngSfx = document.getElementById('rng-sfx');

            const valMaster = document.getElementById('val-master');
            const valMusic = document.getElementById('val-music');
            const valSfx = document.getElementById('val-sfx');

            rngMaster.oninput = (e) => {
                const v = parseInt(e.target.value);
                valMaster.innerText = v + '%';
                this.game.audio.setMasterVolume(v / 100);
            };

            rngMusic.oninput = (e) => {
                const v = parseInt(e.target.value);
                valMusic.innerText = v + '%';
                this.game.audio.setMusicVolume(v / 100);
            };

            rngSfx.oninput = (e) => {
                const v = parseInt(e.target.value);
                valSfx.innerText = v + '%';
                this.game.audio.setSfxVolume(v / 100);
                // Play a test sound if we had a simple blip, but maybe just changing volume is fine
            };

            document.getElementById('btn-back').onclick = () => this.renderMenu();
        }, 0);
    }


    renderChangelog() {
        if (!this.overlay) return;

        const changes = [
            {
                ver: "v0.3.1",
                date: "2026-01-23",
                items: [
                    "- hotfix: edge browser performance (outline caching)"
                ]
            },
            {
                ver: "v0.3.0",
                date: "2026-01-21",
                items: [
                    "- new 'settings' menu (audio controls)",
                    "- visual overhaul (glass UI & animations)",
                    "- font update (press start 2p)",
                    "- live text logo implementation"
                ]
            },
            {
                ver: "v0.2.2.3",
                date: "2026-01-20",
                items: [
                    "- advanced dev tools (spawn, place, infinite)",
                    "- physics lag fix (dt capping)",
                    "- collision optimization",
                    "- updated chest visuals",
                    "- unified L-key menu"
                ]
            },
            {
                ver: "v0.2.2.1",
                date: "2026-01-19",
                items: [
                    "- fixed vault reward logic (payment & fight required)",
                    "- fixed vault ambush infinite wave crash",
                    "- fixed chest sprite definition crash",
                    "- updated chest visuals",
                    "- added debug 'I' button for nukes"
                ]
            },
            {
                ver: "v0.2.2",
                date: "2026-01-19",
                items: [
                    "- high score system with name entry",
                    "- leaderboard in main menu",
                    "- score display on HUD",
                    "- points for kills and room clears",
                    "- size-based rarity system (common/rare/epic)",
                    "- rarity color coding in tooltips"
                ]
            },
            {
                ver: "v0.2.1",
                date: "2026-01-18",
                items: [
                    "- mobile controls (virtual joysticks)",
                    "- update starting ship",
                    "- network host enabled"
                ]
            },
            {
                ver: "v0.2.0",
                date: "2026-01-18", items: ["curséd vaults room", "audio system update", "ui visual overhaul", "deployment system"]
            },
            { ver: "v0.1.5", date: "2026-01-15", items: ["shop room added", "treasure room added"] },
            { ver: "v0.1.0", date: "2026-01-10", items: ["core flight physics", "asteroid fields", "basic combat"] }
        ];

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
                    <div style="display: flex; justify-content: space-between; color: #00ffff; margin-bottom: 10px; border-bottom: 1px solid #333;">
                        <span>${c.ver}</span>
                        <span>${c.date}</span>
                    </div>
                    <ul style="color: #aaa; list-style-type: square; padding-left: 20px;">
                        ${c.items.map(i => `<li style="margin-bottom: 5px;">${i}</li>`).join('')}
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
