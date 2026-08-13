import { Enemy } from '../../shared/entities/Enemy.js';
import { Projectile } from '../../shared/entities/Projectile.js';
import { EntityRenderer } from '../renderers/EntityRenderer.js';
import { drawProjectile } from '../renderers/ProjectileRenderer.js';

export class EnemyLabSimulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.renderer = {
            ctx: this.ctx,
            drawRect: (x, y, width, height, color) => {
                this.ctx.fillStyle = color;
                this.ctx.fillRect(x, y, width, height);
            }
        };
        this.speed = 1;
        this.paused = false;
        this.group = false;
        this.invincible = true;
        this.overlays = true;
        this.lastTime = 0;
        this.frame = null;
        this.running = false;
    }

    start(blueprint) {
        this.blueprint = structuredClone(blueprint);
        this.reset();
        this.running = true;
        this.lastTime = performance.now();
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(time => this.tick(time));
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.frame);
    }

    reset() {
        this.projectiles = [];
        this.time = 0;
        this.playerShot = 0;
        this.player = { x: this.canvas.width * 0.67, y: this.canvas.height * 0.5, vx: 0, vy: 0, hp: 1000, maxHp: 1000 };
        const count = this.group ? 3 : 1;
        this.enemies = Array.from({ length: count }, (_, index) => {
            const enemy = new Enemy(
                this.canvas.width * 0.28,
                this.canvas.height * (0.5 + (index - (count - 1) / 2) * 0.18),
                this.blueprint.id,
                1,
                seededRandom(index + 41),
                `lab_${index}`,
                { blueprint: this.blueprint, allowDraft: true }
            );
            enemy.warpTimer = 0;
            enemy.isWarpingIn = false;
            return enemy;
        });
    }

    tick(time) {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000)) * this.speed;
        this.lastTime = time;
        if (!this.paused) this.update(dt);
        this.draw();
        this.frame = requestAnimationFrame(next => this.tick(next));
    }

    update(dt) {
        this.time += dt;
        const centerX = this.canvas.width * 0.65;
        const centerY = this.canvas.height * 0.5;
        const nextX = centerX + Math.cos(this.time * 0.45) * 90;
        const nextY = centerY + Math.sin(this.time * 0.45) * 90;
        this.player.vx = (nextX - this.player.x) / Math.max(dt, 0.001);
        this.player.vy = (nextY - this.player.y) / Math.max(dt, 0.001);
        this.player.x = nextX;
        this.player.y = nextY;
        for (const enemy of this.enemies) {
            enemy.update(dt, this.player.x, this.player.y, this.projectiles, [], [], this.enemies, {
                x: 12, y: 12, width: this.canvas.width - 24, height: this.canvas.height - 24
            }, this.player);
        }
        this.playerShot -= dt;
        const living = this.enemies.find(enemy => !enemy.isDead);
        if (living && this.playerShot <= 0) {
            const angle = Math.atan2(living.y - this.player.y, living.x - this.player.x);
            this.projectiles.push(new Projectile(this.player.x, this.player.y, angle, 'bullet', 400, 'player', 5, 3));
            this.playerShot = 2;
        }
        for (const projectile of this.projectiles) {
            projectile.update(dt, { projectiles: this.projectiles });
            if (projectile.owner === 'player') {
                for (const enemy of this.enemies) {
                    if (!enemy.isDead && enemy.checkPartHit(projectile.x, projectile.y, projectile.radius || 4).hit) {
                        enemy.takeDamage(projectile.damage || 5, projectile.type);
                        projectile.isDead = true;
                    }
                }
            } else if (!this.invincible && Math.hypot(projectile.x - this.player.x, projectile.y - this.player.y) < 18) {
                this.player.hp -= projectile.damage || 5;
                projectile.isDead = true;
            }
        }
        this.projectiles = this.projectiles.filter(projectile => !projectile.isDead && projectile.life > 0);
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#05090d';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.strokeStyle = 'rgba(80, 220, 255, .07)';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 32) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 32) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
        }
        ctx.save();
        ctx.translate(this.player.x, this.player.y);
        ctx.strokeStyle = '#65fbd2';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -8); ctx.lineTo(-6, 0); ctx.lineTo(-10, 8); ctx.closePath(); ctx.stroke();
        ctx.restore();
        for (const enemy of this.enemies) {
            EntityRenderer.drawEnemy(this.renderer, enemy);
            if (this.overlays) this.drawIntent(enemy);
        }
        for (const projectile of this.projectiles) drawProjectile(this.renderer, projectile);
    }

    drawIntent(enemy) {
        const ctx = this.ctx;
        const behavior = enemy.behaviorProfile;
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(255, 120, 120, .22)';
        ctx.beginPath(); ctx.arc(this.player.x, this.player.y, behavior.preferredMinRange, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(this.player.x, this.player.y, behavior.preferredMaxRange, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(this.player.x, this.player.y); ctx.stroke();
        const steer = enemy.tacticalState?.steering || { x: 0, y: 0 };
        ctx.strokeStyle = '#ff9f77';
        ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.x + steer.x * 45, enemy.y + steer.y * 45); ctx.stroke();
        ctx.fillStyle = '#ffd7cc';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(enemy.tacticalState?.intent || 'idle', enemy.x + 14, enemy.y - 18);
        ctx.restore();
    }
}

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}
