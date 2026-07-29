import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { NetworkManager } = await import('./NetworkManager.js');

test('network frame updates remote players before publishing local state', () => {
    const calls = [];
    const manager = new NetworkManager({
        x: 10,
        y: 20,
        rotation: 0.5
    });
    manager.otherPlayers.set('first', {
        update: dt => calls.push(['update-first', dt])
    });
    manager.otherPlayers.set('second', {
        update: dt => calls.push(['update-second', dt])
    });
    manager.isConnected = true;
    manager.socket = {
        emit: (...args) => calls.push(['emit', ...args])
    };

    manager.update(0.25);

    assert.deepEqual(calls, [
        ['update-first', 0.25],
        ['update-second', 0.25],
        ['emit', 'update_state', {
            x: 10,
            y: 20,
            rotation: 0.5
        }]
    ]);
});

test('offline network frames still update local remote-player interpolation', () => {
    const calls = [];
    const manager = new NetworkManager({
        x: 10,
        y: 20,
        rotation: 0.5
    });
    manager.otherPlayers.set('peer', {
        update: dt => calls.push(['update', dt])
    });

    manager.update(0.1);

    assert.deepEqual(calls, [['update', 0.1]]);
});

test('disconnect clears local network identity immediately and tolerates no socket', () => {
    const calls = [];
    const manager = new NetworkManager({});
    manager.isConnected = true;
    manager.playerId = 'player-1';
    manager.otherPlayers.set('peer', {});
    manager.socket = {
        disconnect: () => calls.push('socket-disconnect')
    };

    manager.disconnect();

    assert.equal(manager.isConnected, false);
    assert.equal(manager.playerId, null);
    assert.equal(manager.otherPlayers.size, 0);
    assert.deepEqual(calls, ['socket-disconnect']);

    manager.socket = null;
    assert.doesNotThrow(() => manager.disconnect());
});

test('malformed inbound socket payloads are ignored before game mutation', () => {
    const handlers = new Map();
    const socket = {
        connected: false,
        on: (event, handler) => handlers.set(event, handler),
        connect() {},
        disconnect() {},
        emit() {}
    };
    const forbidden = () => assert.fail('malformed packet reached game state');
    const manager = new NetworkManager({
        x: 0,
        y: 0,
        rotation: 0,
        enemies: [],
        createLocalPlayer: forbidden,
        startGame: forbidden,
        spawnProjectile: forbidden,
        spawnEnemyProjectile: forbidden,
        spawnDamageNumber: forbidden,
        audio: { play: forbidden }
    }, {
        socketFactory: () => socket
    });
    manager.onLobbyListUpdate = forbidden;
    manager.onLobbyJoined = forbidden;
    manager.onLobbyError = forbidden;
    manager.connect();

    for (const event of [
        'lobby_list',
        'lobby_created',
        'lobby_joined',
        'lobby_error',
        'init',
        'player_join',
        'player_leave',
        'world_update',
        'player_shoot',
        'enemy_hit',
        'players_list',
        'enemy_update',
        'enemy_shoots'
    ]) {
        assert.doesNotThrow(
            () => handlers.get(event)(null),
            `${event} should reject null`
        );
    }

    assert.doesNotThrow(() => handlers.get('world_update')([{
        id: 'peer',
        x: Infinity,
        y: 0,
        rotation: 0
    }]));
    assert.doesNotThrow(() => handlers.get('enemy_shoots')([{
        x: 0,
        y: 0,
        angle: NaN,
        type: 'bullet',
        speed: 600,
        damage: 5
    }]));
    assert.doesNotThrow(() => handlers.get('player_shoot')({
        partId: 'toString',
        x: 0,
        y: 0,
        angle: 0
    }));
    assert.equal(manager.otherPlayers.size, 0);
});

test('remote snapshots whitelist interpolation fields and input values', () => {
    const handlers = new Map();
    const socket = {
        connected: false,
        on: (event, handler) => handlers.set(event, handler),
        connect() {},
        disconnect() {},
        emit() {}
    };
    const manager = new NetworkManager({
        x: 0,
        y: 0,
        rotation: 0,
        enemies: []
    }, {
        socketFactory: () => socket
    });
    manager.connect();

    handlers.get('world_update')([{
        id: 'peer',
        x: 10,
        y: 20,
        rotation: 1e308,
        timestamp: -1,
        hp: NaN,
        maxHp: 150,
        input: {
            up: true,
            analogX: 0.25,
            analogY: 5,
            injected: 'nope'
        },
        injected: 'nope'
    }]);

    const peer = manager.otherPlayers.get('peer');
    const snapshot = peer.interpolationBuffer[0];
    assert.equal(peer.maxHp, 150);
    assert.equal(peer.hp, 100);
    assert.ok(snapshot.timestamp > 0);
    assert.notEqual(snapshot.timestamp, -1);
    assert.ok(snapshot.rotation >= -Math.PI);
    assert.ok(snapshot.rotation <= Math.PI);
    assert.equal(snapshot.injected, undefined);
    assert.deepEqual(snapshot.input, {
        up: true,
        analogX: 0.25
    });
});

test('lobby lists expose only complete bounded rows to menu code', () => {
    const handlers = new Map();
    const socket = {
        connected: false,
        on: (event, handler) => handlers.set(event, handler),
        connect() {},
        disconnect() {},
        emit() {}
    };
    const manager = new NetworkManager({
        x: 0,
        y: 0,
        rotation: 0,
        enemies: []
    }, {
        socketFactory: () => socket
    });
    let received = null;
    manager.onLobbyListUpdate = list => {
        received = list;
    };
    manager.connect();

    handlers.get('lobby_list')([
        {
            id: 'ABC123',
            name: 'good room',
            players: 1,
            maxPlayers: 8,
            injected: 'nope'
        },
        null,
        {
            id: 'BAD123',
            name: 'bad room',
            players: 'many',
            maxPlayers: 8
        }
    ]);

    assert.deepEqual(received, [{
        id: 'ABC123',
        name: 'good room',
        players: 1,
        maxPlayers: 8
    }]);
});
