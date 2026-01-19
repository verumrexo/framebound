
import { HighScoreManager } from '../systems/HighScoreManager.js';

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
            font-family: 'VT323', monospace;
            color: white;
            transition: opacity 0.5s;
        `;

        // Render Initial Menu
        this.renderMenu();
        document.body.appendChild(this.overlay);

        // Wait for assets (if loading)
        if (this.game.loadingPromise) {
            const btn = document.getElementById('btn-start');
            const loading = document.getElementById('loading-text');
            if (btn) btn.style.display = 'none';
            if (loading) loading.style.display = 'block';

            this.game.loadingPromise.then(() => {
                const btn = document.getElementById('btn-start');
                const loading = document.getElementById('loading-text');
                if (loading) loading.style.display = 'none';
                if (btn) btn.style.display = 'block';
            });
        }
    }

    renderMenu() {
        if (!this.overlay) return;
        this.overlay.innerHTML = `
            <h1 style="color: #00ffff; font-size: 80px; margin-bottom: 0px; text-shadow: 0 0 20px #00ffff; letter-spacing: -2px;">framebound</h1>
            <p style="color: #666; font-size: 24px; margin-bottom: 60px;">v0.2.2 - curséd vaults</p>

            <div id="loading-text" style="color: #ffd700; font-size: 24px; display: none;">initializing systems...</div>

            <div style="display: flex; flex-direction: column; gap: 20px; width: 300px;">
                <button id="btn-start" class="menu-btn" style="background: #00aaee; color: white;">launch mission</button>
                <button id="btn-leaderboard" class="menu-btn" style="background: transparent; color: #ffaa00; border: 1px solid #ffaa00;">leaderboard</button>
                <button id="btn-changelog" class="menu-btn" style="background: transparent; color: #888; border: 1px solid #444;">changelog</button>
            </div>

            <style>
                .menu-btn {
                    padding: 15px 0;
                    font-size: 24px;
                    border: 2px solid #fff;
                    cursor: pointer;
                    font-family: 'VT323', monospace;
                    text-transform: lowercase;
                    transition: all 0.2s;
                }
                .menu-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 15px rgba(255,255,255,0.3);
                    color: white !important;
                    border-color: white !important;
                }
            </style>
        `;

        // Attach Listeners
        setTimeout(() => {
            const btnStart = document.getElementById('btn-start');
            const btnLeaderboard = document.getElementById('btn-leaderboard');
            const btnChange = document.getElementById('btn-changelog');

            if (btnStart) btnStart.onclick = () => this.startGame();
            if (btnLeaderboard) btnLeaderboard.onclick = () => this.renderLeaderboard();
            if (btnChange) btnChange.onclick = () => this.renderChangelog();
        }, 0);
    }

    renderChangelog() {
        if (!this.overlay) return;

        const changes = [
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
            <h2 style="color: #888; margin-bottom: 40px; font-size: 32px;">changelog</h2>
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
            <h2 style="color: #ffff00; margin-bottom: 40px; font-size: 48px; text-shadow: 0 0 10px #ffff00;">HIGH SCORES</h2>
            <p style="color: #888; font-size: 24px;">Loading global leaderboard...</p>
        `;

        const scores = await HighScoreManager.getHighScores();

        let html = `
            <h2 style="color: #ffff00; margin-bottom: 40px; font-size: 48px; text-shadow: 0 0 10px #ffff00;">HIGH SCORES</h2>
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
            html += `<p style="color: #888; text-align: center; font-size: 24px;">No scores yet. Be the first!</p>`;
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
                        <span style="color: ${color}; font-size: 24px; width: 50px;">${medal}</span>
                        <span style="color: white; font-size: 28px; flex: 1;">${score.name}</span>
                        <span style="color: #ffff00; font-size: 28px; font-weight: bold;">${score.score}</span>
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
            this.overlay.remove();
            this.overlay = null;
        }, 500);
    }
}
