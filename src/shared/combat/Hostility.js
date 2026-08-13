export function isHostileTo(source, target) {
    if (!target || target.isDead || target.hp <= 0) return false;
    if (target.hackTimer > 0 && target.hackedByPlayerId) {
        return false;
    }
    if (target.owner === 'player' || target.ownerPlayerId) {
        return false;
    }
    return true;
}

export function nearestHostile(source, candidates, originX, originY, maximumRange = Infinity) {
    let result = null;
    let bestDistanceSq = maximumRange * maximumRange;
    for (const target of candidates || []) {
        if (!isHostileTo(source, target)) continue;
        if (target.spotted === false || target.stealthTimer > 0) continue;
        const dx = target.x - originX;
        const dy = target.y - originY;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > bestDistanceSq) continue;
        bestDistanceSq = distanceSq;
        result = target;
    }
    return result;
}
