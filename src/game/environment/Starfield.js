/**
 * Starfield - Dynamic space background with parallax layers
 * Features: Multi-layer stars, black holes, nebulae, shooting stars, distant planets
 */
export class Starfield {
    constructor(width = 4000, height = 4000, random = Math.random) {
        this.width = width;
        this.height = height;
        this.random = random;
        this.color = '#fff';
        this.time = 0;

        // Generate all elements
        this.starLayers = this.generateStarLayers();
        this.starClusters = this.generateStarClusters();

        this.planets = this.generatePlanets();
        this.shootingStars = [];
        this.shootingStarTimer = this.random() * 10 + 5; // 5-15s initial delay
    }

    generateStarLayers() {
        const layers = [];
        const configs = [
            { count: 150, parallax: 0.3, sizeRange: [1, 1], alphaRange: [0.15, 0.25], twinkleChance: 0.1 }, // Far
            { count: 100, parallax: 0.6, sizeRange: [1, 2], alphaRange: [0.2, 0.35], twinkleChance: 0.15 }, // Mid
            { count: 60, parallax: 1.0, sizeRange: [1, 3], alphaRange: [0.3, 0.5], twinkleChance: 0.2 }   // Near
        ];

        const starColors = ['#ffffff', '#ffffff', '#ffffff', '#aaccff', '#ffffaa']; // Mostly white, some blue/yellow

        for (const cfg of configs) {
            const stars = [];
            for (let i = 0; i < cfg.count; i++) {
                stars.push({
                    x: (this.random() - 0.5) * this.width,
                    y: (this.random() - 0.5) * this.height,
                    size: cfg.sizeRange[0] + Math.floor(this.random() * (cfg.sizeRange[1] - cfg.sizeRange[0] + 1)),
                    baseAlpha: cfg.alphaRange[0] + this.random() * (cfg.alphaRange[1] - cfg.alphaRange[0]),
                    twinkle: this.random() < cfg.twinkleChance,
                    twinkleOffset: this.random() * Math.PI * 2,
                    color: starColors[Math.floor(this.random() * starColors.length)]
                });
            }
            layers.push({ stars, parallax: cfg.parallax });
        }
        return layers;
    }

    generateStarClusters() {
        const clusters = [];
        const count = 3 + Math.floor(this.random() * 3); // 3-5 clusters

        for (let i = 0; i < count; i++) {
            const clusterX = (this.random() - 0.5) * this.width;
            const clusterY = (this.random() - 0.5) * this.height;
            const clusterRadius = 150 + this.random() * 200; // Size of cluster
            const starCount = 30 + Math.floor(this.random() * 40); // 30-70 stars per cluster

            const stars = [];
            for (let j = 0; j < starCount; j++) {
                // Gaussian-ish distribution - more stars near center
                const angle = this.random() * Math.PI * 2;
                const dist = this.random() * this.random() * clusterRadius; // Squared for density falloff
                stars.push({
                    x: clusterX + Math.cos(angle) * dist,
                    y: clusterY + Math.sin(angle) * dist,
                    size: 1,
                    alpha: 0.2 + this.random() * 0.3,
                    twinkle: this.random() < 0.3,
                    twinkleOffset: this.random() * Math.PI * 2
                });
            }

            clusters.push({
                x: clusterX,
                y: clusterY,
                stars: stars,
                parallax: 0.25
            });
        }
        return clusters;
    }


    generatePlanets() {
        const planets = [];
        const count = 1 + Math.floor(this.random() * 3); // 1-3

        const planetTypes = [
            { baseColor: '#2a1508', shadowColor: '#110a04', name: 'rocky' },      // Dark brown rocky
            { baseColor: '#3a2510', shadowColor: '#1a1008', name: 'desert' },     // Dark desert
            { baseColor: '#152040', shadowColor: '#0a1020', name: 'ice' },        // Dark icy blue
            { baseColor: '#3a2000', shadowColor: '#1a1000', name: 'gas', rings: true }, // Dark gas giant with rings
            { baseColor: '#2a2015', shadowColor: '#15100a', name: 'gas2', rings: true } // Dark Saturn-like
        ];

        for (let i = 0; i < count; i++) {
            const type = planetTypes[Math.floor(this.random() * planetTypes.length)];
            planets.push({
                x: (this.random() - 0.5) * this.width,
                y: (this.random() - 0.5) * this.height,
                radius: 150 + this.random() * 250,
                ...type,
                parallax: 0.15,
                alpha: 1.0 // Fully opaque now
            });
        }
        return planets;
    }

    setColor(color) {
        this.color = color;
    }

