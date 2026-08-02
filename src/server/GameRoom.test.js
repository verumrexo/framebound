import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { GameRoom } = await import('./GameRoom.js');
const { Ship } = await import('../shared/entities/Ship.js');

function createHarness(clientOverrides = {}) {
    const handlers = new Map();
    const removedHandlers = [];
    const broadcasts = [];
    const directEmits = [];
    const socket = {
        id: 'shooter',
        on(event, handler) {
            handlers.set(event, handler);
        },
        off(event, handler) {
            removedHandlers.push({ event, handler });
        },
        leave() {},
        to(roomId) {
            assert.equal(roomId, 'room-1');
            return {
                emit(event, data) {
                    broadcasts.push({ event, data });
                }
            };
        },
        emit(event, data) {
            directEmits.push({ event, data });
        }
    };

    const client = {
        id: socket.id,
        input: {},
        ...clientOverrides
    };
    const room = Object.create(GameRoom.prototype);
    room.id = 'room-1';
    room.clients = new Map([[socket.id, client]]);
    room.projectiles = [];
    room.socketHandlers = new Map();
    room.io = {
        to: () => ({
            emit(event, data) {
                broadcasts.push({ event, data });
            }
        })
    };

    room.setupSocketHandlers(socket);
    return { broadcasts, client, directEmits, handlers, removedHandlers, room, socket };
}

test('valid player shots are broadcast to peers without echoing to the shooter', () => {
    const { broadcasts, handlers, room } = createHarness();

    handlers.get('player_shoot')({
        partId: 'gun_basic',
        x: 10,
        y: 20,
        angle: 0.5
    });

    assert.equal(room.projectiles.length, 1);
    assert.deepEqual(broadcasts, [{
        event: 'player_shoot',
        data: {
            id: 'shooter',
            partId: 'gun_basic',
            x: 10,
            y: 20,
            angle: 0.5
        }
    }]);
});

test('malformed socket payloads are ignored without throwing', () => {
    const { handlers, room } = createHarness({ ship: new Ship() });

    assert.doesNotThrow(() => handlers.get('player_input')(null));
    assert.doesNotThrow(() => handlers.get('player_shoot')(null));
    assert.doesNotThrow(() => handlers.get('join_game')(null));
    assert.equal(room.projectiles.length, 0);
});

test('huge aim angles are normalized before they reach ship update', () => {
    const { client, handlers } = createHarness();

    handlers.get('player_input')({
        up: false,
        down: false,
        left: false,
        right: false,
        shift: false,
        analogX: 0,
        analogY: 0,
        aimAngle: 1e308
    });

    assert.equal(Number.isFinite(client.input.aimAngle), true);
    assert.ok(client.input.aimAngle >= -Math.PI);
    assert.ok(client.input.aimAngle <= Math.PI);
});

test('invalid ship manifests leave the existing server ship untouched', () => {
    const ship = new Ship();
    const originalParts = ship.parts;
    const { handlers } = createHarness({ ship });

    handlers.get('join_game')({
        parts: [
            { x: 0, y: 0, partId: 'core', rotation: 0 },
            { x: 10, y: 10, partId: 'gun_basic', rotation: 0 }
        ]
    });

    assert.equal(ship.parts, originalParts);
});

test('valid ship manifests replace the server layout atomically', () => {
    const ship = new Ship();
    const { broadcasts, handlers } = createHarness({ ship });
    const parts = [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        { x: 1, y: 0, partId: 'gun_basic', rotation: 0 }
    ];

    handlers.get('join_game')({ parts });

    assert.deepEqual([...ship.getUniqueParts()].map(part => part.partId), ['core', 'gun_basic']);
    assert.deepEqual(broadcasts.at(-1), {
        event: 'player_join',
        data: { id: 'shooter', parts }
    });
});

test('removing a player tears down room-specific socket handlers', () => {
    const { removedHandlers, room, socket } = createHarness();

    assert.equal(room.removePlayer(socket), true);
    assert.deepEqual(removedHandlers.map(({ event }) => event).sort(), [
        'join_game',
        'player_input',
        'player_shoot'
    ]);
    assert.equal(room.clients.has(socket.id), false);
});

test('rooms reject players beyond the advertised cap', () => {
    const room = Object.create(GameRoom.prototype);
    room.maxPlayers = 8;
    room.clients = new Map(
        Array.from({ length: 8 }, (_, index) => [`player-${index}`, {}])
    );

    assert.equal(room.addPlayer({ id: 'player-9' }), false);
    assert.equal(room.clients.size, 8);
});
