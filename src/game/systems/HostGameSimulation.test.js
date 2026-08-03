import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { HostGameSimulation } = await import('./HostGameSimulation.js');

class ShipStub {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.isDead = false;
        this.permanentStats = {
            hpMul: 1,
            regenAdd: 0,
            velocityRateAdd: 0,
            laserRateAdd: 0,
            speedMul: 1,
            turnMul: 1,
            missileSpeedMul: 1
        };
        this.parts = [{
            x: 0,
            y: 0,
            partId: 'core',
            rotation: 0
        }];
    }

    update(dt, input, options) {
        this.lastUpdate = [dt, input, options];
        if (input.right) this.x += 100 * dt;
    }

    getUniqueParts() {
        return this.parts;
    }

    recalculateStats() {
        this.maxHp = 100 * this.permanentStats.hpMul;
    }
}

class WeaponSystemStub {
    constructor(context) {
        this.context = context;
        this.calls = [];
    }

    update(...args) {
        this.calls.push(args);
    }

    spawnProjectile() {}
}

function createGame() {
    const hostShip = new ShipStub();
    return {
        x: 100,
        y: 200,
        rotation: 0.25,
        playerShip: hostShip,
        projectiles: [],
        enemies: [],
        bosses: [],
        drones: [],
        xpOrbs: [],
        goldOrbs: [],
        hpOrbs: [],
        itemPickups: [],
        portals: [],
        rooms: [],
        currentRoom: {
            gridX: 0,
            gridY: 0,
            x: 0,
            y: 0,
            width: 2000,
            height: 2000,
            locked: false,
            cleared: true
        },
        floor: 1,
        level: 2,
        score: 10,
        xp: 5,
        gold: 3,
        xpToNext: 100,
        seed: 42,
        levelGen: {
            seed: 42,
            random: () => 0.5
        },
        levelUpManager: {
            active: false,
            selectionPending: false,
            completeSharedLevelUp() {
                this.active = false;
                this.selectionPending = false;
            }
        },
        audio: {}
    };
}

function upgradeChoice(stat = 'mobility', value = 0.1) {
    return {
        rarity: {
            id: 'common',
            name: 'common',
            color: '#aaaaaa'
        },
        name: 'test upgrade',
        value,
        stat,
        mode: 'add',
        desc: 'test description'
    };
}

test('host simulates guest movement and firing intent with shared ship logic', () => {
    const game = createGame();
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('connection-a', {
        displayName: 'ace'
    });

    simulation.applyInput(playerId, { right: true });
    assert.ok(simulation.requestAction(playerId, 'shoot', {
        active: true,
        aimAngle: 0.5
    }));
    simulation.step(0.1);

    const peer = simulation.peers.get(playerId);
    assert.equal(peer.ship.x, 110);
    assert.deepEqual(peer.ship.lastUpdate[2], {
        movementMultiplier: 2
    });
    assert.equal(peer.runtime.weaponSystem.calls[0][1].isMouseDown, true);
});

