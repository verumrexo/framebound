export class Starfield {
    constructor(count = 100, width = 2000, height = 2000) {
        this.stars = [];
        this.width = width;
        this.height = height;
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: (Math.random() - 0.5) * width,
                y: (Math.random() - 0.5) * height,
                size: Math.random() < 0.9 ? 1 : 2,
                alpha: 0.1 + Math.random() * 0.2 // Dim stars: 0.1 to 0.3 alpha
            });
        }
    }

    draw(renderer, cameraX, cameraY) {
        // Simple parallax or just static world-space stars?
        // Let's do world-space stars for now so they feel like part of the map.
        // To make them "infinite", we'd need tiling logic, but for now a large fixed field is easiest.

        // Actually, simple screen-space wrapping stars give a better "infinite space" feel cheaply.
        // But user might want them fixed in the world.
        // Let's try world-space first, but maybe just a lot of them scattered widely.

        // Re-reading request: "add same dim stars"
        // Let's do a large field.

        const ctx = renderer.ctx;
        ctx.fillStyle = '#fff';

        for (const star of this.stars) {
            // Simple tiling logic based on camera position to make it infinite
            // We want the star to be within the view.
            // relative position
            let rx = star.x - cameraX;
            let ry = star.y - cameraY;

            // Wrap around a virtual grid of size width/height
            // This makes the starfield infinite
            const halfW = this.width / 2;
            const halfH = this.height / 2;

            while (rx < -halfW) rx += this.width;
            while (rx > halfW) rx -= this.width;
            while (ry < -halfH) ry += this.height;
            while (ry > halfH) ry -= this.height;

            // Compute screen position (assuming rx, ry are now relative to camera CENTER)
            // rendering handles camera transform, but we are doing manual wrapping.
            // Actually, if we use renderer.withCamera, we just need World Coordinates.
            // But for infinite stars, it's easier to draw them in screen space with an offset.

            // Let's draw in screen space relative to center + parallax offset
            // Actually, simplest 'infinite' background:
            // rx is distance from camera. 
            // screenX = centerX + rx
            // screenY = centerY + ry

            // But we need to support zoom if camera zooms? (Camera doesn't zoom yet).

            const screenX = renderer.width / 2 + rx;
            const screenY = renderer.height / 2 + ry;

            // Cull if off screen
            if (screenX < 0 || screenX > renderer.width || screenY < 0 || screenY > renderer.height) continue;

            ctx.globalAlpha = star.alpha;
            ctx.fillRect(screenX, screenY, star.size, star.size);
        }
        ctx.globalAlpha = 1.0;
    }
}
