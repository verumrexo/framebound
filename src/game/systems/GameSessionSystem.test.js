import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { GameSessionSystem } = await import('./GameSessionSystem.js');

class ShipStub {
    constructor() {
        this.hp = 100;
        this.maxHp = 100;
        this.parts = new Map([['old', {}]]);
        this.addedParts = [];
        this.permanentStats = {
            hpMul: 1,
            regenAdd: 0,
            velocityRateAdd: 0,
            laserRateAdd: 0,
            speedMul: 1,
            turnMul: 1,
            missileSpeedMul: 1
        };
        this.stats = {};
    }

    addPart(...args) {
        this.addedParts.push(args);
        const [x, y, partId, rotation] = args;
        if (partId !== 'core') return false;
        this.parts.set(`${x},${y}`, { x, y, partId, rotation });
        return true;
    }

    recalculateStats() {
        this.recalculated = true;
        this.maxHp = 100 * this.permanentStats.hpMul;
        this.stats = { totalHp: this.maxHp };
    }
}

class ConnectedShipStub extends ShipStub {
    addPart(x, y, partId, rotation) {
        this.addedParts.push([x, y, partId, rotation]);
        if (partId !== 'core') {
            const connected = [
                `${x - 1},${y}`,
                `${x + 1},${y}`,
                `${x},${y - 1}`,
                `${x},${y + 1}`
            ].some(key => this.parts.has(key));
            if (!connected) return false;
        }
        this.parts.set(`${x},${y}`, { x, y, partId, rotation });
        return true;
    }
}

