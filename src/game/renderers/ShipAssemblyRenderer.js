import { TILE_SIZE } from '../../shared/parts/Part.js';
import {
    getAssemblyCache,
    getValidatedAssemblyParts,
    SHIP_ASSEMBLY_PROFILES
} from './ShipAssemblyCache.js';
import {
    getAuthoredMuzzlePositions,
    isAuthoredPartGeometry,
    pointOffset,
    rotateVector
} from '../../shared/parts/PartVisualGeometry.js';

export function getShipAssemblyParts(partRefs, partsLibrary) {
    return getValidatedAssemblyParts(partRefs, partsLibrary);
}

export function drawShipAssembly(ctx, entity, parts, {
    rotation = entity.rotation || 0,
    visualTint = null,
    profile = SHIP_ASSEMBLY_PROFILES.player
} = {}) {
    const cache = getAssemblyCache(entity, parts, visualTint, profile);
    if (!cache) return null;

    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(rotation);
    ctx.drawImage(cache.canvas, cache.minX, cache.minY);
    ctx.restore();
    return cache;
}

export function localToWorld(entity, localX, localY, rotation = entity.rotation || 0) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
        x: entity.x + localX * cos - localY * sin,
        y: entity.y + localX * sin + localY * cos
    };
}

export function getMountedTurretPosition(part, baseAngle, aimAngle, recoil = 0, {
    numericOffsetAngle = aimAngle,
    includeBaseAnchor = true
} = {}) {
    let offsetX = 0;
    let offsetY = 0;
    if (isAuthoredPartGeometry(part.def)) {
        const geometry = part.def.visualGeometry;
        const local = pointOffset(
            geometry.baseMount,
            geometry.baseGrid,
            geometry.scale
        );
        const mounted = rotateVector(local.x, local.y, baseAngle);
        offsetX = mounted.x;
        offsetY = mounted.y;
        if (recoil) {
            offsetX -= Math.cos(aimAngle) * recoil;
            offsetY -= Math.sin(aimAngle) * recoil;
        }
        return { offsetX, offsetY };
    }
    const offset = part.def.turretDrawOffset;
    if (offset) {
        if (typeof offset === 'object') {
            const ox = offset.x || 0;
            const oy = offset.y || 0;
            offsetX = Math.cos(baseAngle) * ox - Math.sin(baseAngle) * oy;
            offsetY = Math.sin(baseAngle) * ox + Math.cos(baseAngle) * oy;
        } else {
            offsetX = Math.cos(numericOffsetAngle) * offset;
            offsetY = Math.sin(numericOffsetAngle) * offset;
        }
    }

    if (recoil) {
        offsetX -= Math.cos(aimAngle) * recoil;
        offsetY -= Math.sin(aimAngle) * recoil;
    }

    const baseSprite = part.def.baseSprite;
    if (includeBaseAnchor && baseSprite &&
        (baseSprite.anchorX !== 0.5 || baseSprite.anchorY !== 0.5)) {
        const pivotX = (baseSprite.anchorX - 0.5) * baseSprite.width * baseSprite.scale;
        const pivotY = (baseSprite.anchorY - 0.5) * baseSprite.height * baseSprite.scale;
        offsetX += Math.cos(baseAngle) * pivotX - Math.sin(baseAngle) * pivotY;
        offsetY += Math.sin(baseAngle) * pivotX + Math.cos(baseAngle) * pivotY;
    }

    return { offsetX, offsetY };
}

export function getChargeTip(part, x, y, aimAngle) {
    if (isAuthoredPartGeometry(part.def)) {
        const baseAngle = Number.isFinite(part.baseAngle)
            ? part.baseAngle
            : (part.rotation || 0) * Math.PI / 2;
        const muzzle = getAuthoredMuzzlePositions(
            part.def,
            x,
            y,
            baseAngle,
            aimAngle
        )[0];
        if (muzzle) return muzzle;
    }
    let barrelLength = part.height > 1.5 ? TILE_SIZE * 1.3 : TILE_SIZE * 0.6;
    barrelLength += typeof part.def.turretDrawOffset === 'number'
        ? part.def.turretDrawOffset
        : 0;
    return {
        x: x + Math.cos(aimAngle) * barrelLength,
        y: y + Math.sin(aimAngle) * barrelLength
    };
}
