import { TILE_SIZE, PartsLibrary } from '../../shared/parts/Part.js';
import { WEAPON_FAMILIES } from '../../shared/combat/WeaponFamilies.js';
import { UI_COLORS, UI_FONTS, drawUiPanel } from '../ui/UiTheme.js';
import { VAULT_CONTRACTS, VaultPhase } from '../../shared/vault/VaultDefinitions.js';
import { getVaultOffer } from '../vault/VaultEconomy.js';
import {
    getShopAccent,
    getShopActionText,
    getShopCategory,
    getShopHeader,
    getShopItemState,
    getShopStateLabel,
    getShopStatRows,
    getShopBobY
} from './ShopPresentation.js';

/** Native-HUD annotations projected through the exact world compositor map. */
export class WorldOverlayRenderer {
    constructor(game) {
        this.game = game;
    }

    draw() {
        const { game } = this;
        game.renderer.withWorldOverlay(game.camera, () => {
            this.drawTutorials();
            this.drawEnemyOverlays(game.enemies);
            this.drawEnemyOverlays(game.bosses);
            this.drawRemoteHealthBars();
            this.drawShopOverlays();
            this.drawChestOverlays();
            this.drawDamageNumbers();
        });
    }

    drawTutorials() {
        const { game } = this;
        if (game.floor !== 1 || !game.rooms) return;
        const ctx = game.renderer.ctx;
        for (const room of game.rooms) {
            if (room.gridX !== 0 || room.gridY !== 0) continue;
            const centerX = room.x + room.width / 2;
            const centerY = room.y + room.height / 2;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = UI_FONTS.title;
            ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.fillText('wasd: move', centerX - 100, centerY - 150);
            ctx.fillText('l-click: shoot', centerX - 100, centerY - 80);
            ctx.fillText('e: interact', centerX - 100, centerY - 10);
            ctx.fillText('tab: hangar', centerX - 100, centerY + 60);
            ctx.fillText('m: map', centerX - 100, centerY + 130);
            ctx.restore();
        }
    }

    drawEnemyOverlays(entities = []) {
        for (const entity of entities) {
            if (!entity || entity.isDead) continue;
            if (entity.type === 'dummy') this.drawTrainingDummyLabels(entity);
            else if (!entity.isWarpingIn) this.drawHealthBar(entity);
        }
    }

    drawRemoteHealthBars() {
        for (const [, player] of this.game.network?.otherPlayers || []) {
            if (!player?.isDead && player.hp < player.maxHp) this.drawHealthBar(player);
        }
    }

