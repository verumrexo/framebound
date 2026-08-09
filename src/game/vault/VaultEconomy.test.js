import test from 'node:test';
import assert from 'node:assert/strict';
import {
    commitVaultContract,
    getVaultOffer,
    payVaultOffer
} from './VaultEconomy.js';

test('gilded cost scales linearly and spends the shared wallet', () => {
    const game = { floor: 4, gold: 300, playerShip: {} };
    const offer = getVaultOffer('gilded', game, null);

    assert.equal(offer.amount, 260);
    assert.equal(offer.canAfford, true);
    assert.equal(payVaultOffer(offer, game, null), true);
    assert.equal(game.gold, 40);
});

test('blood cost follows the payer frame and leaves them alive', () => {
    const game = {
        floor: 9,
        gold: 0,
        playerShip: { hp: 100, maxHp: 100 }
    };
    const guest = { ship: { hp: 30, maxHp: 100 } };
    const offer = getVaultOffer('blood', game, guest);

    assert.equal(offer.amount, 28);
    assert.equal(payVaultOffer(offer, game, guest), true);
    assert.equal(guest.ship.hp, 2);
    assert.equal(game.playerShip.hp, 100);

    const lethal = getVaultOffer('blood', game, {
        ship: { hp: 28, maxHp: 100 }
    });
    assert.equal(lethal.canAfford, false);
});

test('failed contract start rolls its payment back atomically', () => {
    const game = {
        floor: 1,
        gold: 200,
        playerShip: { hp: 100, maxHp: 100 },
        currentRoom: { startAmbush: () => false }
    };
    const chest = { contractId: 'gilded', wasPaid: false };

    assert.equal(commitVaultContract(chest, game, { id: 'host' }).ok, false);
    assert.equal(game.gold, 200);
    assert.equal(chest.wasPaid, false);
});
