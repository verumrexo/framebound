
import {
    UI_COLORS,
    UI_FONTS,
    drawUiPanel
} from '../ui/UiTheme.js';

export class LevelUpManager {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.choices = [];
        this.selectionPending = false;

        // Rarity Definition
        this.rarities = [
            { id: 'common', name: 'common', color: '#aaaaaa', weight: 50 },
            { id: 'uncommon', name: 'uncommon', color: '#44ff44', weight: 25 },
            { id: 'rare', name: 'rare', color: '#00ffff', weight: 15 },
            { id: 'epic', name: 'epic', color: '#aa00ff', weight: 8 },
            { id: 'legendary', name: 'legendary', color: '#ffaa00', weight: 1.9 },
            { id: 'mythic', name: 'mythic', color: '#ff0000', weight: 0.1 }
        ];

        // Upgrade Definitions
        // Values are [common, uncommon, rare, epic, legendary, mythic]
        this.upgrades = [
            {
                id: 'hull',
                name: ['reinforced plating', 'military grade alloy', 'nanocarbon weave', 'aegis core', 'leviathan scale', 'planar hull'],
                stat: 'maxHp',
                type: 'multiply',
                values: [0.10, 0.20, 0.35, 0.50, 1.00, 2.00],
                desc: 'increases max hull integrity'
            },
            {
                id: 'regen',
                name: ['patch bots', 'repair crew', 'nanite cloud', 'self-replicating hull', 'phoenix system', 'time reversal'],
                stat: 'regen',
                type: 'add',
                values: [0.5, 1.0, 2.0, 5.0, 10.0, 25.0],
                desc: 'increases hull regeneration per second'
            },
            {
                id: 'velocity',
                name: ['oiled gears', 'autoloader', 'chain feed', 'hyper-cycling', 'bullet hell', 'lead storm'],
                stat: 'velocityRate',
                type: 'add',
                values: [0.05, 0.10, 0.15, 0.25, 0.40, 1.00],
                desc: 'increases fire rate for ballistic weapons'
            },
            {
                id: 'laser',
                name: ['polished lens', 'high-yield cap', 'flux agitator', 'resonance chamber', 'beam span', 'solar flare'],
                stat: 'laserRate',
                type: 'add',
                values: [0.05, 0.10, 0.15, 0.25, 0.40, 1.00],
                desc: 'increases fire rate for energy weapons'
            },
            {
                id: 'mobility',
                name: ['tuned thrusters', 'afterburner', 'vector compensator', 'inertial dampeners', 'warp drift', 'blink engine'],
                stat: 'mobility',
                type: 'add',
                values: [0.05, 0.10, 0.15, 0.25, 0.40, 0.80],
                desc: 'increases max speed and turn rate'
            },
            {
                id: 'rocket',
                name: ['solid fuel', 'liquid injection', 'ion thruster', 'plasma wake', 'grav-assist', 'void drive'],
                stat: 'missileSpeed',
                type: 'add',
                values: [0.10, 0.20, 0.35, 0.50, 1.00, 2.00],
                desc: 'increases travel speed of all missiles'
            }
        ];

