
export class LevelUpManager {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.choices = [];

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
        this.choices = [];
        this.game.paused = true;
        this.game.audio.play('item_pickup', { pitch: 0.5 }); // Placeholder sound

        // Generate 3 unique choices
        // For now we just pick random upgrade types, duplicate types allowed if we implement stacking?
        // Let's allow duplicate types (e.g. 2 Hull upgrades of diff rarity)

        for (let i = 0; i < 3; i++) {
            this.choices.push(this.generateChoice(forceRarity));
        }
    }

    generateChoice(forceRarity = null) {
        // 1. Pick Rarity
        let rarity;
        if (forceRarity) {
            rarity = this.rarities.find(r => r.id === forceRarity) || this.rarities[0];
        } else {
            rarity = this.rollRarity();
        }
        const rarityIndex = this.rarities.indexOf(rarity);

        // 2. Pick Upgrade Type
        const type = this.upgrades[Math.floor(Math.random() * this.upgrades.length)];

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
        if (index < 0 || index >= this.choices.length) return;

        const choice = this.choices[index];
        this.applyUpgrade(choice);

        this.active = false;
        this.game.paused = false;
        this.game.showNotification(`${choice.name} installed`, choice.rarity.color);
    }

    applyUpgrade(u) {
        const stats = this.game.playerShip.permanentStats;

        if (u.stat === 'maxHp') {
            // Percent increase base
            stats.hpMul = (stats.hpMul || 1.0) + u.value;
        } else if (u.stat === 'regen') {
            stats.regenAdd = (stats.regenAdd || 0) + u.value;
        } else if (u.stat === 'velocityRate') {
            stats.velocityRateAdd = (stats.velocityRateAdd || 0) + u.value;
        } else if (u.stat === 'laserRate') {
            stats.laserRateAdd = (stats.laserRateAdd || 0) + u.value;
        } else if (u.stat === 'mobility') {
            stats.speedMul = (stats.speedMul || 1.0) + u.value;
            stats.turnMul = (stats.turnMul || 1.0) + u.value;
        } else if (u.stat === 'missileSpeed') {
            stats.missileSpeedMul = (stats.missileSpeedMul || 1.0) + u.value;
        }

        this.game.playerShip.recalculateStats();
        // Heal nicely on upgrade
        this.game.playerShip.hp = this.game.playerShip.maxHp;
    }

    update() {
        // Mouse interaction
        if (!this.active) return;

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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, renderer.width, renderer.height);

        // Header
        ctx.fillStyle = '#fff';
        ctx.font = "bold 24px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText("system upgrade ready", renderer.width / 2, 100);

        ctx.font = "12px 'Press Start 2P'";
        ctx.fillStyle = '#aaa';
        ctx.fillText("select an enhancement", renderer.width / 2, 130);

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

            // Card BG
            ctx.fillStyle = '#111';
            ctx.fillRect(x, y, cw, ch);

            // Border (Rarity Color)
            ctx.strokeStyle = choice.rarity.color;
            ctx.lineWidth = isHover ? 4 : 2;
            ctx.strokeRect(x, y, cw, ch);

            if (isHover) {
                ctx.fillStyle = choice.rarity.color;
                ctx.globalAlpha = 0.1;
                ctx.fillRect(x, y, cw, ch);
                ctx.globalAlpha = 1.0;
            }

            // Content
            const cx = x + cw / 2;

            // Rarity Label
            ctx.fillStyle = choice.rarity.color;
            ctx.font = "10px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.fillText(choice.rarity.name, cx, y + 30);

            // Upgrade Name
            ctx.fillStyle = '#fff';
            // Wrap text if needed? Basic Implementation first
            ctx.font = "12px 'Press Start 2P'";
            this.wrapText(ctx, choice.name, cx, y + 70, cw - 20, 16);

            // Stat Value
            ctx.font = "24px 'Press Start 2P'";
            let valStr = "";
            let prefix = "+";
            if (choice.mode === 'multiply') valStr = `${Math.round(choice.value * 100)}%`;
            else if (choice.stat === 'regen') valStr = `${choice.value}/s`;
            else valStr = `${Math.round(choice.value * 100)}%`; // Default percent

            ctx.fillText(prefix + valStr, cx, y + 140);

            // Description
            ctx.fillStyle = '#888';
            ctx.font = "8px 'Press Start 2P'";
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
