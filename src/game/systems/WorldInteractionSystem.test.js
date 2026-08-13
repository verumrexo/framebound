import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldInteractionSystem } from './WorldInteractionSystem.js';

class PickupStub {
    constructor(x, y, partId) {
        this.x = x;
        this.y = y;
        this.partId = partId;
    }
}

function createHarness({
    gold = 100,
    hp = 100,
    mouse = { x: 0, y: 0 },
    eDown = false,
    mouseDown = false,
    random = () => 0
} = {}) {
    const notifications = [];
    const audioCalls = [];
    const explosions = [];
    const ambushCalls = [];
    const room = {
        cleared: false,
        shopUsed: false,
        vaultState: { phase: 'offer' },
        startAmbush: (game, contractId, payerId) => {
            room.vaultState = {
                phase: 'containment',
                contractId,
                payerId
            };
            ambushCalls.push([game, contractId, payerId]);
            return true;
        }
    };
    const game = {
        audio: {
            play: (...args) => audioCalls.push(args)
        },
        camera: {
            x: 0,
            y: 0,
            zoom: 1
        },
        currentRoom: room,
        eKeyLastFrame: false,
        gold,
        input: {
            getMousePos: () => mouse,
            isKeyDown: code => code === 'KeyE' && eDown,
            isMouseDown: () => mouseDown
        },
        itemPickups: [],
        mouseDownLastFrame: false,
        playerShip: {
            hp,
            maxHp: 100
        },
        shopItems: [],
        treasureChests: [],
        vaultChests: [],
        showNotification: (...args) => notifications.push(args),
        spawnExplosion: (...args) => explosions.push(args)
    };
    const partsLibrary = {
        core: { name: 'Core' },
        gun: { name: 'Basic Gun' },
        rocket: { name: 'Rocket Launcher' }
    };
    const system = new WorldInteractionSystem(game, {
        random,
        partsLibrary,
        ItemPickupClass: PickupStub
    });

    return {
        ambushCalls,
        audioCalls,
        explosions,
        game,
        notifications,
        room,
        system
    };
}

test('hovered shop purchases keep the existing e-key edge trigger', () => {
    const harness = createHarness({
        gold: 50,
        hp: 40,
        mouse: { x: 100, y: 200 },
        eDown: true
    });
    const shopItem = {
        x: 100,
        y: 200,
        radius: 40,
        purchased: false,
        data: {
            type: 'heal',
            name: 'Repair',
            price: 30
        }
    };
    harness.game.shopItems.push(shopItem);

    harness.system.update();
    harness.system.update();

    assert.equal(harness.game.hoveredShopItem, null);
    assert.equal(harness.game.gold, 20);
    assert.equal(harness.game.playerShip.hp, 90);
    assert.equal(shopItem.purchased, true);
    assert.equal(harness.room.shopUsed, true);
    assert.deepEqual(harness.notifications, [['+50 HP!', '#44ff44']]);
});

test('shop and chest animation uses real frame time outside rendering', () => {
    const harness = createHarness();
    const calls = [];
    harness.game.shopItems = [{
        purchased: false,
        x: 1000,
        y: 1000,
        radius: 1,
        update: dt => calls.push(['shop', dt])
    }];
    harness.game.treasureChests = [{
        opened: false,
        x: 1000,
        y: 1000,
        radius: 1,
        update: dt => calls.push(['treasure', dt])
    }];
    harness.game.vaultChests = [{
        opened: false,
        x: 1000,
        y: 1000,
        radius: 1,
        update: dt => calls.push(['vault', dt])
    }];

    harness.system.update(0.025);

    assert.deepEqual(calls, [
        ['shop', 0.025],
        ['treasure', 0.025],
        ['vault', 0.025]
    ]);
});

test('part purchases still create a pickup at the shop item', () => {
    const harness = createHarness();
    const shopItem = {
        x: 12,
        y: 34,
        purchased: false,
        data: {
            type: 'part',
            name: 'Rocket Launcher',
            partId: 'rocket',
            price: 75
        }
    };

    harness.system.purchaseShopItem(shopItem);

    assert.equal(harness.game.gold, 25);
    const pickup = new PickupStub(12, 34, 'rocket');
    pickup.ownerId = 'host';
    assert.deepEqual(harness.game.itemPickups, [pickup]);
    assert.deepEqual(harness.notifications, [[
        'Unlocked: Rocket Launcher! Pick it up.',
        '#ffd700'
    ]]);
});

test('doctrine terminal purchases are repeatable, shared-cost, and owner locked', () => {
    const harness = createHarness({ gold: 200 });
    harness.system.partsLibrary.doctrine_test = {
        name: 'test doctrine',
        shopCategory: 'doctrine',
        shopPrice: 90
    };
    const terminal = {
        x: 20,
        y: 30,
        purchased: false,
        data: { type: 'doctrine_terminal' }
    };
    harness.game.shopItems = [terminal];
    const guest = {
        id: 'guest_1',
        x: 20,
        y: 30,
        ship: { hp: 100, maxHp: 100 }
    };

    assert.equal(harness.system.purchaseDoctrine('doctrine_test', guest, terminal), true);
    assert.equal(harness.system.purchaseDoctrine('doctrine_test', null, terminal), true);
    assert.equal(harness.game.gold, 20);
    assert.equal(terminal.purchased, false);
    assert.deepEqual(harness.game.itemPickups.map(pickup => [
        pickup.partId,
        pickup.ownerId
    ]), [
        ['doctrine_test', 'guest_1'],
        ['doctrine_test', 'host']
    ]);
});

