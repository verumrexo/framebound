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
        this.game.pauseOverlay.className = 'pause-menu-overlay';

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
            <main class="pause-panel">
                <div class="ui-kicker">simulation state // suspended</div>
                <h2 class="pause-title">${guestWaiting ? 'host paused' : 'paused'}</h2>
                <div class="pause-subtitle">combat telemetry remains available</div>
                <div class="pause-actions">
                ${guestWaiting
                    ? '<button class="pause-btn" data-index="--" disabled>waiting for host</button>'
                    : '<button id="btn-resume" class="pause-btn" data-index="01">resume</button>'}
                    <button id="btn-pause-settings" class="pause-btn" data-index="02">settings</button>
                    <button id="btn-main-menu" class="pause-btn menu-btn-danger" data-index="03">main menu</button>
                </div>
            </main>
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
