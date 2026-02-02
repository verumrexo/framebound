export class PlayerController {
    constructor() {
        this.velocity = { x: 0, y: 0 };

        // Dash State
        this.dashCooldown = 0;
        this.dashMaxCooldown = 10;
        this.dashActiveTimer = 0;
        this.dashDuration = 1.5;
        this.dashPower = 4000;
    }

    update(game, dt) {
        if (game.isGameOver || game.isPaused || game.shipBuilder.active || game.hangar.active) return;
        if (!game.input) return;

        const input = game.input;

        // --- Dash Logic ---
        const boosterCount = game.playerShip.stats.boosterCount || 0;
        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }

        if (boosterCount > 0 && input.isKeyDown('ShiftLeft') && this.dashCooldown <= 0) {
            // Cooldown scales with booster count
            const actualMaxCooldown = Math.max(1.0, this.dashMaxCooldown / boosterCount);
            this.dashActiveTimer = this.dashDuration;
            this.dashCooldown = actualMaxCooldown;

            game.showNotification("dash system pulse", "#00ffff");
            game.audio.play('dash', { volume: 0.7 });
        }

        if (this.dashActiveTimer > 0) {
            this.dashActiveTimer -= dt;
        }

        // --- Movement Physics ---
        // Calculate Boosts
        const isSpawnRoom = game.currentRoom && game.currentRoom.gridX === 0 && game.currentRoom.gridY === 0;
        const outOfCombat = game.currentRoom && (game.currentRoom.cleared ||
            game.currentRoom.type === 'shop' || game.currentRoom.type === 'treasure' || isSpawnRoom);
        const combatBoost = outOfCombat ? 2.0 : 1.0;
        const levelBonus = 1.0 + ((game.level || 1) - 1) * 0.01;

        // Base Stats
        const perm = game.playerShip.permanentStats;
        const baseThrust = (game.playerShip.stats.thrust !== undefined) ? game.playerShip.stats.thrust : 0;
        const thrustMultiplier = 1 + (baseThrust * 0.05);
        const currentAccel = 2500 * thrustMultiplier * levelBonus * combatBoost * (perm.speedMul || 1.0);

        // Max VELOCITY (Cap)
        let maxSpeed = 150 * thrustMultiplier * levelBonus * combatBoost * (perm.speedMul || 1.0);
        // Increase Max Speed during dash
        if (this.dashActiveTimer > 0) {
            maxSpeed *= 2.5;
        }

        // Input


        let ax = 0;
        let ay = 0;

        if (input.isKeyDown('KeyW')) ay = -1;
        if (input.isKeyDown('KeyS')) ay = 1;
        if (input.isKeyDown('KeyA')) ax = -1;
        if (input.isKeyDown('KeyD')) ax = 1;

        if (input.joysticks && input.joysticks.left.active) {
            ax = input.joysticks.left.vector.x;
            ay = input.joysticks.left.vector.y;
        }

        // Normalize
        if (ax !== 0 || ay !== 0) {
            const len = Math.sqrt(ax * ax + ay * ay);
            if (len > 1) {
                ax /= len;
                ay /= len;
            }
        }

        // Apply Acceleration
        if (ax !== 0 || ay !== 0) {
            game.vx += ax * currentAccel * dt;
            game.vy += ay * currentAccel * dt;
        }

        // Apply Dash Force
        if (this.dashActiveTimer > 0) {
            // Dash pushes in FACING direction (rotation), not movement direction?
            // Game.js logic: angle = rotation - PI/2. 
            const angle = game.rotation - Math.PI / 2;
            game.vx += Math.cos(angle) * this.dashPower * dt;
            game.vy += Math.sin(angle) * this.dashPower * dt;
        }

        // Friction (Stronger when no input for tight control)
        // If dashing, maybe less friction? Or just power through.
        // Game.js had logic "Limit speed differently... or just let physics handle it".
        const friction = (ax === 0 && ay === 0) ? 0.92 : 0.96;
        game.vx *= friction;
        game.vy *= friction;

        // Speed Cap
        const vSq = game.vx * game.vx + game.vy * game.vy;
        if (vSq > maxSpeed * maxSpeed) {
            const vLen = Math.sqrt(vSq);
            game.vx = (game.vx / vLen) * maxSpeed;
            game.vy = (game.vy / vLen) * maxSpeed;
        }

        game.x += game.vx * dt;
        game.y += game.vy * dt;


        // --- Rotation Logic ---
        let targetRotation = null;
        let controlMode = 'mouse';

        if (input.joysticks && input.joysticks.right.active) {
            const rx = input.joysticks.right.vector.x;
            const ry = input.joysticks.right.vector.y;
            if (Math.abs(rx) > 0.1 || Math.abs(ry) > 0.1) {
                targetRotation = Math.atan2(ry, rx) + (Math.PI / 2);
                controlMode = 'gamepad';
            }
        }

        // Mouse Fallback
        if (targetRotation === null) {
            const mouse = input.getMousePos();
            // Check for 'Cursor Tracker' Part (custom_1768410456823)
            const hasTracker = Array.from(game.playerShip.parts.values()).some(p => p.partId === 'custom_1768410456823');

            if (hasTracker) {
                // Tracker: Face Mouse directly in world space
                const zoom = game.camera.zoom || 1;
                const worldMouseX = (mouse.x / zoom) + game.camera.x; // Approximate inverse camera
                const worldMouseY = (mouse.y / zoom) + game.camera.y;
                // Wait, Game.js implementation for mouse rotation was:
                // Math.atan2(mouse.y - height/2, mouse.x - width/2) + PI/2
                // That logic assumes player is always center screen.

                // But Tracker logic in Game.js used detailed world pos?
                // Actually Game.js lines 1186:
                // targetRotation = Math.atan2(worldMouseY - this.y, worldMouseX - this.x) + Math.PI / 2;

                // Let's stick to the simple screen-center logic for default, 
                // and world-logic for Tracker, BUT remember Player IS always center screen (Camera follows player).
                // So (WorldMouse - PlayerWorld) IS (ScreenMouse - ScreenCenter).
                // So they are mathematically identical unless camera is detached.

                targetRotation = Math.atan2(mouse.y - game.renderer.height / 2, mouse.x - game.renderer.width / 2) + Math.PI / 2;
            } else {
                // Default: Face movement direction if moving fast enough (Tank / Asteroids style?)
                // NO, Game.js default was also mouse-facing via screen center.
                // Wait, reviewing Game.js diff block lines 1190:
                // "else if (currentSpeedWrapper > 50) { targetRotation = atan2(vy, vx) + PI/2 }"
                // So by default it faces movement? And tracker enables mouse aiming?
                // Let's re-read line 1184 in Game.js diff for "mouse mode".
                // Ah, looking at the diff, line 1032 handling "Rotation" block used Mouse.
                // But lines 1152+ in diff (the deleted block) had sophisticated logic.

                // Correct Logic Reconstruction:
                // 1. Joystick overrides everything.
                // 2. If 'Cursor Tracker' part -> Face Mouse.
                // 3. If NO Tracker -> Face Movement Direction (like a car/plane), but only if moving.

                const speed = Math.sqrt(game.vx * game.vx + game.vy * game.vy);
                if (speed > 50) {
                    targetRotation = Math.atan2(game.vy, game.vx) + Math.PI / 2;
                }
            }
        }

        // Apply Rotation
        if (targetRotation !== null) {
            let diff = targetRotation - game.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            // Turn Rate based on Mass
            const baseTurnRate = 5.0;
            const currentMass = game.playerShip.stats.totalMass || 5;
            // Heavier = Slower turn. 
            let turnRate = (Math.max(0.5, baseTurnRate * (5 / currentMass)) + (game.playerShip.stats.turnSpeed || 0));
            turnRate *= (perm.turnMul || 1.0);

            const maxStep = turnRate * dt;

            // Snap if using mouse? Or always smooth?
            // Game.js used smooth turn for everything in that block.
            if (Math.abs(diff) > maxStep) {
                game.rotation += Math.sign(diff) * maxStep;
            } else {
                game.rotation = targetRotation;
            }
        }

    }
}
