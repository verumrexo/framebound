export class FrameRuntimeSystem {
    constructor(game) {
        this.game = game;
    }

    update(dt) {
        const game = this.game;

        // Part Lab owns the combat slice while it is open. Keeping this branch
        // before the normal frame pipeline guarantees the dedicated simulation
        // pipeline owns the frame exactly once.
        if (game.partLabSimulation?.active) {
            game.partLabSimulation.update(dt, { frameRuntime: this });
            return;
        }

        if (!game.running || !game.playerShip) return;

        let isMouseDown = game.input.isMouseDown();
        const mouse = game.input.getMousePos();
        const mouseClicked = isMouseDown && !game.mouseDownLastFrame;

        if (game.fullscreenMapInput.update({
            isMouseDown,
            mouse,
            mouseClicked
        })) return;

        if (game.gameOverController.update(isMouseDown)) return;

        game.effects.updateDamageNumbers(dt);

        if (game.isSpectating) {
            this.updateSpectatorFrame(dt, isMouseDown);
            return;
        }

        if (game.gameplayOverlays.update(dt, isMouseDown)) return;

        game.playerStateGuard.repairNonFiniteState();
        game.abilitySystem?.update?.(dt);

        const levelBonus = 1 + (game.level - 1) * 0.01;

        if (game.peerNetwork?.isGuest) {
            game.salvageSweep?.updateGuest?.(dt);
            game.worldInteractions.updateGuest?.(dt);
            game.playerControls.updateDash(dt);
            const guestMovementAxes =
                game.playerControls.sampleMovementAxes();
            const guestAim = game.playerControls.applyMovement(
                dt,
                mouse,
                guestMovementAxes
            );
            this.handleActiveAbilityInput(
                guestAim.worldMouseX,
                guestAim.worldMouseY,
                true
            );
            game.peerNetwork.sendFireIntent(
                isMouseDown,
                Math.atan2(
                    guestAim.worldMouseY - game.y,
                    guestAim.worldMouseX - game.x
                )
            );
            game.peerNetwork.updateGuest(dt);
            game.effects.updateExplosions(dt);
            game.effects.updateNotifications(dt);
            game.camera.follow({ x: game.x, y: game.y });
            game.camera.update(dt);
            game.mouseDownLastFrame = isMouseDown;
            game.input.clearPressed();
            return;
        }

        game.itemPickupSystem.update(dt);
        game.playerControls.updateDash(dt);
        const movementAxes = game.playerControls.sampleMovementAxes();

        game.worldInteractions.update(dt);

        const { worldMouseX, worldMouseY } = game.playerControls.applyMovement(
            dt,
            mouse,
            movementAxes
        );

        this.handleActiveAbilityInput(worldMouseX, worldMouseY, false);

        game.roomRuntime.update(dt);
        game.salvageSweep?.update?.(dt);

        // Core Spin (1 rotation per second)
        game.coreSpinAngle += Math.PI * 2 * dt;

        const weaponUpdate = game.weaponSystem.update(dt, {
            isMouseDown,
            worldMouseX,
            worldMouseY,
            levelBonus
        });
        isMouseDown = weaponUpdate.isMouseDown;
        if (weaponUpdate.blockedFrame) return;

        game.peerNetwork?.updateHost(dt);
        game.projectileSystem.update(dt);
        if (game.floorProgression.updatePortals(dt)) return;

        game.effects.updateExplosions(dt);
        game.droneSystem.update(dt);
        game.enemyLifecycle.update(dt);
        game.resourceOrbs.update(dt);
        game.playerRecovery.update(dt, levelBonus);
        game.peerNetwork?.updatePeerRecovery?.(dt, levelBonus);
        game.physicsSystem.update(dt);
        game.effects.updateNotifications(dt);

        game.camera.follow({ x: game.x, y: game.y });
        game.camera.update(dt);
        game.mouseDownLastFrame = isMouseDown;
        game.input.clearPressed();
        game.networkManager?.update(dt);
    }

    /**
     * Run one local gameplay frame for Part Lab. The lab intentionally skips
     * menus, room transitions, and network replication, but keeps the real
     * input, ship movement, ability, weapon, projectile, drone, enemy,
     * physics, effects, and camera order. The simulation adapter gets one
     * hook after enemy movement so it can add its deterministic test dart.
     */
    updatePartLabFrame(dt, { afterEnemyUpdate = null } = {}) {
        const game = this.game;
        if (!game.running || !game.playerShip) return null;

        let isMouseDown = game.input.isMouseDown();
        const mouse = game.input.getMousePos();

        game.effects.updateDamageNumbers(dt);
        game.playerStateGuard.repairNonFiniteState();
        game.abilitySystem?.update?.(dt);

        const levelBonus = 1 + (game.level - 1) * 0.01;
        game.playerControls.updateDash(dt);
        const movementAxes = game.playerControls.sampleMovementAxes();
        const { worldMouseX, worldMouseY } = game.playerControls.applyMovement(
            dt,
            mouse,
            movementAxes,
            { sendNetwork: false }
        );

        this.handleActiveAbilityInput(worldMouseX, worldMouseY, false);
        game.coreSpinAngle += Math.PI * 2 * dt;

        const weaponUpdate = game.weaponSystem.update(dt, {
            isMouseDown,
            worldMouseX,
            worldMouseY,
            levelBonus
        });
        isMouseDown = weaponUpdate.isMouseDown;
        if (weaponUpdate.blockedFrame) {
            game.mouseDownLastFrame = isMouseDown;
            game.input.clearPressed();
            return { blockedFrame: true };
        }

        game.projectileSystem.update(dt);
        game.effects.updateExplosions(dt);
        game.droneSystem.update(dt);
        game.enemyLifecycle.update(dt);
        afterEnemyUpdate?.();
        game.resourceOrbs?.update?.(dt);
        game.playerRecovery.update(dt, levelBonus);
        game.physicsSystem.update(dt);
        game.effects.updateNotifications(dt);

        game.camera.follow({ x: game.x, y: game.y });
        game.camera.update(dt);
        game.mouseDownLastFrame = isMouseDown;
        game.input.clearPressed();

        return {
            worldMouseX,
            worldMouseY,
            isMouseDown,
            camera: game.camera
        };
    }

    updateSpectatorFrame(dt, isMouseDown) {
        const game = this.game;
        const target = game.peerNetwork?.spectatorTarget;

        if (game.peerNetwork?.isGuest) {
            game.peerNetwork.sendInput?.({
                up: false,
                down: false,
                left: false,
                right: false,
                shift: false,
                analogX: 0,
                analogY: 0,
                aimAngle: null
            });
            game.peerNetwork.sendFireIntent?.(false, 0);
            game.peerNetwork.updateGuest(dt);
            game.effects.updateExplosions(dt);
        } else {
            game.abilitySystem?.update?.(dt);
            game.peerNetwork?.updateHost(dt);
            game.projectileSystem.update(dt);
            game.effects.updateExplosions(dt);
            game.droneSystem.update(dt);
            game.enemyLifecycle.update(dt);
            if (!game.playerShip.isDead) game.resourceOrbs.update(dt);
            game.playerRecovery.update(
                dt,
                1 + (game.level - 1) * 0.01
            );
            game.peerNetwork?.updatePeerRecovery?.(
                dt,
                1 + (game.level - 1) * 0.01
            );
            game.physicsSystem.update(dt);
        }

        game.effects.updateNotifications(dt);
        game.camera.follow(target || { x: game.x, y: game.y });
        game.camera.update(dt);
        game.mouseDownLastFrame = isMouseDown;
        game.input.clearPressed();
    }

    handleActiveAbilityInput(worldMouseX, worldMouseY, isGuest) {
        const game = this.game;
        const abilitySystem = game.abilitySystem;
        if (
            !abilitySystem ||
            game.hangar?.active ||
            game.shipBuilder?.active
        ) return;

        if (game.input.isKeyPressed?.('KeyQ')) {
            abilitySystem.cycleSelection(game.playerShip);
        }

        const mouse = game.input.getMousePos();
        if (!mouse.wasRightPressed) return;

        const selected = abilitySystem.selectedAbility(game.playerShip);
        if (!selected) return;
        const aimAngle = Math.atan2(
            worldMouseY - game.y,
            worldMouseX - game.x
        );
        const payload = {
            abilityId: selected.id,
            aimAngle
        };

        if (isGuest) {
            game.peerNetwork?.sendAbility?.(payload.abilityId, payload.aimAngle);
            return;
        }
        abilitySystem.activateForPlayer('host', game.playerShip, payload);
    }
}
