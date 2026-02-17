export class Projectile {
    constructor(x, y, angle, type = 'bullet', speed = 600, owner = 'player', damage = 10, lifetime = null, randomGen = null) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.owner = owner;
        this.damage = damage;
        this.life = 2.0; // Seconds
        this.random = randomGen || Math.random;

        if (this.owner === 'enemy') {
            // console.log('[DEBUG] Enemy Projectile:', type, 'at', x, y, 'speed', speed);
        }
        const projSpeed = type === 'laser' ? 1500 : (type === 'small_laser' ? 1800 : (type === 'railgun' || type === 'saber' || type === 'beam_freeze' ? 0 : (type === 'pellet' ? 700 + Math.random() * 200 : (type === 'cluster_grenade' ? 350 : speed))));
        this.vx = Math.cos(angle) * projSpeed;
        this.vy = Math.sin(angle) * projSpeed;
        this.angle = angle;

        this.radius = (type === 'laser' || type === 'small_laser' || type === 'pellet') ? 2 : (type === 'mini_bullet' ? 1.5 : (type === 'railgun' ? 6 : (type === 'saber' ? 3 : 4)));

        // Determine Lifetime
        // Robust check: ensure lifetime is actually a number before using it
        if (typeof lifetime === 'number') {
            this.life = lifetime;
        } else {
            switch (type) {
                case 'railgun': this.life = 2.4; break;
                case 'saber': this.life = 1.6; break;
                case 'beam_freeze': this.life = 0.05; break;
                case 'rocket':
                case 'rocket_le':
                case 'rocket_he':
                case 'guided_rocket': this.life = 3.0; break;
                case 'cluster_grenade': this.life = 1.8; break;
                case 'mini_grenade': this.life = 1.0; break;
                case 'tiny_grenade': this.life = 0.5; break;
                case 'ggbm': this.life = 3.0; break;
                default: this.life = 60.0; break;
            }
        }

        // Safety Override for Beams
        if (type === 'beam_freeze') this.life = 0.05;

        this.maxLife = this.life;
        this.railStayTime = (type === 'railgun') ? 1.1 : ((type === 'saber') ? 0.6 : 0);
        this.isDead = false;
        this.delay = 0;

        // Beam properties
        if (this.type === 'railgun' || this.type === 'saber' || this.type === 'beam_freeze') {
            this.isBeam = true;
            this.beamLength = (this.type === 'beam_freeze') ? 600 : 3000; // Full range for railgun/saber
            this.targetHits = new Map(); // Track target -> lastHitTime for multi-hit beams
        }

        // Custom variables for erratic movement
        if (this.type === 'rocket' || this.type === 'rocket_le' || this.type === 'rocket_he' || this.type === 'guided_rocket' || this.type === 'ggbm' || this.type === 'cluster_grenade') {
            this.wavyTime = Math.random() * 100;
            this.wavySpeed = 4 + Math.random() * 2;
            this.wavyAmp = (this.type === 'rocket' || this.type === 'rocket_le' || this.type === 'rocket_he') ? (0.2 + Math.random() * 0.15) : (this.type === 'cluster_grenade' ? 0.15 : 0.08);
            this.baseAngle = angle;
            this.speed = projSpeed * (this.type === 'ggbm' ? 0.7 : (this.type === 'cluster_grenade' ? 0.6 : 1.0));
            // Add a permanent random "drift" to each rocket's base trajectory
            this.driftDirection = (Math.random() - 0.5) * 0.4; // Radians per second drift
            this.secondaryWavySpeed = 6 + Math.random() * 4;
            this.secondaryWavyAmp = this.wavyAmp * 0.5;

            if (this.type === 'guided_rocket' || this.type === 'ggbm') {
                this.homingStrength = this.type === 'ggbm' ? 4.0 : 2.5; // Turn rate in rad/s
            }

            // Cluster grenade spin
            if (this.type === 'cluster_grenade') {
                this.spinAngle = 0;
                this.clusterCount = 10; // Number of child grenades
            }
        }
    }

    update(dt, game) {
        if (this.delay > 0) {
            this.delay -= dt;
            return;
        }

        if (this.type === 'rocket' || this.type === 'rocket_le' || this.type === 'rocket_he' || this.type === 'guided_rocket' || this.type === 'ggbm' || this.type === 'cluster_grenade') {
            if ((this.type === 'guided_rocket' || this.type === 'ggbm') && game && this.owner === 'player') {
                // Find nearest enemy or boss
                let nearest = null;
                let minDist = 2000; // Increased range

                // Check enemies (no array allocation)
                for (const enemy of (game.enemies || [])) {
                    if (enemy.isDead) continue;
                    const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = enemy;
                    }
                }

                // Check bosses (no array allocation)
                for (const boss of (game.bosses || [])) {
                    if (boss.isDead) continue;
                    const dist = Math.hypot(boss.x - this.x, boss.y - this.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = boss;
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

        // Spin for cluster grenades
        if (this.type === 'cluster_grenade') {
            this.spinAngle += dt * 10; // Spin fast
        }

        if (this.life <= 0) {
            this.isDead = true;
            if (this.type === 'rocket' || this.type === 'rocket_le' || this.type === 'rocket_he' || this.type === 'guided_rocket' || this.type === 'ggbm' || this.type === 'cluster_grenade' || this.type === 'mini_grenade' || this.type === 'tiny_grenade') this.shouldExplode = true;
        }
    }

}
