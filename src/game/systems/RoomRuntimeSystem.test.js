import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomRuntimeSystem } from './RoomRuntimeSystem.js';

function createRoom(id, calls) {
    return {
        id,
        checkAmbushStatus: game => calls.push([
            'ambush',
            id,
            game.currentRoom.id
        ]),
        update: game => calls.push([
            'room-update',
            id,
            game.currentRoom.id
        ])
    };
}

test('room runtime preserves ambush, transition, room update, and bounds order', () => {
    const calls = [];
    const room = createRoom('same', calls);
    const game = { currentRoom: room };
    const transitions = {
        update: () => calls.push(['transition']),
        enforceCurrentRoomBounds: () => calls.push(['bounds'])
    };

    new RoomRuntimeSystem(game, { transitions }).update();

    assert.deepEqual(calls, [
        ['ambush', 'same', 'same'],
        ['transition'],
        ['room-update', 'same', 'same'],
        ['bounds']
    ]);
});

test('a transition updates and clamps the newly entered room in the same frame', () => {
    const calls = [];
    const previousRoom = createRoom('previous', calls);
    const nextRoom = createRoom('next', calls);
    const game = { currentRoom: previousRoom };
    const transitions = {
        update: () => {
            calls.push(['transition']);
            game.currentRoom = nextRoom;
        },
        enforceCurrentRoomBounds: () => calls.push([
            'bounds',
            game.currentRoom.id
        ])
    };

    new RoomRuntimeSystem(game, { transitions }).update();

    assert.deepEqual(calls, [
        ['ambush', 'previous', 'previous'],
        ['transition'],
        ['room-update', 'next', 'next'],
        ['bounds', 'next']
    ]);
});

test('room runtime tolerates an absent room before and after transition checks', () => {
    const calls = [];
    const game = { currentRoom: null };
    const transitions = {
        update: () => calls.push(['transition']),
        enforceCurrentRoomBounds: () => calls.push(['bounds'])
    };

    new RoomRuntimeSystem(game, { transitions }).update();

    assert.deepEqual(calls, [['transition']]);
});