test('guest claims for interaction, transitions, and ship edits remain rejected', () => {
    const simulation = new HostGameSimulation(createGame(), {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('connection-a', {
        displayName: 'ace'
    });

    assert.equal(simulation.requestAction(
        playerId,
        'interact',
        { targetKind: 'vault', targetIndex: 0 }
    ), false);
    assert.equal(simulation.requestAction(
        playerId,
        'transition',
        { direction: 'portal' }
    ), false);
    assert.equal(simulation.requestAction(
        playerId,
        'ship_edit',
        { parts: [] }
    ), false);
});

test('host validates and triggers a guest salvage sweep from server position', () => {
    const game = createGame();
    let triggeringPlayer = null;
    game.salvageSweep = {
        triggerFor(player) {
            triggeringPlayer = player;
            return true;
        }
    };
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('connection-a', {
        displayName: 'ace'
    });

    const event = simulation.requestAction(playerId, 'sweep', {});

    assert.equal(event.type, 'room_state');
    assert.equal(triggeringPlayer.id, playerId);
    assert.equal(triggeringPlayer.x, 100);
    assert.equal(triggeringPlayer.y, 200);
});

test('full resync identifies the local guest and includes authoritative run state', () => {
    const game = createGame();
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('connection-a', {
        displayName: 'ace'
    });
    const state = simulation.fullStateFor(playerId);

    assert.equal(state.self, playerId);
    assert.equal(state.seed, 42);
    assert.equal(state.level, 2);
    assert.equal(state.players.length, 2);
    assert.equal(state.players[1].parts[0].partId, 'core');
});

test('boss victory resurrects every dead ship at full hp in place', () => {
    const game = createGame();
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId: deadPeerId } = simulation.addPeer('connection-a', {
        displayName: 'ace'
    });
    const { playerId: livingPeerId } = simulation.addPeer('connection-b', {
        displayName: 'bee'
    });
    const deadPeer = simulation.peers.get(deadPeerId);

    game.playerShip.hp = 0;
    game.playerShip.isDead = true;
    game.playerShip.vx = 30;
    game.playerShip.vy = -20;
    deadPeer.ship.x = 700;
    deadPeer.ship.y = 800;
    deadPeer.ship.hp = 0;
    deadPeer.ship.isDead = true;
    deadPeer.ship.vx = -50;
    deadPeer.ship.vy = 40;
    deadPeer.input = { right: true };
    deadPeer.firing = true;

    assert.deepEqual(simulation.resurrectDeadPlayers(), [
        'host',
        deadPeerId
    ]);
    assert.equal(game.playerShip.hp, game.playerShip.maxHp);
    assert.equal(game.playerShip.isDead, false);
    assert.equal(game.playerShip.vx, 0);
    assert.equal(game.playerShip.vy, 0);
    assert.equal(game.vx, 0);
    assert.equal(game.vy, 0);
    assert.equal(deadPeer.ship.x, 700);
    assert.equal(deadPeer.ship.y, 800);
    assert.equal(deadPeer.ship.hp, deadPeer.ship.maxHp);
    assert.equal(deadPeer.ship.isDead, false);
    assert.equal(deadPeer.ship.vx, 0);
    assert.equal(deadPeer.ship.vy, 0);
    assert.deepEqual(deadPeer.input, {});
    assert.equal(deadPeer.firing, false);
    assert.equal(simulation.peers.get(livingPeerId).ship.hp, 100);
});

test('version one admits three guests and rejects a fifth total player', () => {
    const simulation = new HostGameSimulation(createGame(), {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });

    assert.ok(simulation.addPeer('a', { displayName: 'a' }));
    assert.ok(simulation.addPeer('b', { displayName: 'b' }));
    assert.ok(simulation.addPeer('c', { displayName: 'c' }));
    assert.equal(
        simulation.addPeer('d', { displayName: 'd' }),
        false
    );
});

test('guest interactions receive the buyer identity and private inventory', () => {
    const game = createGame();
    const calls = [];
    game.worldInteractions = {
        interactForPlayer: (...args) => {
            calls.push(args);
            return true;
        }
    };
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('a', {
        displayName: 'ace'
    });

    const event = simulation.requestAction(playerId, 'interact', {
        targetKind: 'shop',
        targetIndex: 2
    });

    assert.equal(calls[0][0].id, playerId);
    assert.deepEqual(calls[0][0].inventory, {});
    assert.deepEqual(calls[0].slice(1), ['shop', 2]);
    assert.equal(event.type, 'reward');
});

test('guest ship edits conserve that guest build and inventory atomically', () => {
    const game = createGame();
    game.session = {
        stageSavedShip: data => {
            const staged = new ShipStub();
            staged.parts = data.parts.map(part => ({ ...part }));
            staged.permanentStats = { ...data.permanentStats };
            return staged;
        }
    };
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('a', {
        displayName: 'ace'
    });
    const peer = simulation.peers.get(playerId);
    peer.inventory = { common: 1 };
    const parts = [{
        x: 0,
        y: 0,
        partId: 'core',
        rotation: 0
    }, {
        x: 1,
        y: 0,
        partId: 'common',
        rotation: 0
    }];

    const event = simulation.requestAction(playerId, 'ship_edit', {
        parts
    });

    assert.equal(event.type, 'ship_state');
    assert.deepEqual([...peer.ship.getUniqueParts()], parts);
    assert.deepEqual(peer.inventory, {});
    assert.equal(simulation.requestAction(playerId, 'ship_edit', {
        parts: [...parts, {
            x: 2,
            y: 0,
            partId: 'common',
            rotation: 0
        }]
    }), false);
});

test('guest ships can cross real exits but cannot fly into missing rooms', () => {
    const game = createGame();
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('a', {
        displayName: 'ace'
    });
    const peer = simulation.peers.get(playerId);
    peer.ship.x = 1990;
    peer.ship.y = 1000;
    peer.ship.vx = 25;

    game.levelGen.getRoomAtWorldPos = () => null;
    simulation.constrainToActiveRoom(peer.ship);
    assert.equal(peer.ship.x, 1970);
    assert.equal(peer.ship.vx, 0);

    peer.ship.x = 1990;
    peer.ship.vx = 25;
    game.levelGen.getRoomAtWorldPos = () => ({ gridX: 1, gridY: 0 });
    simulation.constrainToActiveRoom(peer.ship);
    assert.equal(peer.ship.x, 1990);
    assert.equal(peer.ship.vx, 25);
});

test('guest regeneration uses the original combat-only level math', () => {
    const game = createGame();
    game.enemies = [{}];
    game.level = 3;
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('a', {
        displayName: 'ace'
    });
    const peer = simulation.peers.get(playerId);
    peer.ship.hp = 50;
    peer.ship.stats = { regen: 10 };

    simulation.recoverPeers(1, 1.02);

    assert.equal(peer.ship.hp, 60.2);
});

test('each peer receives and applies only its own level-up choice', () => {
    const game = createGame();
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId: firstId } = simulation.addPeer('a', {
        displayName: 'ace'
    });
    const { playerId: secondId } = simulation.addPeer('b', {
        displayName: 'bee'
    });
    let choiceIndex = 0;
    simulation.beginPeerLevelUps(() => [
        upgradeChoice('mobility', 0.1 + choiceIndex++ * 0.1),
        upgradeChoice('regen', 0.5),
        upgradeChoice('maxHp', 0.1)
    ]);

    const firstState = simulation.snapshotFor(firstId);
    const secondState = simulation.snapshotFor(secondId);
    assert.equal(firstState.levelUp.choices.length, 3);
    assert.equal(secondState.levelUp.choices.length, 3);
    assert.notEqual(
        firstState.levelUp.choices[0].value,
        secondState.levelUp.choices[0].value
    );

    game.levelUpManager.active = true;
    game.levelUpManager.selectionPending = true;
    const event = simulation.requestAction(firstId, 'level_up', {
        index: 0
    });
    assert.equal(event.type, 'reward');
    assert.equal(
        simulation.peers.get(firstId).ship.permanentStats.speedMul,
        1.1
    );
    assert.equal(
        simulation.peers.get(secondId).ship.permanentStats.speedMul,
        1
    );
    assert.deepEqual(
        simulation.snapshotFor(firstId).levelUp.choices,
        []
    );
    assert.equal(game.paused, true);

    assert.ok(simulation.requestAction(secondId, 'level_up', {
        index: 0
    }));
    assert.equal(simulation.levelUpInProgress, false);
    assert.equal(game.paused, false);
});

test('a departing peer cannot leave the level-up barrier stuck', () => {
    const game = createGame();
    const simulation = new HostGameSimulation(game, {
        ShipClass: ShipStub,
        WeaponSystemClass: WeaponSystemStub
    });
    const { playerId } = simulation.addPeer('a', {
        displayName: 'ace'
    });
    simulation.beginPeerLevelUps(() => [
        upgradeChoice(),
        upgradeChoice('regen', 0.5),
        upgradeChoice('maxHp', 0.1)
    ]);
    game.levelUpManager.active = true;
    game.levelUpManager.selectionPending = true;

    assert.equal(simulation.removePeer(playerId), true);
    assert.equal(simulation.levelUpInProgress, false);
    assert.equal(game.paused, false);
});
