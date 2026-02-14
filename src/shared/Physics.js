export const Physics = {
    defaults: {
        acceleration: 2000,
        friction: 0.92,
        maxVelocity: 800
    },

    update: function(entity, input, dt, options = {}) {
        const accel = options.acceleration || this.defaults.acceleration;
        const friction = options.friction || this.defaults.friction;
        const maxVel = options.maxVelocity || this.defaults.maxVelocity;

        // 1. Apply Input
        let inputX = 0;
        let inputY = 0;

        // Support both object {x, y} (analog/pre-calc) and {up, down...} (digital/server)
        if (input) {
            if (typeof input.x === 'number' && typeof input.y === 'number') {
                inputX = input.x;
                inputY = input.y;
            } else {
                if (input.up) inputY -= 1;
                if (input.down) inputY += 1;
                if (input.left) inputX -= 1;
                if (input.right) inputX += 1;
            }
        }

        if (inputX !== 0 || inputY !== 0) {
            const mag = Math.sqrt(inputX * inputX + inputY * inputY);
            if (mag > 0) {
                // Normalize and apply acceleration
                entity.vx += (inputX / mag) * accel * dt;
                entity.vy += (inputY / mag) * accel * dt;
            }
        }

        // 2. Integration
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;

        // 3. Friction
        entity.vx *= friction;
        entity.vy *= friction;

        // 4. Cap Speed
        const speed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
        if (speed > maxVel) {
            entity.vx = (entity.vx / speed) * maxVel;
            entity.vy = (entity.vy / speed) * maxVel;
        }

        // 5. Rotation (Optional, if input provides it)
        if (input && input.rotation !== undefined) {
            entity.rotation = input.rotation;
        }
    }
};
