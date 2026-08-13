import { Assets } from '../../Assets.js';
import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';
import { WEAPON_FAMILIES } from '../../shared/combat/WeaponFamilies.js';
import {
    getBuildRatings,
    getBaseProjectileSpeed,
    getBaseWeaponRange,
    isBeamWeapon,
    getWeaponProfile,
    clamp,
    massMovementMultipliers
} from '../../shared/combat/ShipBuildProfile.js';

export class Hangar {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.selectedPartId = 'hull';
        this.rotation = 0;
        this.rotateDebounce = false;
        this.draftShip = null; // The temporary ship we edit

        this.hasInfiniteParts = false;
        this.inventory = {};


        // Create UI
        this.ui = document.createElement('div');
        this.ui.id = 'hangar-ui';
        this.ui.style.display = 'none';
        this.ui.innerHTML = `
            <header class="hangar-commandbar">
                <div><span class="hangar-live-dot"></span><b>frame configuration</b><small>changes stay local until you save and close</small></div>
                <div class="hangar-command-hints"><span>place <b>lmb</b></span><span>remove <b>rmb</b></span><span>rotate <b>r</b></span><span>commit <b>tab</b></span></div>
            </header>
            <div class="workshop-layout">
                <section id="stats-panel" class="workshop-panel workshop-stats">
                    <div class="ui-kicker">live build telemetry</div>
                    <div class="workshop-title">performance</div>
                    <div id="stat-content"></div>
                </section>

                <section class="workshop-panel workshop-inventory">
                    <div class="ui-kicker">available hardware</div>
                    <div class="workshop-title">module rack</div>
                    <div id="part-list" class="workshop-list"></div>
                    <div id="utility-btns"></div>
                </section>
            </div>
        `;
        document.body.appendChild(this.ui);

        // Track hover to prevent click-through
        this.isHoveringUI = false;
        this.ui.onmouseenter = () => this.isHoveringUI = true;
        this.ui.onmouseleave = () => this.isHoveringUI = false;

        // CRITICAL: Stop mouse events from reaching the game canvas/input system
        this.ui.addEventListener('mousedown', (e) => e.stopPropagation());
        this.ui.addEventListener('mouseup', (e) => e.stopPropagation());
        this.ui.addEventListener('click', (e) => e.stopPropagation());
        this.ui.addEventListener('contextmenu', (e) => e.stopPropagation());

        // Tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'hangar-tooltip';
        this.tooltip.className = 'workshop-tooltip';
        document.body.appendChild(this.tooltip);

        window.addEventListener('mousemove', (e) => {
            if (!this.active || this.tooltip.style.display === 'none') return;
            Hangar.positionTooltip(this.tooltip, e.clientX, e.clientY);
        });

