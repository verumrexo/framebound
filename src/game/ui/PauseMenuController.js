export class PauseMenuController {
    constructor(game) {
        this.game = game;
    }

    update(isMouseDown) {
        if (!this.game.paused) return false;

        this.game.mouseDownLastFrame = isMouseDown;
        return true;
    }

    toggle() {
        if (this.game.isGameOver) return;
        if (this.game.peerNetwork?.isGuest) return;

        this.game.paused = !this.game.paused;
        if (this.game.paused) {
            this.show();
        } else {
            this.hide();
        }
        this.game.peerNetwork?.flushAuthoritativeState?.();
    }

    applyRemotePaused(paused) {
        if (!this.game.peerNetwork?.isGuest) return false;
        this.game.paused = paused;
        if (paused) {
            this.show();
        } else {
            this.hide();
        }
        return true;
    }

    show() {
        if (this.game.pauseOverlay) return;

        this.game.pauseOverlay = document.createElement('div');
        this.game.pauseOverlay.id = 'pause-menu';
        this.game.pauseOverlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: 'Press Start 2P', cursive;
            color: white;
            transition: opacity 0.3s;
        `;

        document.body.appendChild(this.game.pauseOverlay);
        this.renderContent();

        // Stop propagation
        this.game.pauseOverlay.onmousedown = (event) => event.stopPropagation();
        this.game.pauseOverlay.onclick = (event) => event.stopPropagation();
    }

    renderContent() {
        if (!this.game.pauseOverlay) return;

        if (this.game.showPauseSettings) {
            this.game.gameSettings.render(this.game.pauseOverlay, () => {
                this.game.showPauseSettings = false;
                this.renderContent();
            });
            return;
        }

        const guestWaiting = this.game.peerNetwork?.isGuest;
        this.game.pauseOverlay.innerHTML = `
            <h2 style="color: #00ffff; margin-bottom: 50px; font-size: 32px; text-shadow: 0 0 10px #00ffff; text-transform: lowercase;">${guestWaiting ? 'host paused' : 'paused'}</h2>
            
            <div style="display: flex; flex-direction: column; gap: 20px; width: 300px;">
                ${guestWaiting
                    ? '<button class="pause-btn" disabled>waiting for host</button>'
                    : '<button id="btn-resume" class="pause-btn">resume</button>'}
                <button id="btn-pause-settings" class="pause-btn">settings</button>
                <button id="btn-main-menu" class="pause-btn" style="margin-top: 20px; border-color: rgba(255,0,0,0.3);">main menu</button>
            </div>

            <style>
                .pause-btn {
                    padding: 15px;
                    font-size: 14px;
                    background: rgba(0, 40, 60, 0.6);
                    border: 1px solid rgba(0, 255, 255, 0.2);
                    color: #00ffff;
                    cursor: pointer;
                    font-family: 'Press Start 2P', cursive;
                    text-transform: lowercase;
                    transition: all 0.2s;
                }
                .pause-btn:hover {
                    background: rgba(0, 255, 255, 0.2);
                    border-color: #00ffff;
                    color: white;
                }
                #btn-main-menu:hover {
                    border-color: #ff3333;
                    background: rgba(255, 0, 0, 0.1);
                }
            </style>
        `;

        setTimeout(() => {
            const btnResume = document.getElementById('btn-resume');
            const btnSettings = document.getElementById('btn-pause-settings');
            const btnMenu = document.getElementById('btn-main-menu');

            if (btnResume) btnResume.onclick = () => this.toggle();
            if (btnSettings) btnSettings.onclick = () => {
                this.game.showPauseSettings = true;
                this.renderContent();
            };
            if (btnMenu) btnMenu.onclick = () => this.returnToMainMenu();
        }, 0);
    }

    returnToMainMenu() {
        if (!this.game.peerNetwork?.isGuest) {
            this.game.autoSave();
        }
        this.game.peerNetwork?.disconnect();
        this.hide();
        this.game.paused = false;
        this.game.running = false;
        this.game.loop.stop();
        this.game.audio.stopMusic();
        this.game.mainMenu.show();
    }

    hide() {
        this.game.gameSettings?.stopUpdating();
        if (this.game.pauseOverlay) {
            this.game.pauseOverlay.remove();
            this.game.pauseOverlay = null;
            this.game.showPauseSettings = false;
        }
    }
}