test('guest shop purchases heal or lock parts to that buyer only', () => {
    const harness = createHarness({ gold: 100 });
    const guest = {
        id: 'guest_1',
        x: 12,
        y: 34,
        ship: { hp: 20, maxHp: 100 }
    };
    const heal = {
        purchased: false,
        data: { type: 'heal', price: 25 }
    };
    const part = {
        x: 12,
        y: 34,
        purchased: false,
        data: {
            type: 'part',
            name: 'Rocket Launcher',
            partId: 'rocket',
            price: 50
        }
    };

    assert.equal(harness.system.purchaseShopItem(heal, guest), true);
    assert.equal(guest.ship.hp, 70);
    assert.equal(harness.game.playerShip.hp, 100);
    assert.equal(harness.system.purchaseShopItem(part, guest), true);
    assert.equal(harness.game.gold, 25);
    assert.equal(harness.game.itemPickups[0].ownerId, 'guest_1');
    assert.deepEqual(harness.notifications, []);
});

test('host authority rejects forged interaction targets across the room', () => {
    const harness = createHarness();
    harness.game.shopItems = [{
        x: 5000,
        y: 5000,
        purchased: false,
        data: {
            type: 'part',
            name: 'Rocket Launcher',
            partId: 'rocket',
            price: 50
        }
    }];
    const guest = {
        id: 'guest_1',
        x: 0,
        y: 0,
        ship: { hp: 100, maxHp: 100 }
    };

    assert.equal(
        harness.system.interactForPlayer(guest, 'shop', 0),
        false
    );
    assert.equal(harness.game.gold, 100);
    assert.equal(harness.game.shopItems[0].purchased, false);
    assert.deepEqual(harness.game.itemPickups, []);
});

test('treasure chests keep their random non-core part reward', () => {
    const harness = createHarness({ random: () => 0 });
    const chest = { x: 80, y: 90, opened: false };

    harness.system.openTreasureChest(chest);

    assert.equal(chest.opened, true);
    assert.deepEqual(harness.game.itemPickups, [
        new PickupStub(80, 90, 'gun')
    ]);
    assert.deepEqual(harness.notifications, [[
        'Chest opened! Pick up: Basic Gun',
        '#ffd700'
    ]]);
    assert.deepEqual(harness.audioCalls, [['hit', { volume: 0.6 }]]);
});

test('treasure chests never roll doctrine-only stock', () => {
    const harness = createHarness({ random: () => 0.999 });
    harness.system.partsLibrary.doctrine_test = {
        name: 'test doctrine',
        shopCategory: 'doctrine'
    };
    const chest = { x: 80, y: 90, opened: false };

    harness.system.openTreasureChest(chest);

    assert.notEqual(harness.game.itemPickups[0].partId, 'doctrine_test');
});

test('gilded vault deducts shared gold once and starts one contract', () => {
    const harness = createHarness({ gold: 200 });
    const chest = {
        opened: false,
        ambushActive: false,
        locked: false,
        wasPaid: false,
        contractId: 'gilded',
        costType: 'gold',
        costAmount: 0
    };

    harness.system.tryActivateVaultChest(chest);
    harness.system.tryActivateVaultChest(chest);

    assert.equal(harness.game.gold, 75);
    assert.equal(chest.wasPaid, true);
    assert.deepEqual(harness.ambushCalls, [[
        harness.game,
        'gilded',
        'host'
    ]]);
});

test('blood vault sacrifice can never kill its payer', () => {
    const harness = createHarness({ hp: 28 });
    const chest = {
        opened: false,
        ambushActive: false,
        locked: false,
        wasPaid: false,
        contractId: 'blood',
        costType: 'hp',
        costAmount: 0
    };

    harness.system.tryActivateVaultChest(chest);

    assert.equal(harness.game.playerShip.hp, 28);
    assert.equal(chest.wasPaid, false);
    assert.deepEqual(harness.notifications, [[
        'insufficient frame integrity',
        '#ff4f70'
    ]]);
});

test('vault cache drops its stored unique rewards for the payer once', () => {
    const harness = createHarness({ random: () => 0 });
    harness.room.cleared = true;
    harness.room.vaultState = {
        phase: 'reward',
        contractId: 'gilded',
        payerId: 'guest_1',
        rewardPartIds: ['gun', 'rocket'],
        rewardSpawned: false
    };
    const chest = {
        x: 500,
        y: 700,
        opened: false,
        ambushActive: false,
        locked: false,
        wasPaid: true,
        contractId: 'gilded',
        costType: 'gold',
        costAmount: 50
    };

    harness.system.tryActivateVaultChest(chest);
    harness.system.openVaultChest(chest);

    assert.equal(chest.opened, true);
    assert.equal(harness.game.itemPickups.length, 2);
    assert.deepEqual(
        harness.game.itemPickups.map(pickup => [
            pickup.partId,
            Math.round(pickup.x),
            Math.round(pickup.y),
            pickup.ownerId
        ]),
        [
            ['gun', 555, 700, 'guest_1'],
            ['rocket', 445, 700, 'guest_1']
        ]
    );
    assert.equal(harness.room.vaultState.phase, 'completed');
    assert.deepEqual(harness.explosions, [[500, 700, 80, 0.8]]);
    assert.deepEqual(harness.audioCalls, [[
        'vault_claim',
        { volume: 0.8, pitch: 0.5 }
    ]]);
});

test('empty treasure libraries fail closed without creating a pickup', () => {
    const harness = createHarness();
    harness.system.partsLibrary = {
        core: { name: 'Core' }
    };
    const chest = { x: 1, y: 2, opened: false };

    harness.system.openTreasureChest(chest);

    assert.equal(chest.opened, true);
    assert.deepEqual(harness.game.itemPickups, []);
    assert.deepEqual(harness.notifications, [[
        'Chest is empty!',
        '#ff4444'
    ]]);
});