    drawHealthBar(entity) {
        if (!entity.maxHp || entity.maxHp <= 0) return;
        let barCenterX = entity.x;
        let topY = entity.y - (entity.radius || 20);
        if (entity.shipParts?.length) {
            const rotation = entity.rotation + (entity.rotationOffset || 0);
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            let minWorldY = Infinity;
            let minWorldX = Infinity;
            let maxWorldX = -Infinity;
            for (const partData of entity.shipParts) {
                const def = PartsLibrary[partData.partId];
                if (!def) continue;
                const rotated = ((partData.rotation || 0) % 2 !== 0);
                const width = rotated ? def.height : def.width;
                const height = rotated ? def.width : def.height;
                for (const corner of [
                    { x: partData.x, y: partData.y },
                    { x: partData.x + width, y: partData.y },
                    { x: partData.x, y: partData.y + height },
                    { x: partData.x + width, y: partData.y + height }
                ]) {
                    const localX = corner.x * TILE_SIZE;
                    const localY = corner.y * TILE_SIZE;
                    const worldX = entity.x + (localX * cos - localY * sin);
                    const worldY = entity.y + (localX * sin + localY * cos);
                    minWorldY = Math.min(minWorldY, worldY);
                    minWorldX = Math.min(minWorldX, worldX);
                    maxWorldX = Math.max(maxWorldX, worldX);
                }
            }
            if (Number.isFinite(minWorldY)) {
                topY = minWorldY;
                barCenterX = (minWorldX + maxWorldX) / 2;
            }
        }

        const barW = Math.min(160, Math.max(40, entity.maxHp / 2));
        const barH = 8;
        const hpPct = Math.max(0, entity.hp / entity.maxHp);
        const barY = topY - 25;
        const ctx = this.game.renderer.ctx;
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barCenterX - barW / 2 - 2, barY - 2, barW + 4, barH + 4);
        ctx.fillStyle = 'rgba(0, 20, 30, 0.8)';
        ctx.fillRect(barCenterX - barW / 2, barY, barW, barH);
        if (hpPct > 0) {
            const fillW = barW * hpPct;
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(barCenterX - barW / 2, barY, fillW, barH);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(barCenterX - barW / 2, barY, fillW, barH / 2);
        }
        const segmentCount = Math.floor(barW / 20);
        if (segmentCount > 1) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            for (let i = 1; i < segmentCount; i++) {
                const sx = (barCenterX - barW / 2) + (barW / segmentCount) * i;
                ctx.beginPath();
                ctx.moveTo(sx, barY - 2);
                ctx.lineTo(sx, barY + barH + 2);
                ctx.stroke();
            }
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = UI_FONTS.tiny;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(entity.hp)} /${Math.ceil(entity.maxHp)}`, barCenterX, barY + barH / 2 + 1);
        ctx.restore();
    }

    drawTrainingDummyLabels(dummy) {
        const ctx = this.game.renderer.ctx;
        ctx.fillStyle = '#fff';
        ctx.font = UI_FONTS.small;
        ctx.textAlign = 'center';
        ctx.fillText('training dummy', dummy.x, dummy.y - (dummy.radius + 30));
        ctx.fillStyle = '#0f0';
        ctx.font = UI_FONTS.title;
        ctx.fillText(`${dummy.currentDps} dps`, dummy.x, dummy.y - (dummy.radius + 5));
        ctx.textAlign = 'start';
    }

    drawShopOverlays() {
        const { game } = this;
        const items = game.shopItems || [];
        if (!items.length) return;

        this.drawShopHeader(items);
        const ctx = game.renderer.ctx;
        items.forEach((item, index) => {
            const state = getShopItemState(item, game.gold);
            const accent = getShopAccent(item);
            const bobY = getShopBobY(item);
            const labelY = bobY + (item.radius || 40) + 56;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = UI_FONTS.tiny;
            ctx.fillStyle = UI_COLORS.muted;
            ctx.fillText(
                `${String(index + 1).padStart(2, '0')} // ${String(item.data?.name || 'offer').toLowerCase()}`,
                item.x,
                labelY
            );
            ctx.fillStyle = state === 'sold'
                ? UI_COLORS.muted
                : state === 'unaffordable' ? UI_COLORS.red : accent;
            ctx.fillText(
                item.data?.type === 'doctrine_terminal'
                    ? 'open catalog'
                    : state === 'sold'
                    ? 'sold'
                    : `${item.data?.price || 0}g // ${getShopStateLabel(state)}`,
                item.x,
                labelY + 16
            );
            ctx.restore();
        });

        const item = game.hoveredShopItem;
        if (item && !item.purchased) this.drawShopTooltip(item, game.gold);
    }

    drawShopHeader(items) {
        const { game } = this;
        const ctx = game.renderer.ctx;
        const header = getShopHeader(items, game.gold);
        const centerX = items.reduce((sum, item) => sum + item.x, 0) / items.length;
        // Leave a clean lane above every offer for the hover card. The header
        // is persistent, so it must never sit behind the selected card.
        const topY = Math.min(...items.map(item => item.y)) - 312;
        const width = 360;
        const height = 76;
        const x = centerX - width / 2;
        drawUiPanel(ctx, x, topY, width, height, UI_COLORS.amber);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = UI_COLORS.amber;
        ctx.font = UI_FONTS.label;
        ctx.fillText('salvage exchange', x + 16, topY + 21);
        ctx.fillStyle = UI_COLORS.ink;
        ctx.font = UI_FONTS.small;
        ctx.fillText(header.label, x + 16, topY + 43);
        ctx.fillStyle = header.stockRemaining ? UI_COLORS.mint : UI_COLORS.muted;
        ctx.textAlign = 'right';
        ctx.fillText(header.stockLabel, x + width - 16, topY + 43);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.tiny;
        ctx.fillText('hover an offer // [e] or click to authorize', x + width - 16, topY + 62);
        ctx.restore();
    }

    drawShopTooltip(item, credits) {
        const ctx = this.game.renderer.ctx;
        const bobY = getShopBobY(item);
        const state = typeof credits === 'boolean'
            ? getShopItemState(item, credits ? item.data.price : item.data.price - 1)
            : getShopItemState(item, credits);
        const accent = getShopAccent(item);
        const category = getShopCategory(item);
        const rows = getShopStatRows(item, 4);
        const tooltipW = 300;
        const tooltipH = 168;
        const tooltipX = item.x - tooltipW / 2;
        const tooltipY = bobY - item.radius - tooltipH - 24;
        drawUiPanel(ctx, tooltipX, tooltipY, tooltipW, tooltipH, accent);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = accent;
        ctx.font = UI_FONTS.label;
        ctx.fillText(String(item.data?.name || 'offer').toLowerCase(), tooltipX + 16, tooltipY + 22);
        ctx.fillStyle = UI_COLORS.muted;
        ctx.font = UI_FONTS.tiny;
        ctx.fillText(
            `${category} // ${String(item.data?.description || 'no specification').toLowerCase()}`,
            tooltipX + 16,
            tooltipY + 40
        );

        rows.forEach((row, index) => {
            const column = index % 2;
            const rowIndex = Math.floor(index / 2);
            const rowX = tooltipX + 16 + column * 136;
            const rowY = tooltipY + 67 + rowIndex * 18;
            ctx.fillStyle = UI_COLORS.muted;
            ctx.fillText(`${row.label}:`, rowX, rowY);
            ctx.fillStyle = UI_COLORS.ink;
            ctx.textAlign = 'right';
            ctx.fillText(row.value, rowX + 112, rowY);
            ctx.textAlign = 'left';
        });

        const priceY = tooltipY + 122;
        ctx.fillStyle = UI_COLORS.muted;
        ctx.fillText('price:', tooltipX + 16, priceY);
        ctx.fillStyle = state === 'unaffordable' ? UI_COLORS.red : accent;
        ctx.textAlign = 'right';
        ctx.fillText(
            item.data?.type === 'doctrine_terminal' ? '90g each' : `${item.data?.price || 0}g`,
            tooltipX + tooltipW - 16,
            priceY
        );
        ctx.textAlign = 'left';
        ctx.fillStyle = state === 'unaffordable'
            ? UI_COLORS.red
            : state === 'sold' ? UI_COLORS.muted : UI_COLORS.mint;
        ctx.font = UI_FONTS.small;
        ctx.fillText(
            getShopActionText(item, typeof credits === 'boolean'
                ? credits ? item.data.price : item.data.price - 1
                : credits),
            tooltipX + 16,
            tooltipY + tooltipH - 18
        );
        ctx.restore();
    }

    drawChestOverlays() {
        const { game } = this;
        if (game.hoveredTreasureChest && !game.hoveredTreasureChest.opened) this.drawTreasureTooltip(game.hoveredTreasureChest);
        if (game.hoveredVaultChest && !game.hoveredVaultChest.opened) this.drawVaultTooltip(game.hoveredVaultChest);
    }

    drawTreasureTooltip(chest) {
        const ctx = this.game.renderer.ctx;
        const bobY = chest.y + Math.sin(chest.life * 1.5 + chest.bobOffset) * 8;
        const tooltipW = 150;
        const tooltipH = 50;
        const tooltipX = chest.x - tooltipW / 2;
        const tooltipY = bobY - chest.radius - tooltipH - 20;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.fillStyle = '#ffd700';
        ctx.font = "14px 'Silkscreen', 'Pixelify Sans', monospace";
        ctx.textAlign = 'center';
        ctx.fillText('treasure cache', chest.x, tooltipY + 20);
        ctx.fillStyle = '#44ff44';
        ctx.font = "13px 'Pixelify Sans', 'Silkscreen', monospace";
        ctx.fillText('[e] open', chest.x, tooltipY + 40);
        ctx.textAlign = 'left';
    }

    drawVaultTooltip(chest) {
        const { game } = this;
        chest.contractId ||= chest.costType === 'hp' ? 'blood' : 'gilded';
        const ctx = game.renderer.ctx;
        const bobY = chest.y + Math.sin(chest.life * 1.5 + chest.bobOffset) * 8;
        const state = game.currentRoom?.vaultState;
        const definition = VAULT_CONTRACTS[chest.contractId];
        const offer = getVaultOffer(chest.contractId, game, {
            id: 'host',
            ship: game.playerShip
        });
        const sealed = chest.sealed || (
            state?.contractId && state.contractId !== chest.contractId
        );
        const reward = state?.phase === VaultPhase.REWARD &&
            state.contractId === chest.contractId;
        const active = state?.phase === VaultPhase.CONTAINMENT &&
            state.contractId === chest.contractId;
        const tooltipW = 245;
        const tooltipH = 78;
        const tooltipX = chest.x - tooltipW / 2;
        const tooltipY = bobY - chest.radius - tooltipH - 20;
        const color = sealed ? '#667080' : definition?.color || '#3ddcff';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);
        ctx.fillStyle = color;
        ctx.font = "14px 'Silkscreen', 'Pixelify Sans', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(definition?.label || 'vault protocol', chest.x, tooltipY + 21);
        ctx.fillStyle = '#9cabb8';
        ctx.font = "13px 'Pixelify Sans', 'Silkscreen', monospace";
        ctx.fillText('exclusive contract // payer owns cache', chest.x, tooltipY + 43);
        ctx.fillStyle = reward || offer?.canAfford ? '#55ffc2' : '#ff4f70';
        let action = `[e] commit // ${offer?.costText || 'unavailable'}`;
        if (sealed) action = 'contract sealed';
        else if (active) action = 'containment active';
        else if (reward) action = '[e] claim cache';
        ctx.fillText(action, chest.x, tooltipY + 65);
        ctx.textAlign = 'left';
    }

    drawDamageNumbers() {
        const { game } = this;
        if (!game.showDamageNumbers) return;
        const ctx = game.renderer.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const damageNumber of game.damageNumbers) {
            const alpha = Math.min(1, damageNumber.life * 2);
            const color = damageNumber.isPlayer ? '#ff4444' : WEAPON_FAMILIES[damageNumber.source?.family]?.color || '#00ffff';
            ctx.font = `${Math.floor(12 * damageNumber.scale)}px 'Pixelify Sans', 'Silkscreen', monospace`;
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'black';
            ctx.fillStyle = 'black';
            ctx.fillText(Math.ceil(damageNumber.amount), damageNumber.x + 2, damageNumber.y + 2);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.fillText(Math.ceil(damageNumber.amount), damageNumber.x, damageNumber.y);
        }
        ctx.restore();
    }
}
