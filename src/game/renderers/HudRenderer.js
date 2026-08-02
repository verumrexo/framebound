import { PartsLibrary } from '../../shared/parts/Part.js';
import { Hangar } from '../systems/Hangar.js';
import { drawCustomCursor } from './CursorRenderer.js';

export class HudRenderer {
    constructor(game, {
        partsLibrary = PartsLibrary,
        hangarClass = Hangar,
        drawCursor = drawCustomCursor,
        now = () => performance.now(),
        dateNow = () => Date.now()
    } = {}) {
        this.game = game;
        this.partsLibrary = partsLibrary;
        this.hangarClass = hangarClass;
        this.drawCursor = drawCursor;
        this.now = now;
        this.dateNow = dateNow;
    }

    draw() {
        const game = this.game;

        if (!game.hangar.active && !game.shipBuilder.active && !game.isGameOver) {
            this.drawStatusHud();
        } else if (game.hangar.active) {
            game.hangar.draw(game.renderer);
        } else if (game.shipBuilder.active) {
            game.shipBuilder.draw(game.renderer);
        } else if (game.isGameOver && !game.nameEntryActive) {
            this.drawGameOver();
        }

        this.updateItemTooltip();
        game.effects.drawNotifications();

        if (game.levelUpManager.active) {
            game.levelUpManager.draw(game.renderer);
        }

        if (game.nameEntryActive) {
            this.drawNameEntry();
        }

        this.drawCursor(game);
    }

    drawStatusHud() {
        const game = this.game;
        const renderer = game.renderer;
        const ctx = renderer.ctx;
        const hpPct = game.playerShip.hp / game.playerShip.maxHp;
        const hpCurrent = Math.ceil(game.playerShip.hp);
        const hpMax = game.playerShip.maxHp;

        renderer.drawRect(20, 20, 240, 24, 'rgba(255, 0, 0, 0.15)');
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, 240, 24);
        renderer.drawRect(20, 20, 240 * hpPct, 24, '#ff3333');

        ctx.fillStyle = 'white';
        ctx.font = "8px 'Press Start 2P'";
        ctx.textAlign = 'left';
        ctx.fillText('integrity', 25, 38);
        ctx.textAlign = 'right';
        ctx.fillText(`${hpCurrent}/${hpMax}`, 255, 38);

