import {
    VAULT_CONTAINMENT_DURATION,
    VAULT_CONTRACTS,
    VaultContract,
    VaultPhase
} from '../../shared/vault/VaultDefinitions.js';
import { getVaultLayout } from '../vault/VaultLayout.js';

const TAU = Math.PI * 2;

export const VaultRenderer = {
    draw(renderer, room, eyeCandy = true) {
        const ctx = renderer.ctx;
        const layout = getVaultLayout(room);
        const state = room.vaultState;
        const time = room.vaultChests?.[0]?.life || state?.elapsed || 0;
        const active = state?.phase === VaultPhase.CONTAINMENT;

        ctx.save();
        ctx.fillStyle = 'rgba(3, 7, 15, 0.72)';
        ctx.fillRect(room.x + 18, room.y + 18, room.width - 36, room.height - 36);

        this.drawFloorCircuit(ctx, room, layout, active, time, eyeCandy);
        this.drawReliquary(ctx, layout.center, state, time);
        for (let i = 0; i < layout.pylons.length; i++) {
            this.drawPylon(ctx, layout.pylons[i], i, active, time);
        }
        for (const chest of room.vaultChests || []) {
            this.drawContractNode(ctx, chest, state, time);
        }
        ctx.restore();
    },

    drawFloorCircuit(ctx, room, layout, active, time, eyeCandy) {
        const pulse = active ? 0.5 + Math.sin(time * 6) * 0.25 : 0.24;
        ctx.strokeStyle = `rgba(61, 220, 255, ${pulse})`;
        ctx.lineWidth = 3;
        for (const pylon of layout.pylons) {
            ctx.beginPath();
            ctx.moveTo(layout.center.x, layout.center.y);
            ctx.lineTo(pylon.x, pylon.y);
            ctx.stroke();
        }

        ctx.strokeStyle = active ? '#ff4f70' : 'rgba(85, 255, 194, 0.35)';
        ctx.lineWidth = active ? 6 : 3;
        ctx.strokeRect(
            room.x + 105,
            room.y + 105,
            room.width - 210,
            room.height - 210
        );

        if (!eyeCandy) return;
        ctx.strokeStyle = 'rgba(61, 220, 255, 0.17)';
        ctx.lineWidth = 2;
        for (let radius = 230; radius <= 560; radius += 110) {
            ctx.beginPath();
            ctx.arc(layout.center.x, layout.center.y, radius, 0, TAU);
            ctx.stroke();
        }
        for (const gate of layout.gates) {
            ctx.beginPath();
            ctx.arc(gate.x, gate.y, 75, time * 0.4, time * 0.4 + Math.PI);
            ctx.stroke();
        }
    },

    drawReliquary(ctx, center, state, time) {
        const phase = state?.phase || VaultPhase.OFFER;
        const reward = phase === VaultPhase.REWARD;
        const completed = phase === VaultPhase.COMPLETED;
        const contract = VAULT_CONTRACTS[state?.contractId];
        const color = contract?.color || '#3ddcff';
        const radius = reward ? 105 + Math.sin(time * 4) * 8 : 86;

        ctx.fillStyle = completed ? 'rgba(6, 16, 22, 0.75)' : 'rgba(4, 12, 20, 0.95)';
        ctx.strokeStyle = completed ? 'rgba(85, 255, 194, 0.28)' : color;
        ctx.lineWidth = reward ? 8 : 4;
        polygon(ctx, center.x, center.y, radius, 8, Math.PI / 8);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = reward ? '#ffffff' : 'rgba(61, 220, 255, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const rotation = time * (phase === VaultPhase.CONTAINMENT ? 1.7 : 0.35);
        ctx.arc(center.x, center.y, radius + 35, rotation, rotation + Math.PI * 1.45);
        ctx.stroke();

        if (phase === VaultPhase.CONTAINMENT) {
            const pct = Math.min(1, state.elapsed / VAULT_CONTAINMENT_DURATION);
            ctx.strokeStyle = color;
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius + 52, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
            ctx.stroke();
        }

        ctx.fillStyle = reward ? '#ffffff' : color;
        ctx.globalAlpha = reward ? 0.9 : 0.55;
        ctx.fillRect(center.x - 9, center.y - 42, 18, 84);
        ctx.fillRect(center.x - 42, center.y - 9, 84, 18);
        ctx.globalAlpha = 1;
    },

    drawPylon(ctx, pylon, index, active, time) {
        const pulse = active ? 0.55 + Math.sin(time * 7 + index) * 0.35 : 0.28;
        ctx.fillStyle = 'rgba(3, 12, 19, 0.95)';
        ctx.strokeStyle = active ? `rgba(255, 79, 112, ${pulse})` : 'rgba(61, 220, 255, 0.45)';
        ctx.lineWidth = active ? 7 : 4;
        polygon(ctx, pylon.x, pylon.y, 58, 6, Math.PI / 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = active ? '#ff4f70' : '#3ddcff';
        ctx.fillRect(pylon.x - 5, pylon.y - 29, 10, 58);
        ctx.fillRect(pylon.x - 29, pylon.y - 5, 58, 10);
    },

    drawContractNode(ctx, chest, state, time) {
        const definition = VAULT_CONTRACTS[chest.contractId];
        const color = definition?.color || '#3ddcff';
        const chosen = state?.contractId === chest.contractId;
        const sealed = chest.sealed || (
            state?.contractId && !chosen
        );
        const active = chosen && state?.phase === VaultPhase.CONTAINMENT;
        const radius = 58 + (active ? Math.sin(time * 8) * 5 : 0);

        ctx.fillStyle = 'rgba(3, 10, 18, 0.95)';
        ctx.strokeStyle = sealed ? 'rgba(100, 112, 128, 0.55)' : color;
        ctx.lineWidth = chosen ? 7 : 4;
        if (chest.contractId === VaultContract.GILDED) {
            polygon(ctx, chest.x, chest.y, radius, 4, Math.PI / 4);
        } else {
            ctx.beginPath();
            ctx.arc(chest.x, chest.y, radius, 0, TAU);
        }
        ctx.fill();
        ctx.stroke();

        if (chest.contractId === VaultContract.GILDED) {
            ctx.fillStyle = sealed ? '#667080' : color;
            for (let i = -1; i <= 1; i++) {
                ctx.fillRect(chest.x + i * 17 - 5, chest.y - 27, 10, 54);
            }
        } else {
            ctx.strokeStyle = sealed ? '#667080' : color;
            ctx.lineWidth = 5;
            for (let i = 0; i < 8; i++) {
                const angle = i * TAU / 8;
                ctx.beginPath();
                ctx.moveTo(
                    chest.x + Math.cos(angle) * (radius - 8),
                    chest.y + Math.sin(angle) * (radius - 8)
                );
                ctx.lineTo(
                    chest.x + Math.cos(angle) * (radius + 15),
                    chest.y + Math.sin(angle) * (radius + 15)
                );
                ctx.stroke();
            }
        }

        if (sealed) {
            ctx.strokeStyle = '#667080';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(chest.x - 42, chest.y - 42);
            ctx.lineTo(chest.x + 42, chest.y + 42);
            ctx.moveTo(chest.x + 42, chest.y - 42);
            ctx.lineTo(chest.x - 42, chest.y + 42);
            ctx.stroke();
        }
    }
};

function polygon(ctx, x, y, radius, sides, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = rotation + i * TAU / sides;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}
