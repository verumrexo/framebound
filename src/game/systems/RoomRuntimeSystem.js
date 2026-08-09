import { RoomTransitionSystem } from './RoomTransitionSystem.js';

export class RoomRuntimeSystem {
    constructor(game, {
        transitions = new RoomTransitionSystem(game)
    } = {}) {
        this.game = game;
        this.transitions = transitions;
    }

    update(dt = 0) {
        const game = this.game;

        if (game.currentRoom) {
            game.currentRoom.checkAmbushStatus(game, dt);
        }

        this.transitions.update();

        if (game.currentRoom) {
            game.currentRoom.update(game);
            this.transitions.enforceCurrentRoomBounds();
        }
    }
}
