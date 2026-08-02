import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LevelGenerator } from './LevelGenerator.js';
import { RoomType } from './RoomType.js';

function signature(rooms) {
    return rooms.map(room => ({
        gridX: room.gridX,
        gridY: room.gridY,
        widthUnits: room.widthUnits,
        heightUnits: room.heightUnits,
        type: room.type
    }));
}

function connectedRoomCount(generator, startRoom) {
    const seen = new Set([startRoom]);
    const pending = [startRoom];

    while (pending.length > 0) {
        const room = pending.pop();
        for (
            let gridX = room.gridX;
            gridX < room.gridX + room.widthUnits;
            gridX++
        ) {
            for (
                let gridY = room.gridY;
                gridY < room.gridY + room.heightUnits;
                gridY++
            ) {
                for (const [dx, dy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1]
                ]) {
                    const neighbor = generator.getRoom(
                        gridX + dx,
                        gridY + dy
                    );
                    if (neighbor && !seen.has(neighbor)) {
                        seen.add(neighbor);
                        pending.push(neighbor);
                    }
                }
            }
        }
    }

    return seen.size;
}

test('seeded floor generation is repeatable across repeated runs', (t) => {
    t.mock.method(console, 'log', () => {});
    const first = new LevelGenerator();
    const second = new LevelGenerator();

    const firstRooms = first.generate(15, 4242);
    const repeatedRooms = first.generate(15, 4242);
    const secondRooms = second.generate(15, 4242);

    assert.deepEqual(signature(firstRooms), signature(repeatedRooms));
    assert.deepEqual(signature(firstRooms), signature(secondRooms));
});

test('generated route cells have one owner and remain connected to start', (t) => {
    t.mock.method(console, 'log', () => {});

    for (let seed = 1; seed <= 100; seed++) {
        const generator = new LevelGenerator();
        const rooms = generator.generate(15, seed);
        const startRoom = generator.getRoom(0, 0);

        assert.ok(startRoom, `seed ${seed} must contain the start room`);
        assert.equal(
            connectedRoomCount(generator, startRoom),
            rooms.length,
            `seed ${seed} generated a disconnected room`
        );
        assert.equal(
            rooms.filter(room => room.type === RoomType.BOSS).length,
            1,
            `seed ${seed} must contain exactly one boss room`
        );
        assert.ok(
            rooms.filter(room => room.type === RoomType.VAULT).length <= 1,
            `seed ${seed} generated multiple vaults`
        );

        for (const room of rooms) {
            for (
                let gridX = room.gridX;
                gridX < room.gridX + room.widthUnits;
                gridX++
            ) {
                for (
                    let gridY = room.gridY;
                    gridY < room.gridY + room.heightUnits;
                    gridY++
                ) {
                    assert.equal(
                        generator.getRoom(gridX, gridY),
                        room,
                        `seed ${seed} has a mismatched grid owner`
                    );
                }
            }
        }
    }
});

test('world lookup keeps floor semantics for negative coordinates', (t) => {
    t.mock.method(console, 'log', () => {});
    const generator = new LevelGenerator();
    generator.generate(15, 17);
    generator.grid.set('-1,-1', { id: 'negative-room' });

    assert.equal(
        generator.getRoomAtWorldPos(-1, -1).id,
        'negative-room'
    );
    assert.equal(
        generator.getRoomAtWorldPos(-2000, -2000).id,
        'negative-room'
    );
});
