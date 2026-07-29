import test from 'node:test';
import assert from 'node:assert/strict';

import { RoomRegistry } from './RoomRegistry.js';

function createRoom(id, playerIds = []) {
    const room = {
        id,
        name: `room ${id}`,
        clients: new Map(playerIds.map(playerId => [playerId, {}])),
        destroyed: false,
        removed: [],
        getPlayerCount() {
            return this.clients.size;
        },
        removePlayer(socket) {
            this.removed.push(socket.id);
            this.clients.delete(socket.id);
        },
        destroy() {
            this.destroyed = true;
        }
    };
    return room;
}

test('leaving a lobby destroys and removes its empty room', () => {
    const registry = new RoomRegistry();
    const room = createRoom('ABC123', ['player-1']);
    registry.add(room);

    assert.equal(registry.leaveSocket({ id: 'player-1' }), true);
    assert.equal(room.destroyed, true);
    assert.equal(registry.has(room.id), false);
});

test('leaving one lobby keeps rooms with remaining players alive', () => {
    const registry = new RoomRegistry();
    const room = createRoom('ABC123', ['player-1', 'player-2']);
    registry.add(room);

    registry.leaveSocket({ id: 'player-1' });

    assert.equal(room.destroyed, false);
    assert.equal(registry.has(room.id), true);
    assert.deepEqual([...room.clients.keys()], ['player-2']);
});

test('room and player caps are enforced by the registry', () => {
    const registry = new RoomRegistry({ maxPlayers: 2, maxRooms: 1 });
    const room = createRoom('ABC123', ['player-1', 'player-2']);

    assert.equal(registry.add(room), true);
    assert.equal(registry.add(createRoom('DEF456')), false);
    assert.equal(registry.canJoin(room), false);
    assert.deepEqual(registry.list(), [{
        id: 'ABC123',
        name: 'room ABC123',
        players: 2,
        maxPlayers: 2
    }]);
});
