import { VaultPhase } from '../../shared/vault/VaultDefinitions.js';

export function claimVaultReward({
    room,
    chest,
    game,
    buyer,
    ItemPickupClass,
    random
}) {
    const state = room?.vaultState;
    if (
        !state ||
        !chest ||
        chest.opened ||
        state.phase !== VaultPhase.REWARD ||
        state.rewardSpawned ||
        state.contractId !== chest.contractId
    ) {
        return false;
    }

    chest.opened = true;
    state.phase = VaultPhase.COMPLETED;
    state.rewardSpawned = true;
    game.showNotification('vault cache acquired', '#55ffc2');
    game.audio.play('vault_claim', { volume: 0.8, pitch: 0.5 });
    game.spawnExplosion(chest.x, chest.y, 80, 0.8);

    const partIds = state.rewardPartIds || [];
    for (let i = 0; i < partIds.length; i++) {
        const angle = (Math.PI * 2 * i) / Math.max(1, partIds.length);
        const pickup = new ItemPickupClass(
            chest.x + Math.cos(angle) * 55,
            chest.y + Math.sin(angle) * 55,
            partIds[i],
            random
        );
        pickup.ownerId = state.payerId || buyer?.id || 'host';
        game.itemPickups.push(pickup);
    }
    game.autoSave?.();
    return true;
}