        this.updateUI();
    }

    updateUI() {
        const list = this.ui.querySelector('#part-list');
        list.innerHTML = '';

        Object.keys(this.inventory).forEach(key => {
            const count = this.inventory[key];
            const def = PartsLibrary[key];
            if (!def) return;

            // Loop to show EVERY physical item
            // If count is 0 but it's selected, show 1 'ghost' item
            const displayCount = (count === 0 && this.selectedPartId === key) ? 1 : count;

            for (let i = 0; i < displayCount; i++) {
                const isGhost = (count === 0);
                const itemWrapper = document.createElement('div');
                itemWrapper.className = [
                    'inventory-item',
                    this.selectedPartId === key ? 'is-selected' : '',
                    isGhost ? 'is-empty' : ''
                ].filter(Boolean).join(' ');
                const spanW = def.width || 1;
                const spanH = def.height || 1;
                itemWrapper.style.gridColumn = `span ${spanW}`;
                itemWrapper.style.gridRow = `span ${spanH}`;
                itemWrapper.style.width = `${64 * spanW}px`;
                itemWrapper.style.height = `${64 * spanH}px`;

                // Selection marker
                if (this.selectedPartId === key) {
                    const marker = document.createElement('div');
                    marker.className = 'inventory-selection-marker';
                    itemWrapper.appendChild(marker);
                }

                const canvas = document.createElement('canvas');
                const sprite = def.baseSprite || def.sprite;
                canvas.width = sprite.width * sprite.scale;
                canvas.height = sprite.height * sprite.scale;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                // Force center anchor (0.5, 0.5) for inventory display to avoid off-center custom pivots
                sprite.draw(ctx, canvas.width / 2, canvas.height / 2, 0, 0.5, 0.5);
                if (def.baseSprite && def.drawTurretInInventory) {
                    def.sprite.draw(ctx, canvas.width / 2, canvas.height / 2, 0, 0.5, 0.5);
                }

                itemWrapper.appendChild(canvas);

                itemWrapper.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedPartId = key;
                    this.updateUI();
                };

                itemWrapper.onmouseenter = (event) => {
                    this.tooltip.style.display = 'block';
                    this.updateTooltip(def);
                    if (isGhost) {
                        this.tooltip.innerHTML += `<div style="color:#f44; margin-top:5px; font-weight:bold;">out of stock</div>`;
                    }
                    Hangar.positionTooltip(this.tooltip, event.clientX, event.clientY);
                };
                itemWrapper.onmouseleave = () => {
                    this.tooltip.style.display = 'none';
                };

                list.appendChild(itemWrapper);
            }
        });

        const utility = this.ui.querySelector('#utility-btns');
        utility.innerHTML = '';

        this.updateStatsUI();
    }

    updateTooltip(def) {
        Hangar.updateTooltip(this.tooltip, def, this.draftShip);
    }

    static positionTooltip(tooltipEl, pointerX, pointerY, viewport = null) {
        const gap = 15;
        const margin = 10;
        const bounds = tooltipEl.getBoundingClientRect?.() || {};
        const width = Number(bounds.width) || tooltipEl.offsetWidth || 0;
        const height = Number(bounds.height) || tooltipEl.offsetHeight || 0;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        let left = pointerX + gap;
        let top = pointerY + gap;

        if (left + width > viewportWidth - margin) left = pointerX - width - gap;
        if (top + height > viewportHeight - margin) top = pointerY - height - gap;

        left = clamp(left, margin, Math.max(margin, viewportWidth - width - margin));
        top = clamp(top, margin, Math.max(margin, viewportHeight - height - margin));
        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.top = `${Math.round(top)}px`;
    }

    static updateTooltip(tooltipEl, def, ship = null) {
        const stats = [];
        if (def.stats) {
            if (def.stats.hp) stats.push(['integrity', `+${def.stats.hp}`, '#ff4d5a']);
            if (def.stats.mass) stats.push(['mass', `${def.stats.mass}t`, '#bde9df']);
            if (def.stats.damage) stats.push(['damage', def.stats.damage, '#ff8a3d']);
            if (def.stats.cooldown) stats.push(['cooldown', `${def.stats.cooldown}s`, '#ffc857']);
            if (def.stats.chargeTime) stats.push(['charge', `${def.stats.chargeTime}s`, '#ffc857']);
            if (def.stats.regen) stats.push(['regen', `+${def.stats.regen}/s`, '#74ff6a']);
            if (def.stats.thrust) stats.push(['thrust', `+${def.stats.thrust}`, '#55ffc2']);
            if (def.type === 'accelerant') {
                stats.push(['laser fire rate', '+12%', '#74ff6a']);
                stats.push(['laser damage', '-8%', '#ff6978']);
            }
            if (def.type === 'rocket_bay') {
                stats.push(['rocket payload', '+1', '#74ff6a']);
                stats.push(['rocket reload', '+20%', '#ff6978']);
            }
            if (def.type === 'booster') stats.push(['system', 'dash enabled', '#55ffc2']);
            if (def.id === 'coolant_loop') {
                stats.push(['all fire rate', '+12%', '#74ff6a']);
                stats.push(['direct damage', '-8%', '#ff6978']);
            }
            if (def.id === 'gyro_ring') stats.push(['top speed', '-10%', '#ff6978']);
            if (def.id === 'rangefinder') {
                stats.push(['shot range', '+20%', '#74ff6a']);
                stats.push(['shot speed', '+15%', '#74ff6a']);
                stats.push(['gun reload', '+11%', '#ff6978']);
            }
            if (def.id === 'auto_aim') stats.push(['direct damage', '-12%', '#ff6978']);
            if (def.id === 'fmj') stats.push(['ballistic reload', '+18%', '#ff6978']);
            for (const bonus of def.bonuses || []) stats.push(['bonus', bonus, '#74ff6a']);
            for (const drawback of def.drawbacks || []) stats.push(['cost', drawback, '#ff6978']);
            if (def.type === 'weapon' && ship?.stats?.profile) {
                const weapon = getWeaponProfile(ship.stats.profile, def);
                const baseSpeed = getBaseProjectileSpeed(def);
                stats.push(['actual damage', (def.stats.damage * weapon.damageMul).toFixed(1), '#ff8a3d']);
                stats.push(['actual cooldown', `${(def.stats.cooldown / weapon.fireRateMul).toFixed(2)}s`, '#ffc857']);
                stats.push(['actual range', `${Math.round(getBaseWeaponRange(def) * weapon.rangeMul)}u`, '#55ffc2']);
                if (baseSpeed > 0 && !isBeamWeapon(def)) {
                    stats.push(['actual shot speed', `${Math.round(baseSpeed * weapon.projectileSpeedMul)}u/s`, '#55ffc2']);
                }
            }
        }

        let rarityColor = '#0f0'; // Common
        if (def && def.rarity === 'rare') rarityColor = '#0088ff';
        if (def && def.rarity === 'epic') rarityColor = '#aa00ff';
        if (def && def.rarity === 'legendary') rarityColor = '#ffaa00';
        const familyColor = WEAPON_FAMILIES[def.stats?.weaponGroup]?.color || rarityColor;
        tooltipEl.style.setProperty('--tooltip-accent', familyColor);

        tooltipEl.innerHTML = `
            <div class="workshop-tooltip-kicker">part telemetry // ${def.rarity || 'common'}</div>
            <div class="workshop-tooltip-name" style="color:${familyColor}">
                ${String(def.name).toLowerCase()}
            </div>
            <div class="workshop-tooltip-description">
                ${String(def.description || 'no specification')}
            </div>
            <div class="workshop-tooltip-meta">
                <span style="color:${rarityColor}">${def.rarity || 'common'}</span>
                <span>${def.type}${def.stats.weaponGroup ? ` // ${def.stats.weaponGroup}` : ''}</span>
                <span>${def.width}x${def.height}</span>
            </div>
            <div class="workshop-tooltip-stats">
                ${stats.map(([label, value, color]) => `
                    <span>${label}</span><strong style="color:${color}">${value}</strong>
                `).join('')}
            </div>
        `;
    }

    updateStatsUI() {
        const statPanel = this.ui.querySelector('#stat-content');
        if (!statPanel || !this.draftShip) return;

        const stats = this.draftShip.stats;
        const perm = this.draftShip.permanentStats;
        const levelBonus = 1 + (this.game.level - 1) * 0.01;
        const profile = stats.profile || {};
        const massMovement = massMovementMultipliers(stats.totalMass);
        const thrustMultiplier = 1 + (stats.thrust || 0) * 0.05;
        const acceleration = 2500 * thrustMultiplier * clamp(
            massMovement.acceleration * (profile.accelerationMul || 1),
            0.4,
            2
        );
        const topSpeed = 150 * thrustMultiplier * clamp(
            massMovement.speed * (profile.speedMul || 1),
            0.4,
            2
        );
        const ratings = getBuildRatings(this.draftShip, PartsLibrary);
        const currentRatings = getBuildRatings(this.game.playerShip, PartsLibrary);
        const ratingRow = (label, value) => {
            const delta = value - (currentRatings[label] || 0);
            const suffix = delta === 0 ? '' : ` // ${delta > 0 ? '+' : ''}${delta}`;
            return statRow({
                label: label.replace(/([A-Z])/g, ' $1').toLowerCase(),
                value: `${value}${suffix}`,
                color: delta > 0 ? '#74ff6a' : delta < 0 ? '#ff6978' : '#bde9df'
            });
        };

        // Fire Rate Bonuses
        const boundedRate = value => Math.min(2.5, Math.max(0.45, value));
        const velocityFR = Math.round((boundedRate(
            levelBonus *
            (profile.globalFireRateMul || 1) *
            (profile.directFireRateMul || 1) *
            (profile.velocityFireRateMul || 1)
        ) - 1
        ) * 100);

        const laserFR = Math.round((boundedRate(
            levelBonus *
            (profile.globalFireRateMul || 1) *
            (profile.directFireRateMul || 1) *
            (profile.laserFireRateMul || 1)
        ) - 1
        ) * 100);
        const rocketFR = Math.round((boundedRate(
            levelBonus *
            (profile.globalFireRateMul || 1) *
            (profile.directFireRateMul || 1) *
            (profile.rocketFireRateMul || 1)
        ) - 1
        ) * 100);

        // Turn Speed Calc (Matching PlayerControlSystem)
        const baseTurnRate = 5.0;
        const currentMass = (stats.totalMass || 5);
        const turnSpeedVal = (Math.max(0.5, baseTurnRate * (5 / currentMass)) + (stats.turnSpeed || 0)) *
            (profile.turnMul || 1);

        const missileSpeedBonus = Math.round(((profile.rocketSpeedMul || 1) - 1) * 100);

        const rows = [
            { label: 'integrity', value: `${stats.totalHp} hp`, color: '#ff4444' },
            { label: 'mass', value: `${stats.totalMass.toFixed(1)} t`, color: '#aaa' },
            { label: 'regen', value: `${((stats.regen || 0) * levelBonus).toFixed(1)} /s`, color: '#44ff44' },
            { label: 'acceleration', value: `${Math.round(acceleration)} u/s²`, color: '#55ffc2' },
            { label: 'top speed', value: `${Math.round(topSpeed)} u/s`, color: '#55ffc2' },
            { label: 'turn rate', value: `${turnSpeedVal.toFixed(2)} rad/s`, color: '#55ffc2' },
            { label: 'velocity rate', value: `${velocityFR >= 0 ? '+' : ''}${velocityFR}%`, color: '#ffaa44' },
            { label: 'laser rate', value: `${laserFR >= 0 ? '+' : ''}${laserFR}%`, color: '#ffaa44' },
            { label: 'missile rate', value: `${rocketFR >= 0 ? '+' : ''}${rocketFR}%`, color: '#ffaa44' },
            { label: 'missile speed', value: `${missileSpeedBonus >= 0 ? '+' : ''}${missileSpeedBonus}%`, color: '#ffaa44' },
            { label: 'drone capacity', value: `${stats.droneCapacity || 0}`, color: '#57d8ff' }
        ];

        if (stats.rocketBayCount > 0) {
            rows.push({ label: 'extra rockets', value: `+${stats.rocketBayCount}`, color: '#ffaa44' });
        }

        statPanel.innerHTML = `
            <div class="workshop-stat-group">
                <div class="workshop-stat-heading">frame performance</div>
                ${rows.slice(0, 6).map(statRow).join('')}
            </div>
            <div class="workshop-stat-group">
                <div class="workshop-stat-heading">combat routing</div>
                ${rows.slice(6).map(statRow).join('')}
            </div>
            <div class="workshop-stat-group">
                <div class="workshop-stat-heading">build ratings // starter = 100</div>
                ${Object.entries(ratings).map(([label, value]) => ratingRow(label, value)).join('')}
            </div>
            <div class="workshop-stat-group">
                <div class="workshop-stat-heading">active doctrine</div>
                ${statRow({ label: profile.doctrineName || 'balanced', value: profile.doctrineId ? 'online' : 'none', color: profile.doctrineId ? '#ffaa00' : '#8eaaa2' })}
                ${profile.doctrineId ? `<div class="workshop-tooltip-description">${PartsLibrary[`doctrine_${profile.doctrineId}`]?.description || ''}</div>` : ''}
                ${(PartsLibrary[`doctrine_${profile.doctrineId}`]?.bonuses || []).map(value => statRow({ label: 'bonus', value, color: '#74ff6a' })).join('')}
                ${(PartsLibrary[`doctrine_${profile.doctrineId}`]?.drawbacks || []).map(value => statRow({ label: 'cost', value, color: '#ff6978' })).join('')}
                ${profile.doctrineId === 'gunship' ? statRow({ label: 'linked guns', value: `${profile.directWeaponCount} // +${Math.round((profile.gunshipRateBonus || 0) * 100)}% rate`, color: '#ffaa00' }) : ''}
                ${profile.doctrineId === 'phantom' ? statRow({ label: 'ambush', value: `${Math.round((profile.ambushDamageMul - 1) * 100)}% bonus after ${profile.ambushArmSeconds}s`, color: '#ffaa00' }) : ''}
            </div>
        `;

        // Permanent Upgrades List
        const upgradeRows = [];

        if (perm.hpMul > 1.0) upgradeRows.push({ label: 'hull integrity', value: `+${Math.round((perm.hpMul - 1) * 100)}%` });
        if (perm.regenAdd > 0) upgradeRows.push({ label: 'hull regen', value: `+${perm.regenAdd}/s` });
        if (perm.velocityRateAdd > 0) upgradeRows.push({ label: 'velocity rate', value: `+${Math.round(perm.velocityRateAdd * 100)}%` });
        if (perm.velocityDamageMul > 1) upgradeRows.push({ label: 'ballistic damage', value: `+${Math.round((perm.velocityDamageMul - 1) * 100)}%` });
        if (perm.velocityPierce > 0) upgradeRows.push({ label: 'ballistic pierce', value: `+${perm.velocityPierce}` });
        if (perm.laserRateAdd > 0) upgradeRows.push({ label: 'laser rate', value: `+${Math.round(perm.laserRateAdd * 100)}%` });
        if (perm.laserDamageMul > 1) upgradeRows.push({ label: 'laser damage', value: `+${Math.round((perm.laserDamageMul - 1) * 100)}%` });
        if (perm.laserChain > 0) upgradeRows.push({ label: 'laser chain', value: `+${perm.laserChain}` });
        if (perm.rocketRateAdd > 0) upgradeRows.push({ label: 'missile rate', value: `+${Math.round(perm.rocketRateAdd * 100)}%` });
        if (perm.rocketDamageMul > 1) upgradeRows.push({ label: 'missile damage', value: `+${Math.round((perm.rocketDamageMul - 1) * 100)}%` });
        if (perm.rocketBlastMul > 1) upgradeRows.push({ label: 'blast radius', value: `+${Math.round((perm.rocketBlastMul - 1) * 100)}%` });
        if (perm.speedMul > 1.0) upgradeRows.push({ label: 'flight speed', value: `+${Math.round((perm.speedMul - 1) * 100)}%` });
        if (perm.turnMul > 1.0) upgradeRows.push({ label: 'turn speed', value: `+${Math.round((perm.turnMul - 1) * 100)}%` });
        if (perm.missileSpeedMul > 1.0) upgradeRows.push({ label: 'missile speed', value: `+${Math.round((perm.missileSpeedMul - 1) * 100)}%` });

        if (upgradeRows.length > 0) {
            statPanel.innerHTML += `
                <div class="workshop-stat-group workshop-augments">
                    <div class="workshop-stat-heading">augmentations</div>
                    ${upgradeRows.map(r => statRow({ ...r, color: '#74ff6a' })).join('')}
                </div>
            `;
        }
    }

    toggle() {
        this.active = !this.active;
        this.ui.style.display = this.active ? 'block' : 'none';
        this.tooltip.style.display = 'none';

        if (this.active) {
            // OPENING: Pause game and Clone Ship
            this.game.paused = true;
            this.draftShip = this.game.playerShip.clone();
            // Reset rotation to 0 for editing comfort
            this.rotation = 0;
            this.updateUI();
            if (this.game.peerNetwork?.isGuest) {
                this.game.peerNetwork.sendInput?.({});
                this.game.peerNetwork.sendFireIntent?.(false, 0);
            } else if (this.game.peerNetwork?.isHost) {
                this.game.peerNetwork.flushAuthoritativeState?.();
            }
        } else {
            // CLOSING: Resume game and Apply Changes
            this.game.paused = false;
            // Apply draft to real ship
            if (this.draftShip) {
                const parts = [...this.draftShip.getUniqueParts()].map(
                    part => ({
                        x: part.x,
                        y: part.y,
                        partId: part.partId,
                        rotation: part.rotation || 0
                    })
                );
                this.game.playerShip = this.draftShip;
                this.draftShip = null;
                if (this.game.peerNetwork?.isGuest) {
                    this.game.peerNetwork.sendInput?.({});
                    this.game.peerNetwork.sendFireIntent?.(false, 0);
                    this.game.peerNetwork.sendShipEdit?.(parts);
                } else if (this.game.peerNetwork?.isHost) {
                    this.game.peerNetwork.flushAuthoritativeFullState?.();
                }
            }
        }
    }

    resetRunState() {
        this.active = false;
        this.ui.style.display = 'none';
        this.tooltip.style.display = 'none';
        this.isHoveringUI = false;
        this.selectedPartId = 'hull';
        this.rotation = 0;
        this.rotateDebounce = false;
        this.lastPlacedGrid = null;
        this.draftShip = null;
        this.hasInfiniteParts = false;
        this.inventory = {};
    }

    update(dt) {
        if (!this.active) return;

        // Hangar Input Logic is simpler now: No global rotation to worry about relative to screen
        // We render the ship at the center of the screen

        if (this.game.input.isKeyDown('KeyR')) {
            if (!this.rotateDebounce) {
                this.rotation = (this.rotation + 1) % 4;
                this.rotateDebounce = true;
            }
        } else {
            this.rotateDebounce = false;
        }
    }

    draw(renderer) {
        if (!this.active || !this.draftShip) return;

        // Draw Modal Background
        renderer.drawRect(0, 0, renderer.width, renderer.height, 'rgba(0,0,0,0.85)');

        // Editor Center
        const centerX = renderer.width / 2;
        const centerY = renderer.height / 2;

        renderer.ctx.save();
        renderer.ctx.translate(centerX, centerY);

        // Draw Grid centered at 0,0 (which is now screen center)
        const CELL_STRIDE = TILE_SIZE;
        const gridSize = 15;
        renderer.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        renderer.ctx.lineWidth = 1;
        renderer.ctx.beginPath();
        for (let x = -gridSize; x <= gridSize; x++) {
            renderer.ctx.moveTo(x * CELL_STRIDE - CELL_STRIDE / 2, -gridSize * CELL_STRIDE - CELL_STRIDE / 2);
            renderer.ctx.lineTo(x * CELL_STRIDE - CELL_STRIDE / 2, gridSize * CELL_STRIDE + CELL_STRIDE / 2);
        }
        for (let y = -gridSize; y <= gridSize; y++) {
            renderer.ctx.moveTo(-gridSize * CELL_STRIDE - CELL_STRIDE / 2, y * CELL_STRIDE - CELL_STRIDE / 2);
            renderer.ctx.lineTo(gridSize * CELL_STRIDE + CELL_STRIDE / 2, y * CELL_STRIDE - CELL_STRIDE / 2);
        }
        renderer.ctx.stroke();

        // Draw DRAFT SHIP parts
        // Note: Sprite.draw expects world coordinates.
        // Since we translated to center, drawing at (part.x * STRIDE) works as local coord.

        for (const partRef of this.draftShip.getUniqueParts()) {
            const def = PartsLibrary[partRef.partId];
            if (def) {
                const isRotated = ((partRef.rotation || 0) % 2 !== 0);
                const w = isRotated ? def.height : def.width;
                const h = isRotated ? def.width : def.height;

                // Center of the cell(s)
                const drawX = (partRef.x + (w - 1) / 2) * CELL_STRIDE;
                const drawY = (partRef.y + (h - 1) / 2) * CELL_STRIDE;

                // Draw base block for weapons
                if (def.type === 'weapon') {
                    if (def.baseSprite) {
                        def.baseSprite.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                    } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                        Assets.LongHull.draw(renderer.ctx, drawX, drawY, (partRef.rotation || 0) * (Math.PI / 2), 0.5, 0.5);
                    } else {
                        Assets.PlayerBase.draw(renderer.ctx, drawX, drawY, 0, 0.5, 0.5);
                    }
                }

                const angle = (partRef.rotation || 0) * (Math.PI / 2); // Static for draft? 
                // Actually, turrets in draft are static.
                const offset = def.turretDrawOffset || 0;
                const turretX = drawX + Math.cos(angle) * offset;
                const turretY = drawY + Math.sin(angle) * offset;

                def.sprite.draw(renderer.ctx, turretX, turretY, angle + (def.rotationOffset || 0), null, null);
            }
        }

        // Mouse Interaction
        const mouse = this.game.input.getMousePos();
        // Mouse is screen relative. Center is at centerX, centerY.
        const localX = mouse.x - centerX;
        const localY = mouse.y - centerY;

        // Determine tool dimensions
        const partDef = PartsLibrary[this.selectedPartId];
        if (partDef) {
            const isRotated = (this.rotation % 2 !== 0);
            const w = isRotated ? partDef.height : partDef.width;
            const h = isRotated ? partDef.width : partDef.height;

            const halfW = (w * CELL_STRIDE) / 2;
            const halfH = (h * CELL_STRIDE) / 2;

            const gx = Math.round(localX / CELL_STRIDE - (w - 1) / 2);
            const gy = Math.round(localY / CELL_STRIDE - (h - 1) / 2);

            const isValid = this.draftShip.canPlaceAt(gx, gy, this.selectedPartId, this.rotation);

            // Draw Ghost
            renderer.ctx.save();
            renderer.ctx.globalAlpha = 0.6;

            // If invalid, we could tint it red. For now, let's just use low alpha or draw a red overlay.
            if (!isValid) {
                renderer.ctx.globalAlpha = 0.3;
            }

            const ghostX = (gx + (w - 1) / 2) * CELL_STRIDE;
            const ghostY = (gy + (h - 1) / 2) * CELL_STRIDE;

            // Draw base block for weapon ghost
            if (partDef.type === 'weapon') {
                if (partDef.baseSprite) {
                    partDef.baseSprite.draw(renderer.ctx, ghostX, ghostY, this.rotation * (Math.PI / 2), 0.5, 0.5);
                } else if ((w === 1 && h === 2) || (w === 2 && h === 1)) {
                    Assets.LongHull.draw(renderer.ctx, ghostX, ghostY, this.rotation * (Math.PI / 2), 0.5, 0.5);
                } else {
                    Assets.PlayerBase.draw(renderer.ctx, ghostX, ghostY, 0, 0.5, 0.5);
                }
            }

            const angle = this.rotation * (Math.PI / 2);
            const offset = partDef.turretDrawOffset || 0;
            const turretX = ghostX + Math.cos(angle) * offset;
            const turretY = ghostY + Math.sin(angle) * offset;

            partDef.sprite.draw(renderer.ctx, turretX, turretY, angle + (partDef.rotationOffset || 0), null, null);

            if (!isValid) {
                renderer.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                renderer.ctx.fillRect(ghostX - halfW, ghostY - halfH, w * CELL_STRIDE, h * CELL_STRIDE);
            }

            renderer.ctx.restore();

            // Logic
            // Input Handling with Drag-Paint Support
            if (this.game.input.isMouseDown()) {
                if (!this.isHoveringUI) {
                    // Left Place
                    // Reset 'lastPlaced' if we released mouse (handled by logic below mostly, 
                    // but we need to track if we moved to a new cell)

                    const currentGridKey = `${gx},${gy}`;

                    // Logic: Attempt place if:
                    // 1. We have inventory
                    // 2. Position is valid
                    // 3. We haven't just placed at this EXACT coordinate in this drag sequence
                    //    (Prevents rapid-fire waste or re-calculations on same spot)

                    if (this.inventory[this.selectedPartId] > 0 && isValid) {
                        // Check if we already placed here this click-hold
                        if (this.lastPlacedGrid !== currentGridKey) {
                            if (this.draftShip.addPart(gx, gy, this.selectedPartId, this.rotation)) {
                                // Only decrement if NOT in infinite mode
                                if (!this.hasInfiniteParts) {
                                    this.inventory[this.selectedPartId]--;
                                }
                                this.updateUI();
                                this.lastPlacedGrid = currentGridKey; // Mark this cell as handled
                            }
                        }
                    } else if (!isValid && !this.game.mouseDownLastFrame) {
                        const conflict = this.draftShip.getUniqueGroupConflict?.(this.selectedPartId);
                        if (conflict?.uniqueGroup === 'doctrine') {
                            this.game.showNotification(
                                `${conflict.name.toLowerCase()} already controls this ship`,
                                '#ff4444'
                            );
                        }
                    }
                }
            } else if (this.game.input.isRightMouseDown()) {
                if (!this.isHoveringUI) {
                    // Right Remove
                    const rGx = Math.round(localX / CELL_STRIDE);
                    const rGy = Math.round(localY / CELL_STRIDE);
                    const currentGridKey = `${rGx},${rGy}`;

                    if (this.lastPlacedGrid !== currentGridKey) {
                        const existing = this.draftShip.getPart(rGx, rGy);
                        if (existing && existing.partId !== 'core') {
                            this.draftShip.removePart(rGx, rGy);
                            this.inventory[existing.partId] = (this.inventory[existing.partId] || 0) + 1;
                            this.updateUI();
                            this.lastPlacedGrid = currentGridKey;
                        }
                    }
                }
            } else {
                // Mouse Released
                this.lastPlacedGrid = null;
            }
        }

        renderer.ctx.restore();

    }
}

function statRow(row) {
    return `
        <div class="workshop-stat-row">
            <span>${row.label}</span>
            <strong style="color:${row.color}">${row.value}</strong>
        </div>
    `;
}
