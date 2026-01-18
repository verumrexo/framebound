export class Projectile {
    constructor(x, y, angle, type = 'bullet', speed = 600, owner = 'player', damage = 10) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.owner = owner;
        this.damage = damage;

        const projSpeed = type === 'laser' ? 1500 : (type === 'small_laser' ? 1800 : (type === 'railgun' || type === 'saber' ? 0 : (type === 'pellet' ? 700 + Math.random() * 200 : speed)));
        this.vx = Math.cos(angle) * projSpeed;
        this.vy = Math.sin(angle) * projSpeed;
        this.angle = angle;

        this.radius = (type === 'laser' || type === 'small_laser' || type === 'pellet') ? 2 : (type === 'mini_bullet' ? 1.5 : (type === 'railgun' ? 6 : (type === 'saber' ? 3 : 4)));
        this.life = (type === 'railgun') ? 2.4 : ((type === 'saber') ? 1.6 : 60.0);
        this.maxLife = this.life;
        this.railStayTime = (type === 'railgun') ? 1.1 : ((type === 'saber') ? 0.6 : 0);
        this.isDead = false;
        this.delay = 0;

        // Beam properties
        if (this.type === 'railgun' || this.type === 'saber') {
            this.isBeam = true;
            this.beamLength = 3000;
            this.targetHits = new Map(); // Track target -> lastHitTime for multi-hit beams
        }

        // Custom variables for erratic movement
        if (this.type === 'rocket' || this.type === 'guided_rocket' || this.type === 'ggbm') {
            this.wavyTime = Math.random() * 100;
            this.wavySpeed = 4 + Math.random() * 2;
            this.wavyAmp = this.type === 'rocket' ? (0.2 + Math.random() * 0.15) : 0.08; // Guided is less wobbly
            this.baseAngle = angle;
            this.speed = projSpeed * (this.type === 'ggbm' ? 0.7 : 1.0); // GGBM is slower
            // Add a permanent random "drift" to each rocket's base trajectory
            this.driftDirection = (Math.random() - 0.5) * 0.4; // Radians per second drift
            this.secondaryWavySpeed = 6 + Math.random() * 4;
            this.secondaryWavyAmp = this.wavyAmp * 0.5;

            if (this.type === 'guided_rocket' || this.type === 'ggbm') {
                this.homingStrength = this.type === 'ggbm' ? 4.0 : 2.5; // Turn rate in rad/s
            }
        }
    }

    update(dt, game) {
        if (this.delay > 0) {
            this.delay -= dt;
            return;
        }

        if (this.type === 'rocket' || this.type === 'guided_rocket' || this.type === 'ggbm') {
            if ((this.type === 'guided_rocket' || this.type === 'ggbm') && game && this.owner === 'player') {
                // Find nearest enemy or boss
                let nearest = null;
                let minDist = 2000; // Increased range

                // Targets: Enemies and Bosses
                const targets = [...(game.enemies || []), ...(game.bosses || [])];

                for (const target of targets) {
                    if (target.isDead) continue;
                    const dist = Math.hypot(target.x - this.x, target.y - this.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = target;
                    }
                }

                if (nearest) {
                    const targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                    let diff = targetAngle - this.baseAngle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    const step = this.homingStrength * dt;
                    if (Math.abs(diff) < step) {
                        this.baseAngle = targetAngle;
                    } else {
                        this.baseAngle += Math.sign(diff) * step;
                    }
                }
            }

            this.wavyTime += dt * this.wavySpeed;

            // Apply drift to the base course
            this.baseAngle += this.driftDirection * dt;

            // Layered noise for more erratic movement
            const wave1 = Math.sin(this.wavyTime) * this.wavyAmp;
            const wave2 = Math.cos(this.wavyTime * 1.73) * this.secondaryWavyAmp; // Irregular ratio

            this.angle = (this.baseAngle || 0) + wave1 + wave2;

            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) {
            this.isDead = true;
            if (this.type === 'rocket') this.shouldExplode = true;
        }
    }

    draw(renderer) {
        if (this.delay > 0) return;
        const color = this.owner === 'enemy' ? '#ff4444' : '#26d426';

        if (this.type === 'laser' || this.type === 'small_laser' || this.type === 'railgun' || this.type === 'saber') {
            // Long thin beam
            renderer.ctx.save();
            renderer.ctx.translate(this.x, this.y);
            renderer.ctx.rotate(this.angle);

            if (this.type === 'railgun' || this.type === 'saber') {
                // Thicker, brighter white/cyan beam for railgun (thinner for saber)
                let lifePct = 1.0;
                let sizeScale = 1.0;
                const elapsed = this.maxLife - this.life;

                if (elapsed < this.railStayTime) {
                    // Growth / Jitter phase
                    const growPct = Math.min(1.0, elapsed / 0.2);
                    sizeScale = growPct * (1.0 + Math.random() * 0.2); // Jitter
                    renderer.ctx.globalAlpha = 0.8 + Math.random() * 0.2; // Flicker
                } else {
                    // Non-linear fade
                    const fadeTime = this.maxLife - this.railStayTime;
                    const fadeElapsed = elapsed - this.railStayTime;
                    const normalized = 1.0 - (fadeElapsed / fadeTime); // 1.0 to 0.0
                    lifePct = Math.pow(Math.max(0, normalized), 0.4);

                    if (lifePct < 0.01) lifePct = 0;
                    sizeScale = lifePct;
                    renderer.ctx.globalAlpha = lifePct;
                }

                const isSaber = this.type === 'saber';
                const mainColor = isSaber ? '#88ffff' : '#00ffff';
                const coreColor = '#ffffff';
                const glowWidth = (isSaber ? 4 : 12) * sizeScale;
                const coreWidth = (isSaber ? 1.5 : 4) * sizeScale;

                renderer.drawRect(0, -glowWidth / 2, this.beamLength, glowWidth, mainColor);
                renderer.drawRect(0, -coreWidth / 2, this.beamLength, coreWidth, coreColor);
            } else if (this.type === 'small_laser') {
                renderer.drawRect(-12.5, -1.5, 25, 3, color);
            } else {
                renderer.drawRect(-15, -2, 30, 4, color);
            }
            renderer.ctx.restore();
        } else if (this.type === 'rocket' || this.type === 'guided_rocket') {
            // Rocket Visual
            renderer.ctx.save();
            renderer.ctx.translate(this.x, this.y);
            renderer.ctx.rotate(this.angle);

            // Body
            const bodyColor = this.type === 'guided_rocket' ? '#44aaff' : '#ffaa44';
            renderer.drawRect(-10, -3, 20, 6, bodyColor);
            renderer.drawRect(4, -3, 6, 6, '#444');      // Nose cone

            // Thrust/Flame
            const flameSize = 4 + Math.sin(Date.now() * 0.05) * 2;
            renderer.drawRect(-14, -2, flameSize, 4, '#ffff00');

            renderer.ctx.restore();
        } else if (this.type === 'ggbm') {
            // GGBM Visual
            renderer.ctx.save();
            renderer.ctx.translate(this.x, this.y);
            renderer.ctx.rotate(this.angle);

            // Purple glowing missile
            renderer.drawRect(-8, -4, 16, 8, '#aa00ff');
            renderer.drawRect(4, -4, 4, 8, '#ffffff');

            // Thrust
            const flameSize = 6 + Math.sin(Date.now() * 0.1) * 3;
            renderer.drawRect(-14, -3, flameSize, 6, '#ff00ff');

            renderer.ctx.restore();
        } else {
            // Draw centered square
            const size = this.radius * 2;
            renderer.drawRect(this.x - this.radius, this.y - this.radius, size, size, color);
        }
    }
}