        const badgeX = 270;
        renderer.drawRect(badgeX, 20, 50, 24, 'rgba(255, 255, 255, 0.1)');
        ctx.strokeStyle = 'white';
        ctx.strokeRect(badgeX, 20, 50, 24);
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(hpPct * 100)}%`, badgeX + 25, 38);
        ctx.textAlign = 'left';

        renderer.drawRect(20, 50, 150, 24, 'rgba(0, 255, 0, 0.2)');
        ctx.fillStyle = 'white';
        ctx.fillText('tab for hangar', 25, 67);

        const xpPct = game.xp / game.xpToNext;
        const barY = 85;
        renderer.drawRect(20, barY, 200, 12, '#112244');
        renderer.drawRect(20, barY, 200 * xpPct, 12, '#00ffff');
        ctx.fillStyle = '#00ffff';
        ctx.font = "10px 'Press Start 2P'";
        ctx.fillText(`lvl ${game.level} | floor ${game.floor}`, 20, barY + 28);

        const goldY = barY + 35;
        const goldX = 20;
        const goldW = 100;
        const goldH = 22;
        renderer.drawRect(goldX, goldY, goldW, goldH, 'rgba(255, 170, 0, 0.1)');
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1;
        ctx.strokeRect(goldX, goldY, goldW, goldH);
        ctx.fillStyle = '#ffaa00';
        ctx.textAlign = 'left';
        ctx.font = "8px 'Press Start 2P'";
        ctx.fillText(`$ ${game.gold}`, goldX + 10, goldY + 16);

        const speed = Math.sqrt(game.vx * game.vx + game.vy * game.vy);
        const speedY = goldY + 30;
        ctx.fillStyle = '#00ff00';
        ctx.font = "8px 'Press Start 2P'";
        ctx.textAlign = 'left';
        ctx.fillText(`speed: ${Math.floor(speed)}`, 20, speedY + 16);

        const boosterCount = game.playerShip.stats.boosterCount || 0;
        if (boosterCount > 0) {
            if (game.dashCooldown > 0) {
                const dashPct = game.dashCooldown / game.dashMaxCooldown;
                const dashY = 135;
                renderer.drawRect(20, dashY, 100, 8, '#222');
                renderer.drawRect(20, dashY, 100 * (1 - dashPct), 8, '#00ffff');
                ctx.fillStyle = '#00ffff';
                ctx.font = "8px 'Press Start 2P'";
                ctx.fillText(`dash prep: ${Math.ceil(game.dashCooldown)}s`, 20, dashY + 22);
            } else {
                ctx.fillStyle = '#00ffff';
                ctx.font = "8px 'Press Start 2P'";
                ctx.fillText('dash ready [shift]', 20, 155);
            }
        }

        if (game.minimap) {
            game.minimap.x = renderer.width - 220;
            game.minimap.draw(renderer, game);
        }

        ctx.fillStyle = '#ffff00';
        ctx.font = "8px 'Press Start 2P'";
        ctx.textAlign = 'right';
        ctx.fillText(`score: ${game.score}`, renderer.width - 20, 220);
        ctx.textAlign = 'left';

        const frameTime = this.now();
        game.frameCount++;
        if (frameTime - game.lastFpsTime >= 500) {
            game.fps = Math.round((game.frameCount * 1000) / (frameTime - game.lastFpsTime));
            game.frameCount = 0;
            game.lastFpsTime = frameTime;
        }
        ctx.fillStyle = '#00ff00';
        ctx.font = "8px 'Press Start 2P'";
        ctx.textAlign = 'right';
        ctx.fillText(`fps: ${game.fps}`, renderer.width - 20, renderer.height - 20);
        ctx.textAlign = 'left';

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = "8px 'Press Start 2P'";
        ctx.textAlign = 'left';
        const seedText = game.levelGen ? `seed: ${game.levelGen.seed}` : '';
        ctx.fillText(
            `${game.version} [${game.versionName}] | ${seedText}`,
            20,
            renderer.height - 20
        );

        this.drawMinigunIndicator();
    }

    drawMinigunIndicator() {
        const game = this.game;
        let topMinigun = null;
        let topPriority = -1;

        for (const part of game.playerShip.getUniqueParts()) {
            const def = this.partsLibrary[part.partId];
            if (!def || !def.stats.rampUp) continue;

            let priority = -1;
            if (part.peakMeter > 0) priority = 2;
            else if (part.cooldown > 0 && part.rampLevel === 0) priority = 1;
            else if (part.rampLevel > 0) priority = 0;

            if (priority > topPriority) {
                topPriority = priority;
                topMinigun = { part, def };
            } else if (priority === topPriority && topMinigun) {
                if (priority === 2 && part.peakMeter < topMinigun.part.peakMeter) {
                    topMinigun = { part, def };
                }
                if (priority === 0 && part.rampLevel > topMinigun.part.rampLevel) {
                    topMinigun = { part, def };
                }
            }
        }

        if (!topMinigun) return;

        const { part, def } = topMinigun;
        const mouse = game.input.getMousePos();
        const ctx = game.renderer.ctx;
        ctx.save();
        ctx.translate(mouse.x, mouse.y);
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (part.peakMeter > 0) {
            const pct = part.peakMeter / (def.stats.peakDuration || 5);
            ctx.beginPath();
            ctx.arc(0, 0, 35, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
            const pulse = Math.sin(this.dateNow() * 0.01) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(255, ${150 + pulse * 105}, 0, 1)`;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = "bold 10px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.fillText('peak', 0, -45);
            ctx.font = "6px 'Press Start 2P'";
            ctx.fillText(`${part.peakMeter.toFixed(1)}s`, 0, 48);
        } else if (part.cooldown > 1 && part.rampLevel === 0) {
            const maxCooldown = def.stats.overheatCooldown || 7;
            const pct = part.cooldown / maxCooldown;
            ctx.beginPath();
            ctx.arc(0, 0, 35, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
            ctx.strokeStyle = 'rgba(255, 50, 0, 0.8)';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = '#ff3300';
            ctx.font = "bold 10px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.fillText('overheat', 0, -45);
        } else if (part.rampLevel > 0) {
            const pct = part.rampLevel / (def.stats.maxRamp || 29);
            ctx.beginPath();
            ctx.arc(0, 0, 35, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
            ctx.strokeStyle = '#26d426';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.restore();
    }

    drawGameOver() {
        const game = this.game;
        const renderer = game.renderer;
        const ctx = renderer.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, renderer.width, renderer.height);
        ctx.fillStyle = 'red';
        ctx.font = "bold 36px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText('frame destroyed', renderer.width / 2, renderer.height / 2 - 80);
        ctx.fillStyle = '#ffff00';
        ctx.font = "20px 'Press Start 2P'";
        ctx.fillText(`FINAL SCORE: ${game.score}`, renderer.width / 2, renderer.height / 2);
        ctx.fillStyle = 'white';
        ctx.font = "20px 'Press Start 2P'";
        ctx.fillText('press r to restart', renderer.width / 2, renderer.height / 2 + 60);
        ctx.textAlign = 'left';
    }

    updateItemTooltip() {
        const game = this.game;
        if (game.fullscreenMapOpen) {
            game.fullscreenMap.draw(game.renderer);
            return;
        }

        if (game.hangar.active || game.isGameOver) {
            if (game.gameTooltip) game.gameTooltip.style.display = 'none';
            return;
        }

        const mousePos = game.input.getMousePos();
        const zoom = game.camera.zoom || 1;
        const worldMouseX = (mousePos.x / zoom) + game.camera.x;
        const worldMouseY = (mousePos.y / zoom) + game.camera.y;
        let hoveredItem = null;

        for (const item of game.itemPickups) {
            if (item.isDead) continue;
            const dx = worldMouseX - item.x;
            const dy = worldMouseY -
                (item.y + (Math.sin(item.life * 5 + item.bobOffset) * 4));
            if (dx * dx + dy * dy < 40 * 40) {
                hoveredItem = item;
                break;
            }
        }

        if (hoveredItem && hoveredItem.def) {
            if (!game.gameTooltip) {
                game.gameTooltip = document.createElement('div');
                game.gameTooltip.style.cssText = `
                    position: absolute;
                    background: rgba(0, 20, 40, 0.95);
                    border: 1px solid #44ccff;
                    padding: 15px;
                    color: white;
                    font-family: 'Press Start 2P', monospace;
                    pointer-events: none;
                    z-index: 1000;
                    display: none;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    min-width: 200px;
                 `;
                document.body.appendChild(game.gameTooltip);
            }

            game.gameTooltip.style.display = 'block';
            game.gameTooltip.style.left = `${mousePos.x + 15}px`;
            game.gameTooltip.style.top = `${mousePos.y + 15}px`;
            this.hangarClass.updateTooltip(game.gameTooltip, hoveredItem.def);
        } else if (game.gameTooltip) {
            game.gameTooltip.style.display = 'none';
        }
    }

    drawNameEntry() {
        const game = this.game;
        const renderer = game.renderer;
        const ctx = renderer.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, renderer.width, renderer.height);
        ctx.fillStyle = '#ff4444';
        ctx.font = "24px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText('game over', renderer.width / 2, renderer.height / 2 - 150);
        ctx.fillStyle = '#ffff00';
        ctx.font = "16px 'Press Start 2P'";
        ctx.fillText(`final score: ${game.score}`, renderer.width / 2, renderer.height / 2 - 80);
        ctx.fillStyle = '#00ff00';
        ctx.font = "16px 'Press Start 2P'";
        ctx.fillText('new high score!', renderer.width / 2, renderer.height / 2 - 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = "8px 'Press Start 2P'";
        ctx.fillText('enter your name (5 chars)', renderer.width / 2, renderer.height / 2 + 20);

        const boxWidth = 300;
        const boxHeight = 60;
        const boxX = renderer.width / 2 - boxWidth / 2;
        const boxY = renderer.height / 2 + 40;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        ctx.fillStyle = '#00ff00';
        ctx.font = "16px 'Press Start 2P'";
        const displayName = game.nameEntry + '_'.repeat(5 - game.nameEntry.length);
        ctx.fillText(displayName, renderer.width / 2, boxY + 42);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = "8px 'Press Start 2P'";
        ctx.fillText('press enter to submit', renderer.width / 2, boxY + 90);
        ctx.fillText('press esc to skip', renderer.width / 2, boxY + 110);
        renderer.present();
    }
}