class PortalStub {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

function validSave(overrides = {}) {
    return {
        level: 3,
        score: 12,
        floor: 3,
        levelSeed: 4242,
        isTainted: true,
        biome: 'RUST_BELT',
        xp: 40,
        gold: 7,
        xpToNext: 150,
        playerPosition: { x: 2500, y: 1100, rotation: 0.75 },
        playerShip: {
            hp: 75,
            maxHp: 110,
            permanentStats: {
                hpMul: 1.1,
                regenAdd: 2,
                velocityRateAdd: 0.15,
                laserRateAdd: 0.1,
                speedMul: 1.25,
                turnMul: 1.25,
                missileSpeedMul: 1.5
            },
            parts: [{ x: 0, y: 0, partId: 'core', rotation: 1 }]
        },
        inventory: { core: 2 },
        visitedRooms: ['0,0', '1,0'],
        currentRoomGrid: { x: 1, y: 0 },
        ...overrides
    };
}

function emptyActiveWorld() {
    return {
        enemies: [],
        bosses: [],
        projectiles: [],
        drones: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: []
    };
}

function emptyRoomSnapshot(gridX, gridY, overrides = {}) {
    return {
        gridX,
        gridY,
        visited: false,
        cleared: false,
        locked: false,
        shopUsed: false,
        ambushStarted: false,
        waveCount: 0,
        maxWaves: 0,
        waveWaiting: false,
        asteroids: [],
        lootCrates: [],
        shipwrecks: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: [],
        shopItems: [],
        treasureChests: [],
        vaultChests: [],
        ...overrides
    };
}

function createHarness({ save = null, connected = false, random = 0.5 } = {}) {
    const calls = [];
    const rooms = new Map([
        ['0,0', { id: 'start', onEnter: game => calls.push(['enter', game]) }],
        ['1,0', { id: 'current' }]
    ]);
    const game = {
        playerShip: null,
        x: 1,
        y: 2,
        rotation: 0,
        networkManager: {
            isConnected: connected,
            disconnect() {
                calls.push(['disconnect']);
                this.isConnected = false;
            },
            sendJoinGame: () => calls.push(['join'])
        },
        starfield: { setSeed: seed => calls.push(['starfield', seed]) },
        levelGen: {
            generate: (...args) => {
                calls.push(['generate', ...args]);
                return [...rooms.values()];
            },
            getRoom: (x, y) => rooms.get(`${x},${y}`)
        },
        hangar: {
            inventory: {},
            updateUI: () => calls.push(['hangar-ui'])
        },
        shipBuilder: {
            active: false,
            draftShip: null
        },
        designer: {
            active: false
        },
        devTools: {
            active: false,
            placementMode: false,
            freezeEnemies: false,
            showHitboxes: false
        },
        levelUpManager: {
            active: false,
            choices: []
        },
        pauseMenu: {
            hide: () => calls.push(['hide-pause'])
        },
        input: {
            resetActiveState: () => calls.push(['reset-input'])
        },
        floor: 1,
        floorProgression: {
            applyBiome: (...args) => calls.push(['biome', ...args])
        },
        showNotification: (...args) => calls.push(['notification', ...args])
    };
    const saveManager = { load: () => save };
    const system = new GameSessionSystem(game, {
        ShipClass: ShipStub,
        PortalClass: PortalStub,
        saveManager,
        random: () => random
    });
    return { game, calls, rooms, system };
}

test('offline start disconnects legacy online state and uses the requested seed', () => {
    const { game, calls, system } = createHarness({ connected: true });

    assert.equal(system.startOffline(17), true);

    assert.ok(game.playerShip instanceof ShipStub);
    assert.equal(game.x, 1000);
    assert.equal(game.y, 1000);
    assert.equal(game.seed, 17);
    assert.equal(game.running, true);
    assert.deepEqual(calls.map(call => call[0]), [
        'disconnect',
        'hide-pause',
        'reset-input',
        'starfield',
        'generate',
        'enter'
    ]);
});

test('continue uses the saved world once and hydrates it without regenerating again', () => {
    const save = validSave();
    const { game, calls, system } = createHarness({ save });

    assert.equal(system.startOffline(undefined, true), true);

    assert.equal(calls.filter(call => call[0] === 'generate').length, 1);
    assert.deepEqual(calls.find(call => call[0] === 'generate'), ['generate', 21, 4242]);
    assert.equal(calls.filter(call => call[0] === 'enter').length, 0);
    assert.equal(game.currentRoom.id, 'current');
    assert.equal(game.level, 3);
    assert.equal(game.score, 12);
});

test('missing continue save fails before player or world construction', () => {
    const { game, calls, system } = createHarness();

    assert.equal(system.startOffline(undefined, true), false);
    assert.equal(game.playerShip, null);
    assert.ok(!calls.find(call => call[0] === 'generate'));
});

test('local player construction is idempotent and preserves partial server coordinates', () => {
    const { game, calls, system } = createHarness({ connected: true });

    system.createLocalPlayer({ x: 55 });
    const firstShip = game.playerShip;
    system.createLocalPlayer({ x: 99, y: 88 });

    assert.equal(game.playerShip, firstShip);
    assert.equal(game.x, 55);
    assert.equal(game.y, 2);
    assert.equal(calls.filter(call => call[0] === 'join').length, 1);
});

test('load restores the original version-one fields, room flags, build, and inventory', () => {
    const save = validSave();
    const { game, calls, rooms, system } = createHarness({ save });
    game.playerShip = new ShipStub();

    assert.equal(system.loadFromSave(), true);

    assert.deepEqual(
        {
            level: game.level,
            floor: game.floor,
            score: game.score,
            isTainted: game.isTainted,
            xp: game.xp,
            gold: game.gold,
            xpToNext: game.xpToNext,
            x: game.x,
            y: game.y,
            rotation: game.rotation
        },
        {
            level: 3,
            floor: 3,
            score: 12,
            isTainted: true,
            xp: 40,
            gold: 7,
            xpToNext: 150,
            x: 2500,
            y: 1100,
            rotation: 0.75
        }
    );
    assert.equal(game.playerShip.hp, 75);
    assert.equal(game.playerShip.maxHp, 110.00000000000001);
    assert.deepEqual(
        [...game.playerShip.parts.values()],
        [{ x: 0, y: 0, partId: 'core', rotation: 1 }]
    );
    assert.equal(game.playerShip.permanentStats.regenAdd, 2);
    assert.equal(game.playerShip.permanentStats.missileSpeedMul, 1.5);
    assert.deepEqual(game.hangar.inventory, { core: 2 });
    assert.equal(rooms.get('0,0').visited, true);
    assert.equal(rooms.get('0,0').cleared, true);
    assert.equal(rooms.get('0,0').locked, false);
    assert.equal(game.currentRoom, rooms.get('1,0'));
    assert.ok(calls.find(call => call[0] === 'hangar-ui'));
    assert.deepEqual(
        calls.find(call => call[0] === 'biome').slice(2),
        [{ notify: false }]
    );
    assert.ok(calls.find(call => call[0] === 'notification' && call[1] === 'save loaded!'));
});

test('load waits for a player ship and reports the existing uplink message', () => {
    const { calls, system } = createHarness({ save: validSave() });
    assert.equal(system.loadFromSave(), false);
    assert.deepEqual(calls.at(-1), ['notification', 'waiting for uplink...', '#ff0000']);
});

test('old version-one saves recover their saved max hp multiplier when possible', () => {
    const save = validSave({
        floor: undefined,
        isTainted: undefined,
        biome: undefined,
        playerShip: {
            hp: 75,
            maxHp: 150,
            parts: [{ x: 0, y: 0, partId: 'core', rotation: 0 }]
        }
    });
    const { game, system } = createHarness({ save });
    game.playerShip = new ShipStub();

    assert.equal(system.loadFromSave(), true);
    assert.equal(game.floor, 1);
    assert.equal(game.playerShip.maxHp, 150);
    assert.equal(game.playerShip.permanentStats.hpMul, 1.5);
    assert.equal(game.playerShip.hp, 75);
});

test('load restores the exact saved boss exit portal', () => {
    const save = validSave({
        exitPortal: { x: 9000, y: -1200 }
    });
    const { game, system } = createHarness({ save });
    game.playerShip = new ShipStub();
    game.portals = [];

    assert.equal(system.loadFromSave(), true);
    assert.deepEqual(game.portals, [new PortalStub(9000, -1200)]);
});

test('old cleared-boss saves infer the missing exit portal', () => {
    const save = validSave({
        migratedFrom: 1,
        visitedRooms: ['0,0', '1,0', '2,0']
    });
    const { game, rooms, system } = createHarness({ save });
    game.playerShip = new ShipStub();
    game.portals = [];
    const bossRoom = {
        type: 'boss',
        gridX: 2,
        gridY: 0,
        x: 4000,
        y: 0,
        width: 2000,
        height: 2000
    };
    rooms.set('2,0', bossRoom);
    game.rooms = [...rooms.values()];

    assert.equal(system.loadFromSave(), true);
    assert.deepEqual(game.portals, [new PortalStub(5000, 1000)]);
});

test('version-two load preserves separate room flags instead of clearing every visit', () => {
    const save = validSave({
        roomSnapshots: [
            emptyRoomSnapshot(0, 0, {
                visited: true,
                cleared: true
            }),
            emptyRoomSnapshot(1, 0, {
                visited: true,
                cleared: false,
                locked: true
            })
        ],
        activeWorld: emptyActiveWorld()
    });
    const { game, rooms, system } = createHarness({ save });
    game.playerShip = new ShipStub();

    assert.equal(system.loadFromSave(), true);
    assert.equal(rooms.get('0,0').cleared, true);
    assert.equal(rooms.get('0,0').locked, false);
    assert.equal(rooms.get('1,0').visited, true);
    assert.equal(rooms.get('1,0').cleared, false);
    assert.equal(rooms.get('1,0').locked, true);
});

test('version-two boss fights do not infer a victory portal', () => {
    const save = validSave({
        visitedRooms: ['0,0', '2,0'],
        roomSnapshots: [
            emptyRoomSnapshot(0, 0, {
                visited: true,
                cleared: true
            }),
            emptyRoomSnapshot(2, 0, {
                visited: true,
                cleared: false,
                locked: true
            })
        ],
        activeWorld: emptyActiveWorld()
    });
    const { game, rooms, system } = createHarness({ save });
    const bossRoom = {
        id: 'boss',
        type: 'boss',
        gridX: 2,
        gridY: 0,
        x: 4000,
        y: 0,
        width: 2000,
        height: 2000
    };
    rooms.set('2,0', bossRoom);
    game.rooms = [...rooms.values()];
    game.playerShip = new ShipStub();
    game.portals = [];

    assert.equal(system.loadFromSave(), true);
    assert.deepEqual(game.portals, []);
    assert.equal(bossRoom.cleared, false);
    assert.equal(bossRoom.locked, true);
});

test('continue rejects a ship layout that cannot be rebuilt instead of partially loading it', () => {
    const save = validSave({
        playerShip: {
            hp: 75,
            maxHp: 110,
            parts: [
                { x: 0, y: 0, partId: 'core', rotation: 0 },
                { x: 50, y: 50, partId: 'disconnected', rotation: 0 }
            ]
        }
    });
    const { game, system } = createHarness({ save });

    assert.equal(system.startOffline(undefined, true), false);
    assert.equal(game.running, false);
});

test('saved ships rebuild connected layouts regardless of part order and restore weapon state', () => {
    const { game, system } = createHarness();
    const connectedSystem = new GameSessionSystem(game, {
        ShipClass: ConnectedShipStub
    });
    const staged = connectedSystem.stageSavedShip({
        hp: 100,
        maxHp: 100,
        parts: [
            {
                x: 2,
                y: 0,
                partId: 'laser',
                rotation: 0,
                state: { cooldown: 0.75, chargeReady: true }
            },
            { x: 0, y: 0, partId: 'core', rotation: 0 },
            { x: 1, y: 0, partId: 'hull', rotation: 0 }
        ]
    });

    assert.ok(staged);
    assert.equal(staged.parts.size, 3);
    assert.equal(staged.parts.get('2,0').cooldown, 0.75);
    assert.equal(staged.parts.get('2,0').chargeReady, true);
});

test('starting again in the same app discards stale run state before new or saved worlds', () => {
    const save = validSave();
    const { game, system } = createHarness({ save });
    const staleShip = new ShipStub();
    game.playerShip = staleShip;
    game.level = 99;
    game.floor = 8;
    game.score = 9999;
    game.gold = 999;
    game.xp = 999;
    game.vx = 500;
    game.projectiles = [{ stale: true }];
    game.enemies = [{ stale: true }];
    game.notifications = [{ stale: true }];
    game.hangar.inventory = { hull: 999 };
    game.hangar.hasInfiniteParts = true;
    game.levelUpManager.active = true;
    game.fullscreenMapOpen = true;
    game.eKeyLastFrame = true;
    game.devTools.active = true;
    game.devTools.placementMode = true;
    game.devTools.freezeEnemies = true;
    game.devTools.showHitboxes = true;

    assert.equal(system.startOffline(undefined, true), true);

    assert.notEqual(game.playerShip, staleShip);
    assert.equal(game.level, 3);
    assert.equal(game.floor, 3);
    assert.equal(game.score, 12);
    assert.equal(game.gold, 7);
    assert.equal(game.xp, 40);
    assert.equal(game.vx, 0);
    assert.deepEqual(game.projectiles, []);
    assert.deepEqual(game.enemies, []);
    assert.deepEqual(game.notifications, []);
    assert.deepEqual(game.hangar.inventory, { core: 2 });
    assert.equal(game.hangar.hasInfiniteParts, false);
    assert.equal(game.levelUpManager.active, false);
    assert.equal(game.fullscreenMapOpen, false);
    assert.equal(game.eKeyLastFrame, false);
    assert.equal(game.devTools.active, false);
    assert.equal(game.devTools.placementMode, false);
    assert.equal(game.devTools.freezeEnemies, false);
    assert.equal(game.devTools.showHitboxes, false);
});
