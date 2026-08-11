import { normalizeProjectileVisuals } from '../../shared/combat/ProjectileVisuals.js';

const BEAM_TYPES = new Set([
    'laser', 'small_laser', 'railgun', 'saber', 'beam_freeze', 'beam_sword', 'arc_welder'
]);

export function drawProjectile(renderer, projectile) {
    if (projectile.delay > 0) return;

    const color = projectile.owner === 'enemy' ? '#ff4444' : '#26d426';
    const ctx = renderer.ctx;
    const visuals = normalizeProjectileVisuals({
        look: projectile.projectileLook,
        trail: projectile.projectileTrail
    });
    const customVisualsSupported = !BEAM_TYPES.has(projectile.type);
    if (customVisualsSupported && visuals.trail === 'default' && visuals.look !== 'default') {
        drawDefaultProjectileTrail(renderer, projectile);
    } else if (customVisualsSupported && visuals.trail !== 'default') {
        drawProjectileTrail(renderer, projectile, visuals.trail);
    }
    if (customVisualsSupported && visuals.look !== 'default') {
        drawProjectileLook(renderer, projectile, visuals.look, color);
        return;
    }

    if (
        projectile.type === 'laser' ||
        projectile.type === 'small_laser' ||
        projectile.type === 'railgun' ||
        projectile.type === 'saber' ||
        projectile.type === 'beam_freeze' ||
        projectile.type === 'beam_sword' ||
        projectile.type === 'arc_welder'
    ) {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle);

        if (
            projectile.type === 'railgun' ||
            projectile.type === 'saber' ||
            projectile.type === 'beam_freeze'
        ) {
            let lifePct = 1;
            let sizeScale = 1;

            if (projectile.type === 'beam_freeze') {
                sizeScale = 1 + Math.random() * 0.1;
                ctx.globalAlpha = 0.7 + Math.random() * 0.3;
            } else {
                const elapsed = projectile.maxLife - projectile.life;

                if (elapsed < projectile.railStayTime) {
                    const growPct = Math.min(1, elapsed / 0.2);
                    sizeScale = growPct * (1 + Math.random() * 0.2);
                    ctx.globalAlpha = 0.8 + Math.random() * 0.2;
                } else {
                    const fadeTime = projectile.maxLife - projectile.railStayTime;
                    const fadeElapsed = elapsed - projectile.railStayTime;
                    const normalized = 1 - fadeElapsed / fadeTime;
                    lifePct = Math.pow(Math.max(0, normalized), 0.4);

                    if (lifePct < 0.01) lifePct = 0;
                    sizeScale = lifePct;
                    ctx.globalAlpha = lifePct;
                }
            }

            const isSaber = projectile.type === 'saber';
            const isFreeze = projectile.type === 'beam_freeze';
            const mainColor = isSaber ? '#88ffff' : (isFreeze ? '#00ccff' : '#ff4444');
            const glowWidth = (isSaber ? 4 : (isFreeze ? 10 : 12)) * sizeScale;
            const coreWidth = (isSaber ? 1.5 : (isFreeze ? 3 : 4)) * sizeScale;

            renderer.drawRect(0, -glowWidth / 2, projectile.beamLength, glowWidth, mainColor);
            renderer.drawRect(0, -coreWidth / 2, projectile.beamLength, coreWidth, '#ffffff');
        } else if (projectile.type === 'beam_sword' || projectile.type === 'arc_welder') {
            const isSword = projectile.type === 'beam_sword';
            const glowWidth = isSword ? 7 : 5;
            const coreWidth = isSword ? 2 : 1.5;
            const beamColor = isSword ? '#ff6bd6' : '#ffd166';
            renderer.drawRect(0, -glowWidth / 2, projectile.beamLength, glowWidth, beamColor);
            renderer.drawRect(0, -coreWidth / 2, projectile.beamLength, coreWidth, '#fff7d6');
        } else if (projectile.type === 'small_laser') {
            renderer.drawRect(-12.5, -1.5, 25, 3, color);
        } else {
            renderer.drawRect(-15, -2, 30, 4, color);
        }

        ctx.restore();
    } else if (projectile.type === 'proximity_mine') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        const mineColor = projectile.armed ? '#ffdd55' : '#8c8c8c';
        renderer.drawRect(-7, -7, 14, 14, mineColor);
        renderer.drawRect(-3, -3, 6, 6, projectile.armed ? '#fff1a8' : '#444');
        renderer.drawRect(-10, -1, 3, 2, mineColor);
        renderer.drawRect(7, -1, 3, 2, mineColor);
        ctx.restore();
    } else if (projectile.type === 'shrapnel_grenade') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle || 0);
        renderer.drawRect(-6, -6, 12, 12, '#ffd166');
        renderer.drawRect(-3, -3, 6, 6, '#fff1a8');
        renderer.drawRect(4, -2, 5, 4, '#8c5a1f');
        ctx.restore();
    } else if (projectile.type === 'shrapnel_fragment') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle || 0);
        renderer.drawRect(-7, -1, 14, 2, '#ff9f43');
        renderer.drawRect(3, -1, 4, 2, '#fff1a8');
        ctx.restore();
    } else if (projectile.type === 'ricochet_slug') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle || 0);
        renderer.drawRect(-7, -3, 14, 6, '#b7ff5a');
        renderer.drawRect(4, -2, 5, 4, '#efffc4');
        ctx.restore();
    } else if (projectile.type === 'hack_dart') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle || 0);
        renderer.drawRect(-8, -2, 16, 4, '#b77dff');
        renderer.drawRect(5, -4, 5, 8, '#f0ddff');
        renderer.drawRect(-10, -1, 3, 2, '#5d2a9d');
        ctx.restore();
    } else if (projectile.type === 'torpedo') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle || 0);
        renderer.drawRect(-12, -4, 20, 8, '#ff8a3d');
        renderer.drawRect(5, -5, 7, 10, '#ffe0b2');
        renderer.drawRect(-16, -2, 5, 4, '#ffdd55');
        ctx.restore();
    } else if (projectile.type === 'mini_bullet') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle || 0);
        renderer.drawRect(-5, -1, 10, 2, '#9dff6e');
        renderer.drawRect(3, -1, 3, 2, '#efffc4');
        ctx.restore();
    } else if (
        projectile.type === 'rocket' ||
        projectile.type === 'rocket_le' ||
        projectile.type === 'guided_rocket'
    ) {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle);

        const bodyColor = projectile.type === 'guided_rocket'
            ? '#44aaff'
            : (projectile.type === 'rocket_le' ? '#ff0000' : '#ffaa44');
        renderer.drawRect(-10, -3, 20, 6, bodyColor);
        renderer.drawRect(4, -3, 6, 6, '#444');

        if (visuals.trail === 'default') {
            const flameSize = 4 + Math.sin(Date.now() * 0.05) * 2;
            renderer.drawRect(-14, -2, flameSize, 4, '#ffff00');
        }

        ctx.restore();
    } else if (projectile.type === 'rocket_he') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle);

        renderer.drawRect(-10, -3, 20, 6, '#44aaff');
        renderer.drawRect(4, -3, 6, 6, '#224466');

        if (visuals.trail === 'default') {
            const flameSize = 4 + Math.sin(Date.now() * 0.05) * 2;
            renderer.drawRect(-14, -2, flameSize, 4, '#00ccff');
        }

        ctx.restore();
    } else if (projectile.type === 'ggbm') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.angle);

        renderer.drawRect(-8, -4, 16, 8, '#aa00ff');
        renderer.drawRect(4, -4, 4, 8, '#ffffff');

        if (visuals.trail === 'default') {
            const flameSize = 6 + Math.sin(Date.now() * 0.1) * 3;
            renderer.drawRect(-14, -3, flameSize, 6, '#ff00ff');
        }

        ctx.restore();
    } else if (projectile.type === 'mini_grenade') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(Date.now() * 0.015);

        const grenadeColor = projectile.owner === 'enemy' ? '#ff4444' : '#44ff44';
        renderer.drawRect(-4, -4, 8, 8, grenadeColor);
        renderer.drawRect(-2, -2, 4, 4, '#ffffff');

        ctx.restore();
    } else if (projectile.type === 'tiny_grenade') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(Date.now() * 0.02);

        const grenadeColor = projectile.owner === 'enemy' ? '#ff4444' : '#88ff88';
        renderer.drawRect(-2, -2, 4, 4, grenadeColor);
        renderer.drawRect(-1, -1, 2, 2, '#ffffff');

        ctx.restore();
    } else if (projectile.type === 'cluster_grenade') {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.spinAngle || 0);

        const grenadeColor = projectile.owner === 'enemy' ? '#ff4444' : '#26d426';
        renderer.drawRect(-8, -6, 16, 12, grenadeColor);
        renderer.drawRect(-6, -8, 12, 16, grenadeColor);
        renderer.drawRect(-4, -4, 8, 8, '#ffffff');

        ctx.restore();
    } else {
        const size = projectile.radius * 2;
        renderer.drawRect(
            projectile.x - projectile.radius,
            projectile.y - projectile.radius,
            size,
            size,
            color
        );
    }
}

