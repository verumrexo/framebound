const SAVE_KEY = 'framebound_save';
const SAVE_VERSION = 1;

export class SaveManager {
    static save(game) {
        try {
            // Serialize player ship parts
            const shipParts = [];
            for (const part of game.playerShip.getUniqueParts()) {
                shipParts.push({
                    x: part.x,
                    y: part.y,
                    partId: part.partId,
                    rotation: part.rotation || 0
                });
            }

            // Collect visited rooms
            const visitedRooms = [];
            for (const room of game.rooms) {
                if (room.visited) {
                    visitedRooms.push(`${room.gridX},${room.gridY}`);
                }
            }

            const saveData = {
                version: SAVE_VERSION,
                level: game.level,
                score: game.score,
                levelSeed: game.levelGen.seed, // Store the seed for deterministic regeneration
                xp: game.xp,
                gold: game.gold,
                xpToNext: game.xpToNext,
                playerPosition: {
                    x: game.x,
                    y: game.y,
                    rotation: game.rotation
                },
                playerShip: {
                    hp: game.playerShip.hp,
                    maxHp: game.playerShip.maxHp,
                    parts: shipParts
                },
                inventory: { ...game.hangar.inventory },
                currentRoomGrid: {
                    x: game.currentRoom.gridX,
                    y: game.currentRoom.gridY
                },
                visitedRooms: visitedRooms,
                timestamp: Date.now()
            };

            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            console.log('[Save] Game saved successfully');
            return true;
        } catch (e) {
            console.error('[Save] Failed to save game:', e);
            return false;
        }
    }

    static load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;

            const data = JSON.parse(raw);

            // Version check
            if (data.version !== SAVE_VERSION) {
                console.warn('[Save] Save version mismatch, clearing save');
                SaveManager.clearSave();
                return null;
            }

            console.log('[Save] Save loaded successfully');
            return data;
        } catch (e) {
            console.error('[Save] Failed to load save:', e);
            return null;
        }
    }

    static hasSave() {
        return localStorage.getItem(SAVE_KEY) !== null;
    }

    static clearSave() {
        localStorage.removeItem(SAVE_KEY);
        console.log('[Save] Save cleared');
    }
}
