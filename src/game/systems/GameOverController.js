import { HighScoreGateway } from './HighScoreGateway.js';
import { SaveManager } from './SaveManager.js';

export class GameOverController {
    constructor(game, {
        highScores = HighScoreGateway,
        saves = SaveManager,
        reload = () => window.location.reload()
    } = {}) {
        this.game = game;
        this.highScores = highScores;
        this.saves = saves;
        this.reload = reload;
    }

    update(isMouseDown) {
        const game = this.game;

        if (game.isSpectating && !game.playerShip.isDead) {
            game.isSpectating = false;
            game.isGameOver = false;
            game.paused = false;
            game.showNotification?.('systems restored', '#00ffff');
        }

        if (game.playerShip.isDead && !game.isGameOver) {
            if (game.peerNetwork?.canSpectateLocalDeath?.()) {
                if (!game.isSpectating) {
                    console.log('[Death] Ship died! Spectating teammates');
                    game.isSpectating = true;
                    game.audio.play('frame_death', { volume: 0.7 });
                    game.showNotification?.(
                        'spectating // boss kill restores ship',
                        '#aaaaaa'
                    );
                }
                return false;
            }

            game.isSpectating = false;
            console.log('[Death] Ship died! Setting up name entry');
            game.isGameOver = true;
            game.paused = true;
            if (game.peerNetwork?.isHost) {
                game.peerNetwork.flushAuthoritativeState?.();
            }
            if (!game.peerNetwork?.isGuest) {
                this.saves.clearSave();
            }
            game.audio.play('frame_death', { volume: 0.7 });

            if (game.peerNetwork?.role) {
                console.log('[Death] Peer-hosted score is not public');
            } else this.highScores.isHighScore(game.score).then(isHigh => {
                if (isHigh) {
                    game.nameEntryActive = true;
                    game.nameEntry = '';
                    console.log('[Death] Score qualifies for leaderboard!');
                } else {
                    console.log('[Death] Score does not qualify for leaderboard');
                }
            });
        }

        if (game.isGameOver && !game.nameEntryActive) {
            if (game.input.isKeyDown('KeyR')) {
                this.saves.clearSave();
                this.reload();
            }
            this.finishFrame(isMouseDown);
            return true;
        }

        if (!game.nameEntryActive) return false;

        for (const key of game.input.keysPressed) {
            if (key === 'Enter') {
                if (game.nameEntry.length > 0) {
                    const finalName = game.nameEntry;
                    game.nameEntryActive = false;
                    this.highScores.addScore(finalName, game.score).then(() => {
                        console.log('[Score] Submitted name:', finalName);
                    });
                }
            } else if (key === 'Escape') {
                game.nameEntryActive = false;
                this.saves.clearSave();
                this.reload();
            } else if (key === 'Backspace') {
                game.nameEntry = game.nameEntry.slice(0, -1);
            } else if (game.nameEntry.length < 5) {
                const char = this.keyToCharacter(key);
                if (char) game.nameEntry += char;
            }
        }

        this.finishFrame(isMouseDown);
        return true;
    }

    finishFrame(isMouseDown) {
        this.game.input.clearPressed();
        this.game.mouseDownLastFrame = isMouseDown;
    }

    keyToCharacter(key) {
        if (key.startsWith('Key')) return key.charAt(3).toLowerCase();
        if (key.startsWith('Digit')) return key.charAt(5);
        if (key === 'Space') return ' ';
        if (key === 'Minus') return '-';
        if (key === 'Period') return '.';
        return '';
    }
}
