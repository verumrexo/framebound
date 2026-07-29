import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Biomes } from '../environment/Biomes.js';

const { SaveManager } = await import('./SaveManager.js');
const SAVE_TEST_KEY = 'framebound_save';

function createValidSave(overrides = {}) {
    return {
        version: 1,
        level: 1,
        levelSeed: 12345,
        xp: 0,
        gold: 0,
        xpToNext: 100,
        playerPosition: { x: 1000, y: 1000, rotation: 0 },
        playerShip: {
            hp: 50,
            maxHp: 110,
            parts: [{ x: 0, y: 0, partId: 'core', rotation: 0 }]
        },
        inventory: { core: 1 },
        currentRoomGrid: { x: 0, y: 0 },
        visitedRooms: ['0,0'],
        ...overrides
    };
}

test('loading a corrupt save clears it instead of trapping the menu in continue mode', (t) => {
    const originalLocalStorage = globalThis.localStorage;
    const values = new Map([
        ['framebound_save', '{definitely-not-json']
    ]);

    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    t.mock.method(console, 'error', () => {});
    t.mock.method(console, 'log', () => {});

    try {
        assert.equal(SaveManager.load(), null);
        assert.equal(SaveManager.hasSave(), false);
    } finally {
        globalThis.localStorage = originalLocalStorage;
    }
});

test('storage access failures do not crash save loading', (t) => {
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem() {
            throw new Error('storage blocked');
        },
        removeItem() {
            throw new Error('storage blocked');
        }
    };
    t.mock.method(console, 'error', () => {});

    try {
        assert.equal(SaveManager.load(), null);
        assert.equal(SaveManager.hasSave(), false);
    } finally {
        globalThis.localStorage = originalLocalStorage;
    }
});

test('clearing a save reports blocked storage without crashing callers', (t) => {
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        removeItem() {
            throw new Error('storage blocked');
        }
    };
    t.mock.method(console, 'error', () => {});

    try {
        assert.equal(SaveManager.clearSave(), false);
    } finally {
        globalThis.localStorage = originalLocalStorage;
    }
});

test('loading an incomplete save clears it before game hydration', (t) => {
    const originalLocalStorage = globalThis.localStorage;
    const values = new Map([
        ['framebound_save', JSON.stringify(createValidSave({ playerPosition: null }))]
    ]);
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        removeItem: key => values.delete(key)
    };
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'log', () => {});

    try {
        assert.equal(SaveManager.load(), null);
        assert.equal(values.has('framebound_save'), false);
    } finally {
        globalThis.localStorage = originalLocalStorage;
    }
});

test('save persists run identity, score, floor, biome, and permanent upgrades', (t) => {
    const originalLocalStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    t.mock.method(console, 'log', () => {});

    const permanentStats = {
        hpMul: 1.35,
        regenAdd: 2,
        velocityRateAdd: 0.15,
        laserRateAdd: 0.1,
        speedMul: 1.25,
        turnMul: 1.25,
        missileSpeedMul: 1.5
    };
    const game = {
        level: 8,
        floor: 4,
        score: 1234,
        xp: 55,
        gold: 42,
        xpToNext: 900,
        x: 1200,
        y: -400,
        rotation: 0.5,
        isTainted: true,
        currentBiome: Biomes.RUST_BELT,
        levelGen: {
            seed: 9876,
            random: { getState: () => 123456 }
        },
        playerShip: {
            hp: 90,
            maxHp: 135,
            permanentStats,
            getUniqueParts: () => [
                {
                    x: 0,
                    y: 0,
                    partId: 'core',
                    rotation: 0,
                    cooldown: 0.75,
                    chargeReady: true
                }
            ]
        },
        rooms: [
            { gridX: 0, gridY: 0, visited: true },
            { gridX: 1, gridY: 0, visited: false }
        ],
        portals: [{ x: 5000, y: 6000 }],
        hangar: { inventory: { hull: 2 } },
        currentRoom: { gridX: 0, gridY: 0 }
    };

    try {
        assert.equal(SaveManager.save(game), true);
        const saved = JSON.parse(values.get('framebound_save'));
        assert.equal(saved.version, 2);
        assert.equal(saved.floor, 4);
        assert.equal(saved.score, 1234);
        assert.equal(saved.isTainted, true);
        assert.equal(saved.biome, 'RUST_BELT');
        assert.deepEqual(saved.playerShip.permanentStats, permanentStats);
        assert.deepEqual(saved.exitPortal, { x: 5000, y: 6000 });
        assert.equal(saved.randomState, 123456);
        assert.deepEqual(saved.playerShip.parts[0].state, {
            cooldown: 0.75,
            chargeReady: true
        });
        assert.equal(saved.roomSnapshots.length, 2);
        assert.deepEqual(saved.activeWorld.enemies, []);
        assert.equal(SaveManager.hasSave(), true);
        assert.equal(SaveManager.load().version, 2);
    } finally {
        globalThis.localStorage = originalLocalStorage;
    }
});