function drawDefaultProjectileTrail(renderer, projectile) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.angle || 0);
    if (projectile.type === 'rocket_he') {
        renderer.drawRect(-14, -2, 6, 4, '#00ccff');
    } else if (projectile.type === 'ggbm') {
        renderer.drawRect(-14, -3, 7, 6, '#ff00ff');
    } else if (projectile.type === 'rocket' || projectile.type === 'rocket_le' || projectile.type === 'guided_rocket') {
        renderer.drawRect(-14, -2, 6, 4, '#ffff00');
    }
    ctx.restore();
}

function drawProjectileTrail(renderer, projectile, trail) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.angle || 0);
    if (trail === 'sparks') {
        renderer.drawRect(-24, -1, 13, 2, '#fff0a6');
        renderer.drawRect(-33, 2, 7, 2, '#ff9d2e');
    } else if (trail === 'smoke') {
        renderer.drawRect(-26, -4, 10, 7, '#87919c');
        renderer.drawRect(-37, -2, 8, 5, '#4b5560');
    } else if (trail === 'ion') {
        renderer.drawRect(-28, -3, 17, 6, '#70f5ff');
        renderer.drawRect(-39, -1, 10, 2, '#e4ffff');
    }
    ctx.restore();
}

function drawProjectileLook(renderer, projectile, look, color) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.angle || 0);
    if (look === 'tracer') {
        renderer.drawRect(-14, -1, 28, 2, color);
        renderer.drawRect(6, -1, 5, 2, '#fff4c2');
    } else if (look === 'heavy-slug') {
        renderer.drawRect(-10, -4, 20, 8, '#d5a36c');
        renderer.drawRect(5, -2, 6, 4, '#fff0c4');
    } else if (look === 'plasma-bolt') {
        renderer.drawRect(-9, -5, 18, 10, '#7e62ff');
        renderer.drawRect(-5, -2, 12, 4, '#e8d9ff');
    } else if (look === 'missile') {
        renderer.drawRect(-11, -3, 21, 6, '#c6d0da');
        renderer.drawRect(8, -2, 5, 4, '#ffcf5c');
    } else if (look === 'needle') {
        renderer.drawRect(-15, -1, 30, 2, '#d8ffff');
        renderer.drawRect(10, -2, 6, 4, '#ffffff');
    }
    ctx.restore();
}
