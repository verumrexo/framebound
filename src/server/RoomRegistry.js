export class RoomRegistry {
    constructor({ maxPlayers = 8, maxRooms = 100 } = {}) {
        this.maxPlayers = maxPlayers;
        this.maxRooms = maxRooms;
        this.rooms = new Map();
    }

    get size() {
        return this.rooms.size;
    }

    add(room) {
        if (!room || typeof room.id !== 'string') return false;
        if (this.rooms.has(room.id) || this.rooms.size >= this.maxRooms) return false;

        room.maxPlayers = this.maxPlayers;
        this.rooms.set(room.id, room);
        return true;
    }

    get(roomId) {
        return this.rooms.get(roomId);
    }

    has(roomId) {
        return this.rooms.has(roomId);
    }

    remove(roomId, { destroy = false } = {}) {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        if (destroy) room.destroy();
        return this.rooms.delete(roomId);
    }

    findBySocketId(socketId) {
        for (const room of this.rooms.values()) {
            if (room.clients.has(socketId)) return room;
        }
        return null;
    }

    canJoin(room) {
        return Boolean(room) && room.getPlayerCount() < this.maxPlayers;
    }

    leaveSocket(socket) {
        let changed = false;

        for (const [roomId, room] of this.rooms) {
            if (!room.clients.has(socket.id)) continue;

            room.removePlayer(socket);
            changed = true;

            if (room.getPlayerCount() === 0) {
                room.destroy();
                this.rooms.delete(roomId);
            }
        }

        return changed;
    }

    list() {
        return [...this.rooms.values()].map(room => ({
            id: room.id,
            name: room.name,
            players: room.getPlayerCount(),
            maxPlayers: this.maxPlayers
        }));
    }

    destroyAll() {
        for (const room of this.rooms.values()) {
            room.destroy();
        }
        this.rooms.clear();
    }
}
