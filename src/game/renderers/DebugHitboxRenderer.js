import { PartsLibrary, TILE_SIZE } from '../../shared/parts/Part.js';

export function drawDebugHitboxes(game, shipCos, shipSin) {
    if (!game.devTools || !game.devTools.showHitboxes) return;

    const ctx = game.renderer.ctx;
    ctx.save();
    ctx.lineWidth = 2;

    const drawRotatedRect = (cx, cy, w, h, angle) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
    };

    ctx.strokeStyle = '#ff0000';
    for (const enemy of game.enemies) {
        if (enemy.isDead) continue;
        if (enemy.shipParts && enemy.shipParts.length > 0) {
            const sAngle = enemy.rotation + (enemy.rotationOffset || 0);
            const sCos = Math.cos(sAngle);
            const sSin = Math.sin(sAngle);
            for (const part of enemy.shipParts) {
                const def = PartsLibrary[part.partId];
                if (!def) continue;
                const isRot = ((part.rotation || 0) % 2 !== 0);
                const w = (isRot ? def.height : def.width) * TILE_SIZE;
                const h = (isRot ? def.width : def.height) * TILE_SIZE;
                const lx = (part.x + (isRot ? def.height : def.width) / 2 - 0.5) * TILE_SIZE;
                const ly = (part.y + (isRot ? def.width : def.height) / 2 - 0.5) * TILE_SIZE;
                drawRotatedRect(
                    enemy.x + (lx * sCos - ly * sSin),
                    enemy.y + (lx * sSin + ly * sCos),
                    w,
                    h,
                    sAngle
                );
            }
        } else {
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius || 20, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.strokeStyle = '#ff8800';
    for (const boss of game.bosses) {
        if (boss.isDead) continue;
        if (boss.shipParts && boss.shipParts.length > 0) {
            const sAngle = boss.rotation + (boss.rotationOffset || 0);
            const sCos = Math.cos(sAngle);
            const sSin = Math.sin(sAngle);
            for (const part of boss.shipParts) {
                const def = PartsLibrary[part.partId];
                if (!def) continue;
                const isRot = ((part.rotation || 0) % 2 !== 0);
                const w = (isRot ? def.height : def.width) * TILE_SIZE;
                const h = (isRot ? def.width : def.height) * TILE_SIZE;
                const lx = (part.x + (isRot ? def.height : def.width) / 2 - 0.5) * TILE_SIZE;
                const ly = (part.y + (isRot ? def.width : def.height) / 2 - 0.5) * TILE_SIZE;
                drawRotatedRect(
                    boss.x + (lx * sCos - ly * sSin),
                    boss.y + (lx * sSin + ly * sCos),
                    w,
                    h,
                    sAngle
                );
            }
        } else {
            ctx.beginPath();
            ctx.arc(boss.x, boss.y, boss.radius || 60, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    for (const drone of game.drones) {
        if (drone.isDead) continue;
        ctx.strokeStyle = drone.owner === 'player' ? '#00ffff' : '#ff00ff';
        const size = (drone.radius || 8) * 2;
        drawRotatedRect(drone.x, drone.y, size, size, drone.rotation);
    }

    ctx.strokeStyle = '#00ff00';
    for (const part of game.playerShip.getUniqueParts()) {
        const def = PartsLibrary[part.partId];
        if (!def) continue;
        const isRot = ((part.rotation || 0) % 2 !== 0);
        const w = (isRot ? def.height : def.width) * TILE_SIZE;
        const h = (isRot ? def.width : def.height) * TILE_SIZE;
        const lx = (part.x + (isRot ? def.height : def.width) / 2 - 0.5) * TILE_SIZE;
        const ly = (part.y + (isRot ? def.width : def.height) / 2 - 0.5) * TILE_SIZE;
        drawRotatedRect(
            game.x + (lx * shipCos - ly * shipSin),
            game.y + (lx * shipSin + ly * shipCos),
            w,
            h,
            game.rotation
        );
    }

    ctx.restore();
}
