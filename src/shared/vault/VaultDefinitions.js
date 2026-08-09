export const VAULT_STATE_VERSION = 1;

export const VaultPhase = Object.freeze({
    OFFER: 'offer',
    CONTAINMENT: 'containment',
    REWARD: 'reward',
    COMPLETED: 'completed'
});

export const VaultContract = Object.freeze({
    GILDED: 'gilded',
    BLOOD: 'blood'
});

export const VAULT_CONTRACTS = Object.freeze({
    [VaultContract.GILDED]: Object.freeze({
        id: VaultContract.GILDED,
        costType: 'gold',
        label: 'gilded protocol',
        shortLabel: 'gilded',
        color: '#ffd75a'
    }),
    [VaultContract.BLOOD]: Object.freeze({
        id: VaultContract.BLOOD,
        costType: 'hp',
        label: 'blood protocol',
        shortLabel: 'blood',
        color: '#ff4f70'
    })
});

export const VAULT_CONTAINMENT_DURATION = 18;
export const VAULT_SURGE_TIMES = Object.freeze([0, 6, 12]);
export const VAULT_REWARD_COUNT = 3;

export function createVaultState() {
    return {
        version: VAULT_STATE_VERSION,
        phase: VaultPhase.OFFER,
        contractId: null,
        payerId: null,
        playerCount: 1,
        elapsed: 0,
        nextSurge: 0,
        spawnSerial: 0,
        rewardPartIds: [],
        rewardSpawned: false
    };
}

export function isVaultContractId(value) {
    return value === VaultContract.GILDED || value === VaultContract.BLOOD;
}

export function isVaultPhase(value) {
    return Object.values(VaultPhase).includes(value);
}
