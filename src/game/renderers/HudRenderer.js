import { PartsLibrary } from '../../shared/parts/Part.js';
import { Hangar } from '../systems/Hangar.js';
import { drawCustomCursor } from './CursorRenderer.js';
import {
    UI_COLORS,
    UI_FONTS,
    drawUiBar,
    drawUiPanel
} from '../ui/UiTheme.js';

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
        this.speedHistory = [];
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
        const healthColor = hpPct <= 0.3 ? UI_COLORS.red : UI_COLORS.green;
        const xpPct = game.xp / game.xpToNext;

        ctx.save();
        drawUiPanel(ctx, 18, 18, 306, 82, healthColor);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.tiny;
        ctx.textAlign = 'left';
        ctx.fillText('ap // frame integrity', 31, 38);
        ctx.fillStyle = UI_COLORS.bright;
        ctx.textAlign = 'right';
        ctx.fillText(`${hpCurrent}/${hpMax}`, 311, 38);
        drawUiBar(ctx, 31, 48, 280, 8, hpPct, healthColor);
        ctx.fillStyle = healthColor;
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.ceil(hpPct * 100)}%`, 31, 74);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.fillText(`level ${game.level}`, 82, 74);
        ctx.textAlign = 'right';
        ctx.fillText(`xp ${game.xp}/${game.xpToNext}`, 311, 74);
        drawUiBar(ctx, 31, 82, 280, 3, xpPct, UI_COLORS.amber);

        const telemetryX = renderer.width - 220;
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.tiny;
        ctx.textAlign = 'right';
        ctx.fillText(`floor // ${game.floor}`, telemetryX - 16, 30);
        ctx.fillStyle = UI_COLORS.amber;
        ctx.fillText(`credits // ${game.gold}`, telemetryX - 16, 47);
        ctx.fillStyle = UI_COLORS.ink;
        ctx.fillText(`score // ${game.score}`, telemetryX - 16, 64);

        const speed = Math.sqrt(game.vx * game.vx + game.vy * game.vy);
        const commandY = renderer.height - 48;
        drawUiPanel(ctx, 18, commandY, 410, 30, UI_COLORS.green);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.tiny;
        ctx.textAlign = 'left';
        ctx.fillText(`spd // ${Math.floor(speed)}`, 31, commandY + 19);
        ctx.fillText('tab // hangar', 125, commandY + 19);

        const boosterCount = game.playerShip.stats.boosterCount || 0;
        if (boosterCount > 0) {
            if (game.dashCooldown > 0) {
                const dashPct = game.dashCooldown / game.dashMaxCooldown;
                ctx.fillStyle = UI_COLORS.amber;
                ctx.fillText(`boost // ${Math.ceil(game.dashCooldown)}s`, 243, commandY + 19);
                drawUiBar(ctx, 336, commandY + 12, 78, 5, 1 - dashPct, UI_COLORS.amber);
            } else {
                ctx.fillStyle = UI_COLORS.greenBright;
                ctx.fillText('shift // boost ready', 243, commandY + 19);
            }
        }

        if (game.minimap) {
            game.minimap.x = renderer.width - 220;
            game.minimap.draw(renderer, game);
        }

        if (game.eyeCandy !== false) {
            this.drawCockpitHud(speed);
        }

        const frameTime = this.now();
        game.frameCount++;
        if (frameTime - game.lastFpsTime >= 500) {
            game.fps = Math.round((game.frameCount * 1000) / (frameTime - game.lastFpsTime));
            game.frameCount = 0;
            game.lastFpsTime = frameTime;
        }
        ctx.fillStyle = UI_COLORS.dim;
        ctx.font = UI_FONTS.tiny;
        ctx.textAlign = 'right';
        ctx.fillText(`fps ${game.fps}`, renderer.width - 18, renderer.height - 18);
        const seedText = game.levelGen ? `seed: ${game.levelGen.seed}` : '';
        ctx.fillText(
            `${game.version} // ${game.versionName} // ${seedText}`,
            renderer.width - 18,
            renderer.height - 34
        );
        ctx.restore();

        this.drawMinigunIndicator();
    }

    drawCockpitHud(speed) {
        const game = this.game;
        const { ctx, width, height } = game.renderer;
        const centerX = width / 2;
        const centerY = height / 2;
        const edgeInset = 9;
        const edgeTop = Math.max(112, height * 0.18);
        const edgeBottom = Math.min(height - 78, height * 0.82);
        const enemies = game.enemies?.filter(enemy => !enemy.isDead).length ?? 0;
        this.speedHistory.push(speed);
        if (this.speedHistory.length > 48) this.speedHistory.shift();
        const degrees = ((Number(game.rotation) || 0) * 180 / Math.PI + 360) % 360;
        const headings = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
        const heading = headings[Math.round(degrees / 45) % headings.length];

        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(85, 255, 194, 0.42)';
        this.drawCockpitPath([
            [edgeInset + 22, edgeTop - 22],
            [edgeInset, edgeTop],
            [edgeInset, edgeBottom],
            [edgeInset + 22, edgeBottom + 22]
        ]);
        this.drawCockpitPath([
            [width - edgeInset - 22, edgeTop - 22],
            [width - edgeInset, edgeTop],
            [width - edgeInset, edgeBottom],
            [width - edgeInset - 22, edgeBottom + 22]
        ]);

        ctx.strokeStyle = 'rgba(53, 242, 255, 0.32)';
        this.drawCockpitPath([
            [centerX - 165, 30],
            [centerX - 118, 30],
            [centerX - 106, 42],
            [centerX + 106, 42],
            [centerX + 118, 30],
            [centerX + 165, 30]
        ]);
        ctx.fillStyle = UI_COLORS.cyan;
        ctx.font = UI_FONTS.tiny;
        ctx.textAlign = 'center';
        ctx.fillText(`heading // ${heading} ${Math.round(degrees).toString().padStart(3, '0')}`, centerX, 27);
        for (let offset = -90; offset <= 90; offset += 30) {
            const x = centerX + offset;
            ctx.fillStyle = offset === 0 ? UI_COLORS.cyanBright : UI_COLORS.dim;
            ctx.fillRect(x, 35, 1, offset === 0 ? 9 : 5);
        }

        const bracketX = 112;
        const bracketY = 82;
        ctx.strokeStyle = 'rgba(116, 255, 106, 0.34)';
        this.drawCockpitCorner(centerX - bracketX, centerY - bracketY, 1, 1);
        this.drawCockpitCorner(centerX + bracketX, centerY - bracketY, -1, 1);
        this.drawCockpitCorner(centerX - bracketX, centerY + bracketY, 1, -1);
        this.drawCockpitCorner(centerX + bracketX, centerY + bracketY, -1, -1);

        this.drawWeaponBank(18, 116);

        const rightX = width - 268;
        const rightY = Math.max(236, (game.minimap?.y || 18) + (game.minimap?.size || 200) + 18);
        drawUiPanel(ctx, rightX, rightY, 250, 158, enemies > 0 ? UI_COLORS.orange : UI_COLORS.mint);
        ctx.textAlign = 'left';
        ctx.font = UI_FONTS.tiny;
        ctx.fillStyle = UI_COLORS.muted;
        ctx.fillText('proximity matrix // live', rightX + 13, rightY + 22);
        ctx.fillStyle = enemies > 0 ? UI_COLORS.orange : UI_COLORS.green;
        ctx.fillText(`contacts // ${String(enemies).padStart(2, '0')}`, rightX + 13, rightY + 47);
        ctx.fillStyle = UI_COLORS.cyan;
        ctx.fillText(`velocity // ${Math.floor(speed).toString().padStart(3, '0')}`, rightX + 13, rightY + 68);
        ctx.fillStyle = UI_COLORS.mint;
        ctx.fillText(`boosters // ${game.playerShip.stats.boosterCount || 0}`, rightX + 13, rightY + 89);
        drawUiBar(ctx, rightX + 143, rightY + 42, 92, 4, Math.min(1, enemies / 8), enemies > 0 ? UI_COLORS.orange : UI_COLORS.green);
        drawUiBar(ctx, rightX + 143, rightY + 63, 92, 4, Math.min(1, speed / 600), UI_COLORS.cyan);

        const graphX = rightX + 13;
        const graphY = rightY + 105;
        const graphWidth = 222;
        const graphHeight = 36;
        ctx.strokeStyle = 'rgba(53, 242, 255, 0.16)';
        ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);
        if (this.speedHistory.length > 1) {
            const peak = Math.max(600, ...this.speedHistory);
            ctx.strokeStyle = UI_COLORS.cyan;
            ctx.beginPath();
            this.speedHistory.forEach((sample, index) => {
                const sampleX = graphX + index * (graphWidth / 47);
                const sampleY = graphY + graphHeight - Math.min(1, sample / peak) * graphHeight;
                if (index === 0) ctx.moveTo(sampleX, sampleY);
                else ctx.lineTo(sampleX, sampleY);
            });
            ctx.stroke();
        }
        const scanX = graphX + ((this.now() / 12) % graphWidth);
        ctx.fillStyle = 'rgba(184, 255, 90, 0.55)';
        ctx.fillRect(scanX, graphY, 1, graphHeight);
        ctx.fillStyle = UI_COLORS.dim;
        ctx.fillText('velocity trace // 4.8s', graphX, graphY + graphHeight + 13);

        const navWidth = 326;
        const navX = centerX - navWidth / 2;
        const navY = height - 55;
        ctx.strokeStyle = 'rgba(53, 242, 255, 0.3)';
        this.drawCockpitPath([
            [navX, navY + 30],
            [navX + 18, navY + 12],
            [navX + 110, navY + 12]
        ]);
        this.drawCockpitPath([
            [navX + navWidth, navY + 30],
            [navX + navWidth - 18, navY + 12],
            [navX + navWidth - 110, navY + 12]
        ]);
        ctx.fillStyle = UI_COLORS.cyanBright;
        ctx.textAlign = 'center';
        ctx.fillText(`nav // x ${Math.round(game.x || 0)}  y ${Math.round(game.y || 0)}`, centerX, navY + 18);
        ctx.fillStyle = UI_COLORS.dim;
        ctx.fillText(`room uplink // floor ${game.floor}`, centerX, navY + 36);
        ctx.restore();
    }

    drawWeaponBank(x, y) {
        const ctx = this.game.renderer.ctx;
        const weapons = Array.from(this.game.playerShip.getUniqueParts())
            .map(part => ({ part, def: this.partsLibrary[part.partId] }))
            .filter(({ def }) => Number.isFinite(def?.stats?.damage))
            .slice(0, 3);

        drawUiPanel(ctx, x, y, 250, 31 + Math.max(1, weapons.length) * 25, UI_COLORS.cyan);
        ctx.font = UI_FONTS.tiny;
        ctx.textAlign = 'left';
        ctx.fillStyle = UI_COLORS.muted;
        ctx.fillText('weapon bus // linked', x + 13, y + 21);

        if (weapons.length === 0) {
            ctx.fillStyle = UI_COLORS.dim;
            ctx.fillText('no hardpoints detected', x + 13, y + 46);
            return;
        }

        weapons.forEach(({ part, def }, index) => {
            const rowY = y + 46 + index * 25;
            const maxCooldown = Math.max(0.001, Number(def.stats.cooldown) || 1);
            const cooldown = Math.max(0, Number(part.cooldown) || 0);
            const readiness = Math.max(0, 1 - cooldown / maxCooldown);
            ctx.fillStyle = readiness >= 1 ? UI_COLORS.green : UI_COLORS.amber;
            ctx.fillText(`${index + 1} // ${String(def.name || def.id).toLowerCase()}`, x + 13, rowY);
            drawUiBar(ctx, x + 164, rowY - 8, 71, 4, readiness, readiness >= 1 ? UI_COLORS.green : UI_COLORS.amber);
        });
    }

    drawCockpitCorner(x, y, directionX, directionY) {
        this.drawCockpitPath([
            [x + 26 * directionX, y],
            [x, y],
            [x, y + 18 * directionY]
        ]);
    }

    drawCockpitPath(points) {
        const ctx = this.game.renderer.ctx;
        ctx.beginPath();
        points.forEach(([x, y], index) => {
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
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
        ctx.fillStyle = 'rgba(3, 4, 3, 0.82)';
        ctx.fillRect(0, 0, renderer.width, renderer.height);
        const panelWidth = Math.min(620, renderer.width - 80);
        const panelX = (renderer.width - panelWidth) / 2;
        const panelY = renderer.height / 2 - 120;
        drawUiPanel(ctx, panelX, panelY, panelWidth, 240, UI_COLORS.red);
        ctx.fillStyle = UI_COLORS.red;
        ctx.font = UI_FONTS.small;
        ctx.textAlign = 'center';
        ctx.fillText('critical failure // frame lost', renderer.width / 2, panelY + 36);
        ctx.fillStyle = UI_COLORS.bright;
        ctx.font = UI_FONTS.large;
        ctx.fillText('frame destroyed', renderer.width / 2, panelY + 92);
        ctx.fillStyle = UI_COLORS.amber;
        ctx.font = UI_FONTS.label;
        ctx.fillText(`final score // ${game.score}`, renderer.width / 2, panelY + 140);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.small;
        ctx.fillText('r // restart sortie', renderer.width / 2, panelY + 196);
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
                game.gameTooltip.className = 'workshop-tooltip';
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
        ctx.fillStyle = 'rgba(3, 4, 3, 0.88)';
        ctx.fillRect(0, 0, renderer.width, renderer.height);
        const panelWidth = Math.min(620, renderer.width - 80);
        const panelX = (renderer.width - panelWidth) / 2;
        const panelY = renderer.height / 2 - 210;
        drawUiPanel(ctx, panelX, panelY, panelWidth, 420, UI_COLORS.amber);
        ctx.fillStyle = UI_COLORS.red;
        ctx.font = UI_FONTS.small;
        ctx.textAlign = 'center';
        ctx.fillText('sortie record // priority entry', renderer.width / 2, panelY + 38);
        ctx.fillStyle = UI_COLORS.bright;
        ctx.font = UI_FONTS.large;
        ctx.fillText('new high score', renderer.width / 2, panelY + 92);
        ctx.fillStyle = UI_COLORS.amber;
        ctx.font = UI_FONTS.label;
        ctx.fillText(`final score // ${game.score}`, renderer.width / 2, panelY + 132);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.small;
        ctx.fillText('pilot id // five characters', renderer.width / 2, panelY + 178);

        const boxWidth = 300;
        const boxHeight = 60;
        const boxX = renderer.width / 2 - boxWidth / 2;
        const boxY = panelY + 205;
        ctx.strokeStyle = UI_COLORS.green;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        ctx.fillStyle = UI_COLORS.greenBright;
        ctx.font = UI_FONTS.title;
        const displayName = game.nameEntry + '_'.repeat(5 - game.nameEntry.length);
        ctx.fillText(displayName, renderer.width / 2, boxY + 42);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.tiny;
        ctx.fillText('enter // submit', renderer.width / 2, boxY + 96);
        ctx.fillText('esc // skip', renderer.width / 2, boxY + 116);
        renderer.present();
    }
}
