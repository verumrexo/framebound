import { TILE_SIZE } from './PartDefinitions.js';

export const PART_VISUAL_GEOMETRY_VERSION = 2;

export function isAuthoredPartGeometry(definition) {
    return definition?.visualGeometry?.version === PART_VISUAL_GEOMETRY_VERSION;
}

export function rotateVector(x, y, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: cos * x - sin * y, y: sin * x + cos * y };
}

export function pointOffset(point, grid, scale) {
    if (!point || !grid) return { x: 0, y: 0 };
    return {
        x: (point.x - grid.width / 2) * scale,
        y: (point.y - grid.height / 2) * scale
    };
}

export function getAuthoredTurretMount(definition, partX, partY, baseAngle) {
    const geometry = definition?.visualGeometry;
    if (!geometry) return { x: partX, y: partY };
    const local = pointOffset(
        geometry.baseMount,
        geometry.baseGrid,
        geometry.scale
    );
    const rotated = rotateVector(local.x, local.y, baseAngle);
    return { x: partX + rotated.x, y: partY + rotated.y };
}

export function getAuthoredMuzzlePositions(
    definition,
    partX,
    partY,
    baseAngle,
    aimAngle
) {
    const geometry = definition?.visualGeometry;
    if (!geometry) return [];
    const mount = getAuthoredTurretMount(definition, partX, partY, baseAngle);
    const pivot = geometry.turretPivot || {
        x: geometry.turretGrid.width / 2,
        y: geometry.turretGrid.height / 2
    };
    const muzzles = geometry.muzzles?.length
        ? geometry.muzzles
        : [{ x: geometry.turretGrid.width, y: geometry.turretGrid.height / 2 }];
    return muzzles.map(point => {
        const local = {
            x: (point.x - pivot.x) * geometry.scale,
            y: (point.y - pivot.y) * geometry.scale
        };
        const rotated = rotateVector(local.x, local.y, aimAngle);
        return { x: mount.x + rotated.x, y: mount.y + rotated.y };
    });
}

export function nextAuthoredMuzzle(
    definition,
    partRef,
    partX,
    partY,
    baseAngle,
    aimAngle
) {
    const positions = getAuthoredMuzzlePositions(
        definition,
        partX,
        partY,
        baseAngle,
        aimAngle
    );
    if (!positions.length) return null;
    const index = Math.max(0, Math.trunc(partRef?.muzzleCursor || 0)) % positions.length;
    if (partRef) partRef.muzzleCursor = (index + 1) % positions.length;
    return { ...positions[index], index, positions };
}

export function getPartWorldCenter(game, partRef, definition) {
    const rotated = ((partRef.rotation || 0) % 2) !== 0;
    const width = rotated ? definition.height : definition.width;
    const height = rotated ? definition.width : definition.height;
    const localX = (partRef.x + (width - 1) / 2) * TILE_SIZE;
    const localY = (partRef.y + (height - 1) / 2) * TILE_SIZE;
    const result = rotateVector(localX, localY, game.rotation || 0);
    return {
        x: (game.x || 0) + result.x,
        y: (game.y || 0) + result.y,
        width,
        height,
        baseAngle: (game.rotation || 0) + (partRef.rotation || 0) * Math.PI / 2
    };
}