test('shape validation rejects save entries that can crash or corrupt hydration', () => {
    assert.equal(SaveManager.isValidSave(createValidSave()), true);
    assert.equal(SaveManager.isValidSave(createValidSave({
        playerShip: {
            hp: 50,
            maxHp: 110,
            parts: [{ x: 0, y: 0, partId: '', rotation: 0 }]
        }
    })), false);
    assert.equal(SaveManager.isValidSave(createValidSave({
        visitedRooms: [null]
    })), false);
    assert.equal(SaveManager.isValidSave(createValidSave({
        playerShip: {
            hp: 120,
            maxHp: 110,
            parts: [{ x: 0, y: 0, partId: 'core', rotation: 0 }]
        }
    })), false);
    assert.equal(SaveManager.isValidSave(createValidSave({
        playerShip: {
            hp: 50,
            maxHp: 110,
            parts: [{ x: 1, y: 0, partId: 'hull', rotation: 0 }]
        }
    })), false);
});

test('hasSave hides malformed storage before the menu offers continue', (t) => {
    const originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: () => '{bad json'
    };
    t.mock.method(console, 'error', () => {});

    try {
        assert.equal(SaveManager.hasSave(), false);
    } finally {
        globalThis.localStorage = originalLocalStorage;
    }
});

test('version-one saves migrate in memory instead of being deleted', (t) => {
    const originalLocalStorage = globalThis.localStorage;
    const values = new Map([
        ['framebound_save', JSON.stringify(createValidSave())]
    ]);
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        removeItem: key => values.delete(key)
    };
    t.mock.method(console, 'log', () => {});

    try {
        const loaded = SaveManager.load();
        assert.equal(loaded.version, 2);
        assert.equal(loaded.migratedFrom, 1);
        assert.deepEqual(loaded.roomSnapshots, []);
        assert.equal(values.has('framebound_save'), true);
    } finally {
        globalThis.localStorage = originalLocalStorage;
    }
});

test('version-two saves require bounded room and active-world snapshots', () => {
    const migrated = SaveManager.normalizeSave(createValidSave());
    assert.equal(SaveManager.isValidSave(migrated), true);
    assert.equal(SaveManager.isValidSave({
        ...migrated,
        activeWorld: {
            ...migrated.activeWorld,
            enemies: [{ state: { x: Infinity } }]
        }
    }), false);
});

test('desktop startup restores a newer valid native save before menu setup', async (t) => {
    const originalLocalStorage = globalThis.localStorage;
    const originalInvoke = SaveManager.desktopInvoke;
    const localSave = JSON.stringify(createValidSave({ timestamp: 10 }));
    const nativeSave = JSON.stringify(createValidSave({
        timestamp: 20,
        score: 99
    }));
    const values = new Map([[SAVE_TEST_KEY, localSave]]);
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    SaveManager.desktopInvoke = async command => {
        if (command === 'load_run_save') return [nativeSave];
    };
    t.mock.method(console, 'error', () => {});

    try {
        assert.equal(await SaveManager.hydrateDesktopBackup(), true);
        assert.equal(
            JSON.parse(values.get(SAVE_TEST_KEY)).score,
            99
        );
    } finally {
        SaveManager.desktopInvoke = originalInvoke;
        globalThis.localStorage = originalLocalStorage;
    }
});

test('desktop startup mirrors a newer webview save to native storage', async (t) => {
    const originalLocalStorage = globalThis.localStorage;
    const originalInvoke = SaveManager.desktopInvoke;
    const localSave = JSON.stringify(createValidSave({ timestamp: 20 }));
    const nativeSave = JSON.stringify(createValidSave({ timestamp: 10 }));
    const calls = [];
    globalThis.localStorage = {
        getItem: () => localSave
    };
    SaveManager.desktopInvoke = async (command, args) => {
        calls.push([command, args]);
        if (command === 'load_run_save') return [nativeSave];
    };
    t.mock.method(console, 'error', () => {});

    try {
        assert.equal(await SaveManager.hydrateDesktopBackup(), true);
        assert.deepEqual(calls, [
            ['load_run_save', undefined],
            ['write_run_save', { raw: localSave }]
        ]);
    } finally {
        SaveManager.desktopInvoke = originalInvoke;
        globalThis.localStorage = originalLocalStorage;
    }
});

test('desktop startup skips an invalid primary and repairs from backup', async (t) => {
    const originalLocalStorage = globalThis.localStorage;
    const originalInvoke = SaveManager.desktopInvoke;
    const backup = JSON.stringify(createValidSave({
        timestamp: 30,
        score: 123
    }));
    const calls = [];
    const values = new Map();
    globalThis.localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    SaveManager.desktopInvoke = async (command, args) => {
        calls.push([command, args]);
        if (command === 'load_run_save') {
            return ['{"version":2}', backup];
        }
    };
    t.mock.method(console, 'error', () => {});

    try {
        assert.equal(await SaveManager.hydrateDesktopBackup(), true);
        assert.equal(JSON.parse(values.get(SAVE_TEST_KEY)).score, 123);
        assert.deepEqual(calls, [
            ['load_run_save', undefined],
            ['write_run_save', { raw: backup }]
        ]);
    } finally {
        SaveManager.desktopInvoke = originalInvoke;
        globalThis.localStorage = originalLocalStorage;
    }
});
