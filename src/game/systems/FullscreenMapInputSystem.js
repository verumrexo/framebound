export class FullscreenMapInputSystem {
    constructor(game) {
        this.game = game;
    }

    update({ isMouseDown, mouse, mouseClicked }) {
        const game = this.game;
        if (!game.fullscreenMapOpen) return false;

        if (mouseClicked) {
            const room = game.fullscreenMap.getClickedRoom ?
                game.fullscreenMap.getClickedRoom(mouse.x, mouse.y) :
                game.fullscreenMap.getHoveredRoom(mouse.x, mouse.y);

            if (
                room &&
                room.visited &&
                room !== game.currentRoom
            ) {
                game.teleportToRoom(room);
                game.fullscreenMapOpen = false;
            }
        }

        game.mouseDownLastFrame = isMouseDown;
        game.input.clearPressed();
        return true;
    }
}