        // Hover state for UI
        this.hoveredIndex = -1;
    }

    triggerLevelUp(forceRarity = null) {
        this.active = true;
        this.selectionPending = false;
        this.game.paused = true;
        this.game.audio.play('item_pickup', { pitch: 0.5 });
        this.choices = this.generateChoices(forceRarity);
        this.game.peerNetwork?.beginSharedLevelUp?.();
    }

    generateChoices(forceRarity = null) {
        const choices = [];
        // Generate 3 unique upgrade categories
        const availableUpgrades = [...this.upgrades];
        for (let i = 0; i < 3; i++) {
            if (availableUpgrades.length === 0) break;
            const typeIndex = Math.floor(Math.random() * availableUpgrades.length);
            const type = availableUpgrades.splice(typeIndex, 1)[0];
            choices.push(this.generateChoiceForType(type, forceRarity));
        }
        return choices;
    }

    generateChoiceForType(type, forceRarity = null) {
        let rarity;
        if (forceRarity) {
            rarity = this.rarities.find(r => r.id === forceRarity) || this.rarities[0];
        } else {
            rarity = this.rollRarity();
        }
        const rarityIndex = this.rarities.indexOf(rarity);

        return {
            rarity: rarity,
            type: type,
            name: type.name[rarityIndex],
            value: type.values[rarityIndex],
            stat: type.stat,
            mode: type.type,
            desc: type.desc
        };
    }

    rollRarity() {
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (const r of this.rarities) {
            cumulative += r.weight;
            if (rand <= cumulative) return r;
        }
        return this.rarities[0]; // Fallback
    }

    selectUpgrade(index) {
        if (
            this.selectionPending ||
            index < 0 ||
            index >= this.choices.length
        ) {
            return false;
        }

        const choice = this.choices[index];
        if (this.game.peerNetwork?.isGuest) {
            if (!this.game.peerNetwork.sendLevelUpChoice?.(index)) {
                return false;
            }
            this.selectionPending = true;
            return true;
        }

        this.applyUpgrade(choice);
        this.selectionPending = true;

        this.game.showNotification(`${choice.name} installed`, choice.rarity.color);
        if (this.game.peerNetwork?.isHost) {
            this.game.peerNetwork.completeLocalLevelUp?.();
        } else {
            this.completeSharedLevelUp();
        }
        return true;
    }

    applyUpgrade(u) {
        applyUpgradeToShip(this.game.playerShip, u);
    }

    applyRemoteLevelUp(levelUp) {
        if (!levelUp) {
            this.completeSharedLevelUp();
            return;
        }

        this.active = true;
        this.game.paused = true;
        if (levelUp.choices.length > 0) {
            if (!this.selectionPending) {
                this.choices = levelUp.choices;
            }
            return;
        }
        this.selectionPending = true;
    }

    completeSharedLevelUp() {
        this.active = false;
        this.choices = [];
        this.selectionPending = false;
        this.hoveredIndex = -1;
        this.game.paused = false;
    }

    update() {
        // Mouse interaction
        if (!this.active) return;
        if (this.selectionPending) return;

        const input = this.game.input;
        const mouse = input.getMousePos();

        // Card Dimensions
        const cw = 200;
        const ch = 280;
        const gap = 20;
        const totalW = 3 * cw + 2 * gap;
        const startX = (this.game.renderer.width - totalW) / 2;
        const startY = (this.game.renderer.height - ch) / 2;

        this.hoveredIndex = -1;

        for (let i = 0; i < 3; i++) {
            const x = startX + i * (cw + gap);
            const y = startY;

            if (mouse.x >= x && mouse.x <= x + cw &&
                mouse.y >= y && mouse.y <= y + ch) {
                this.hoveredIndex = i;
                if (input.isMouseDown() && !this.game.mouseDownLastFrame) {
                    this.selectUpgrade(i);
                }
            }
        }
    }

    draw(renderer) {
        if (!this.active) return;

        const ctx = renderer.ctx;

        // Overlay
        ctx.fillStyle = 'rgba(3, 4, 3, 0.88)';
        ctx.fillRect(0, 0, renderer.width, renderer.height);

        // Header
        ctx.fillStyle = UI_COLORS.green;
        ctx.font = UI_FONTS.small;
        ctx.textAlign = 'center';
        ctx.fillText('frame enhancement // authorization required', renderer.width / 2, 74);

        ctx.font = UI_FONTS.large;
        ctx.fillStyle = UI_COLORS.bright;
        ctx.fillText('select enhancement', renderer.width / 2, 118);

        ctx.font = UI_FONTS.small;
        ctx.fillStyle = UI_COLORS.muted;
        ctx.fillText(
            this.selectionPending
                ? "waiting for crew"
                : "one selection will be installed immediately",
            renderer.width / 2,
            144
        );

        if (this.selectionPending || this.choices.length < 3) return;

        // Cards
        const cw = 200;
        const ch = 280;
        const gap = 20;
        const totalW = 3 * cw + 2 * gap;
        const startX = (renderer.width - totalW) / 2;
        const startY = (renderer.height - ch) / 2;

        for (let i = 0; i < 3; i++) {
            const choice = this.choices[i];
            const x = startX + i * (cw + gap);
            const y = startY;
            const isHover = (i === this.hoveredIndex);

            drawUiPanel(ctx, x, y, cw, ch, choice.rarity.color);
            ctx.strokeStyle = isHover ? choice.rarity.color : UI_COLORS.line;
            ctx.lineWidth = isHover ? 2 : 1;
            ctx.strokeRect(x, y, cw, ch);

            if (isHover) {
                ctx.fillStyle = choice.rarity.color;
                ctx.globalAlpha = 0.08;
                ctx.fillRect(x, y, cw, ch);
                ctx.globalAlpha = 1.0;
            }

            // Content
            const cx = x + cw / 2;

            // Rarity Label
            ctx.fillStyle = choice.rarity.color;
            ctx.font = UI_FONTS.tiny;
            ctx.textAlign = 'center';
            ctx.fillText(`${String(i + 1).padStart(2, '0')} // ${choice.rarity.name}`, cx, y + 30);

            // Upgrade Name
            ctx.fillStyle = UI_COLORS.bright;
            ctx.font = UI_FONTS.label;
            this.wrapText(ctx, choice.name, cx, y + 70, cw - 20, 16);

            // Stat Value
            ctx.font = UI_FONTS.title;
            let valStr = "";
            let prefix = "+";
            if (choice.mode === 'multiply') valStr = `${Math.round(choice.value * 100)}%`;
            else if (choice.stat === 'regen') valStr = `${choice.value}/s`;
            else valStr = `${Math.round(choice.value * 100)}%`; // Default percent

            ctx.fillText(prefix + valStr, cx, y + 140);

            // Description
            ctx.fillStyle = UI_COLORS.muted;
            ctx.font = UI_FONTS.tiny;
            this.wrapText(ctx, choice.desc, cx, y + 200, cw - 20, 12);
        }
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let testLine = '';
        let lineArray = [];

        for (let n = 0; n < words.length; n++) {
            testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lineArray.push(line);
                line = words[n] + ' ';
            }
            else {
                line = testLine;
            }
        }
        lineArray.push(line);

        for (let k = 0; k < lineArray.length; k++) {
            ctx.fillText(lineArray[k], x, y + k * lineHeight);
        }
    }
}

export function applyUpgradeToShip(ship, upgrade) {
    const stats = ship.permanentStats;

    if (upgrade.stat === 'maxHp') {
        stats.hpMul = (stats.hpMul || 1.0) + upgrade.value;
    } else if (upgrade.stat === 'regen') {
        stats.regenAdd = (stats.regenAdd || 0) + upgrade.value;
    } else if (upgrade.stat === 'velocityRate') {
        stats.velocityRateAdd =
            (stats.velocityRateAdd || 0) + upgrade.value;
    } else if (upgrade.stat === 'laserRate') {
        stats.laserRateAdd = (stats.laserRateAdd || 0) + upgrade.value;
    } else if (upgrade.stat === 'mobility') {
        stats.speedMul = (stats.speedMul || 1.0) + upgrade.value;
        stats.turnMul = (stats.turnMul || 1.0) + upgrade.value;
    } else if (upgrade.stat === 'missileSpeed') {
        stats.missileSpeedMul =
            (stats.missileSpeedMul || 1.0) + upgrade.value;
    } else {
        return false;
    }

    ship.recalculateStats();
    ship.hp = ship.maxHp;
    return true;
}
