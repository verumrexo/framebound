import { partSoundEventKey } from '../audio/SoundEventRegistry.js';

export class PlayerControlSystem {
    constructor(game) {
        this.game = game;
    }

    updateDash(dt) {
        const game = this.game;
        const boosterCount = game.playerShip.stats.boosterCount || 0;

        if (game.dashCooldown > 0) {
            game.dashCooldown -= dt;
        }

        if (boosterCount > 0 &&
            game.input.isKeyDown('ShiftLeft') &&
            game.dashCooldown <= 0) {
            const actualMaxCooldown = Math.max(1.0, game.dashMaxCooldown / boosterCount);
            game.dashActiveTimer = game.dashDuration;
            game.dashCooldown = actualMaxCooldown;
            game.showNotification('dash system pulse', '#00ffff');
            const boosterPartId = game.playerShip.stats.boosterPartId;
            if (boosterPartId && game.audio.playEvent) {
                game.audio.playEvent(
                    partSoundEventKey(boosterPartId, 'dash'),
                    'dash',
                    { volume: 0.7 }
                );
            } else {
                game.audio.play('dash', { volume: 0.7 });
            }
        }

        if (game.dashActiveTimer > 0) {
            game.dashActiveTimer -= dt;
            const angle = game.rotation - Math.PI / 2;
            game.vx += Math.cos(angle) * game.dashPower * dt;
            game.vy += Math.sin(angle) * game.dashPower * dt;
        }
    }

    sampleMovementAxes() {
        const { input } = this.game;
        let inputX = 0;
        let inputY = 0;

        if (input.isKeyDown('KeyW')) inputY -= 1;
        if (input.isKeyDown('KeyS')) inputY += 1;
        if (input.isKeyDown('KeyA')) inputX -= 1;
        if (input.isKeyDown('KeyD')) inputX += 1;

        return { inputX, inputY };
    }

    applyMovement(dt, mouse, axes) {
        const game = this.game;
        const { inputX, inputY } = axes;
        const requestedZoom = game.playerShip?.stats?.cameraZoom;
        game.camera.zoom = Number.isFinite(requestedZoom) && requestedZoom > 0
            ? requestedZoom
            : 0.6;
        const inputState = {
            up: game.input.isKeyDown('KeyW') ||
                game.input.isKeyDown('ArrowUp') ||
                inputY < -0.1,
            down: game.input.isKeyDown('KeyS') ||
                game.input.isKeyDown('ArrowDown') ||
                inputY > 0.1,
            left: game.input.isKeyDown('KeyA') ||
                game.input.isKeyDown('ArrowLeft') ||
                inputX < -0.1,
            right: game.input.isKeyDown('KeyD') ||
                game.input.isKeyDown('ArrowRight') ||
                inputX > 0.1,
            shift: game.input.isKeyDown('ShiftLeft'),
            analogX: inputX,
            analogY: inputY,
            aimAngle: null
        };

        const zoom = game.camera.zoom || 1;
        const worldMouseX = (mouse.x / zoom) + game.camera.x;
        const worldMouseY = (mouse.y / zoom) + game.camera.y;

        const hasTracker = Array.from(game.playerShip.parts.values())
            .some(part => part.partId === 'custom_1768410456823');
        if (hasTracker) {
            inputState.aimAngle = Math.atan2(
                worldMouseY - game.y,
                worldMouseX - game.x
            ) + Math.PI / 2;
        } else {
            const speed = Math.sqrt(game.vx * game.vx + game.vy * game.vy);
            if (speed > 50) {
                inputState.aimAngle = Math.atan2(game.vy, game.vx) + Math.PI / 2;
            }
        }

        game.playerShip.x = game.x;
        game.playerShip.y = game.y;
        game.playerShip.vx = game.vx;
        game.playerShip.vy = game.vy;
        game.playerShip.rotation = game.rotation;

        game.playerShip.update(dt, inputState, {
            movementMultiplier: game.currentRoom?.cleared ? 2.0 : 1.0,
            externalDashActive: game.dashActiveTimer > 0
        });

        game.x = game.playerShip.x;
        game.y = game.playerShip.y;
        game.vx = game.playerShip.vx;
        game.vy = game.playerShip.vy;
        game.rotation = game.playerShip.rotation;

        if (game.network && game.network.isConnected) {
            game.network.sendInput(inputState);
        }

        return { inputState, worldMouseX, worldMouseY };
    }
}
