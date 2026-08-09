import {
    VAULT_CONTRACTS,
    VaultContract
} from '../../shared/vault/VaultDefinitions.js';

export function getVaultOffer(contractId, game, buyer) {
    const definition = VAULT_CONTRACTS[contractId];
    if (!definition) return null;

    const floor = Math.max(1, Math.floor(game.floor || 1));
    if (contractId === VaultContract.GILDED) {
        const amount = 80 + floor * 45;
        return {
            ...definition,
            amount,
            canAfford: Number(game.gold || 0) >= amount,
            costText: `${amount} shared gold`
        };
    }

    const ship = buyer?.ship || game.playerShip;
    const maxHp = Math.max(1, Number(ship?.maxHp || 1));
    const amount = Math.max(1, Math.ceil((maxHp * 28) / 100));
    return {
        ...definition,
        amount,
        canAfford: Number(ship?.hp || 0) > amount,
        costText: `${amount} frame integrity`
    };
}

export function payVaultOffer(offer, game, buyer) {
    if (!offer?.canAfford) return false;
    if (offer.costType === 'gold') {
        game.gold -= offer.amount;
        return true;
    }

    const ship = buyer?.ship || game.playerShip;
    if (!ship || ship.hp <= offer.amount) return false;
    ship.hp -= offer.amount;
    return true;
}

export function commitVaultContract(chest, game, buyer) {
    const offer = getVaultOffer(chest?.contractId, game, buyer);
    if (!offer || !offer.canAfford) return { ok: false, offer };
    if (!payVaultOffer(offer, game, buyer)) return { ok: false, offer };

    const started = game.currentRoom?.startAmbush(
        game,
        chest.contractId,
        buyer?.id || 'host'
    );
    if (!started) {
        if (offer.costType === 'gold') game.gold += offer.amount;
        else (buyer?.ship || game.playerShip).hp += offer.amount;
        return { ok: false, offer };
    }

    chest.costAmount = offer.amount;
    chest.wasPaid = true;
    game.audio?.play?.(
        offer.costType === 'hp' ?
            'vault_blood_commit' : 'vault_gilded_commit',
        { volume: 0.8 }
    );
    return { ok: true, offer };
}