    update(dt) {
        this.time += dt;

        // Shooting star spawning
        this.shootingStarTimer -= dt;
        if (this.shootingStarTimer <= 0) {
            this.spawnShootingStar();
            this.shootingStarTimer = 5 + this.random() * 15; // 5-20s
        }

        // Update shooting stars
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const star = this.shootingStars[i];
            star.life -= dt;
            star.x += star.vx * dt;
            star.y += star.vy * dt;
            if (star.life <= 0) {
                this.shootingStars.splice(i, 1);
            }
        }
    }

    spawnShootingStar() {
        const angle = -Math.PI / 4 + (this.random() - 0.5) * 0.5; // Mostly diagonal
        const speed = 800 + this.random() * 400;
        this.shootingStars.push({
            x: (this.random() - 0.5) * this.width,
            y: (this.random() - 0.5) * this.height,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            length: 60 + this.random() * 40,
            life: 0.8 + this.random() * 0.4,
            maxLife: 0.8 + this.random() * 0.4
        });
    }

    // Convert world pos to screen with parallax
    toScreen(wx, wy, cameraX, cameraY, parallax, renderer) {
        const rx = (wx - cameraX * parallax);
        const ry = (wy - cameraY * parallax);

        // Wrap for infinite feel
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        let wrappedX = rx;
        let wrappedY = ry;

        while (wrappedX < -halfW) wrappedX += this.width;
        while (wrappedX > halfW) wrappedX -= this.width;
        while (wrappedY < -halfH) wrappedY += this.height;
        while (wrappedY > halfH) wrappedY -= this.height;

        return {
            x: renderer.width / 2 + wrappedX,
            y: renderer.height / 2 + wrappedY
        };
    }

    draw(renderer, cameraX, cameraY) {
        const ctx = renderer.ctx;

        // Update animation
        this.update(1 / 60); // Assume 60fps for simplicity

        // 1. Draw Star Clusters (furthest back)
        for (const cluster of this.starClusters) {
            for (const star of cluster.stars) {
                const pos = this.toScreen(star.x, star.y, cameraX, cameraY, cluster.parallax, renderer);

                // Cull off-screen
                if (pos.x < -5 || pos.x > renderer.width + 5 ||
                    pos.y < -5 || pos.y > renderer.height + 5) continue;

                let alpha = star.alpha;
                if (star.twinkle) {
                    alpha += Math.sin(this.time * 2 + star.twinkleOffset) * 0.1;
                    alpha = Math.max(0.1, Math.min(0.5, alpha));
                }

                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(pos.x, pos.y, star.size, star.size);
            }
        }
        ctx.globalAlpha = 1.0;

        // 2. Draw Star Layers (behind planets)
        for (const layer of this.starLayers) {
            for (const star of layer.stars) {
                const pos = this.toScreen(star.x, star.y, cameraX, cameraY, layer.parallax, renderer);

                // Cull off-screen
                if (pos.x < -10 || pos.x > renderer.width + 10 ||
                    pos.y < -10 || pos.y > renderer.height + 10) continue;

                let alpha = star.baseAlpha;
                if (star.twinkle) {
                    alpha += Math.sin(this.time * 3 + star.twinkleOffset) * 0.15;
                    alpha = Math.max(0.05, Math.min(0.6, alpha));
                }

                ctx.globalAlpha = alpha;
                ctx.fillStyle = star.color;
                ctx.fillRect(pos.x, pos.y, star.size, star.size);
            }
        }
        ctx.globalAlpha = 1.0;

        // 3. Draw Planets (with rings)
        for (const planet of this.planets) {
            const pos = this.toScreen(planet.x, planet.y, cameraX, cameraY, planet.parallax, renderer);

            if (pos.x < -planet.radius * 2 || pos.x > renderer.width + planet.radius * 2 ||
                pos.y < -planet.radius * 2 || pos.y > renderer.height + planet.radius * 2) continue;

            ctx.save();
            ctx.globalAlpha = planet.alpha;

            const ringAngle = -0.3; // tilt angle
            const ringWidth = planet.radius * 1.6;
            const ringHeight = planet.radius * 0.3;

            // Back half of ring (behind planet)
            if (planet.rings) {
                ctx.strokeStyle = 'rgba(120, 100, 80, 0.15)';
                ctx.lineWidth = planet.radius * 0.12;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, ringWidth, ringHeight, ringAngle, 0, Math.PI);
                ctx.stroke();
            }

            // Planet body
            const gradient = ctx.createLinearGradient(
                pos.x - planet.radius, pos.y - planet.radius,
                pos.x + planet.radius, pos.y + planet.radius
            );
            gradient.addColorStop(0, planet.baseColor);
            gradient.addColorStop(0.6, planet.baseColor);
            gradient.addColorStop(1, planet.shadowColor);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, planet.radius, 0, Math.PI * 2);
            ctx.fill();

            // Front half of ring (in front of planet)
            if (planet.rings) {
                ctx.strokeStyle = 'rgba(120, 100, 80, 0.15)';
                ctx.lineWidth = planet.radius * 0.12;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, ringWidth, ringHeight, ringAngle, Math.PI, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }

        // 4. Draw Shooting Stars
        for (const star of this.shootingStars) {
            const lifeRatio = star.life / star.maxLife;
            const alpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : (lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1);

            const pos = this.toScreen(star.x, star.y, cameraX, cameraY, 0.8, renderer);

            // Tail direction
            const angle = Math.atan2(star.vy, star.vx);
            const tailX = pos.x - Math.cos(angle) * star.length;
            const tailY = pos.y - Math.sin(angle) * star.length;

            const gradient = ctx.createLinearGradient(tailX, tailY, pos.x, pos.y);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.8})`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            // Bright head
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
