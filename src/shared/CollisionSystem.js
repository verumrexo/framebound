/**
 * CollisionSystem.js - Unified collision detection API
 * Standardizes all collision math patterns used throughout the game
 */

export const Collision = {
    /**
     * Circle vs Circle collision check
     * @returns {boolean} true if colliding
     */
    circleCircle(ax, ay, ar, bx, by, br) {
        const dx = bx - ax;
        const dy = by - ay;
        const distSq = dx * dx + dy * dy;
        const minDist = ar + br;
        return distSq < minDist * minDist;
    },

    /**
     * Circle vs Circle with distance info
     * @returns {{ hit: boolean, dx: number, dy: number, dist: number, overlap: number }}
     */
    circleCircleInfo(ax, ay, ar, bx, by, br) {
        const dx = bx - ax;
        const dy = by - ay;
        const distSq = dx * dx + dy * dy;
        const minDist = ar + br;
        const hit = distSq < minDist * minDist;
        const dist = Math.sqrt(distSq);
        return {
            hit,
            dx,
            dy,
            dist,
            overlap: hit ? minDist - dist : 0
        };
    },

    /**
     * Point inside Oriented Bounding Box (OBB)
     * @param {number} px - Point x
     * @param {number} py - Point y
     * @param {number} cx - Box center x
     * @param {number} cy - Box center y
     * @param {number} hw - Half width
     * @param {number} hh - Half height
     * @param {number} angle - Box rotation in radians
     * @returns {boolean}
     */
    pointInOBB(px, py, cx, cy, hw, hh, angle) {
        // Transform point to box's local space
        const dx = px - cx;
        const dy = py - cy;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        return Math.abs(localX) < hw && Math.abs(localY) < hh;
    },

    /**
     * Circle vs Oriented Bounding Box
     * @param {number} cx - Circle center x
     * @param {number} cy - Circle center y
     * @param {number} cr - Circle radius
     * @param {number} bx - Box center x
     * @param {number} by - Box center y
     * @param {number} bhw - Box half width
     * @param {number} bhh - Box half height
     * @param {number} angle - Box rotation
     * @returns {boolean}
     */
    circleOBB(cx, cy, cr, bx, by, bhw, bhh, angle) {
        // Transform circle center to box's local space
        const dx = cx - bx;
        const dy = cy - by;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // Find closest point on box to circle center (in local space)
        const closestX = Math.max(-bhw, Math.min(bhw, localX));
        const closestY = Math.max(-bhh, Math.min(bhh, localY));

        // Check distance from circle center to closest point
        const distX = localX - closestX;
        const distY = localY - closestY;
        return (distX * distX + distY * distY) < (cr * cr);
    },

    /**
     * Beam (line segment) vs Circle
     * Checks if a beam from (bx, by) at angle bAngle with length bLength hits a circle
     * @param {number} bx - Beam origin x
     * @param {number} by - Beam origin y
     * @param {number} bAngle - Beam angle in radians
     * @param {number} bLength - Beam length
     * @param {number} bWidth - Beam width (radius)
     * @param {number} cx - Circle center x
     * @param {number} cy - Circle center y
     * @param {number} cr - Circle radius
     * @returns {boolean}
     */
    beamCircle(bx, by, bAngle, bLength, bWidth, cx, cy, cr) {
        // Transform circle center to beam's local space
        const dx = cx - bx;
        const dy = cy - by;
        const cos = Math.cos(-bAngle);
        const sin = Math.sin(-bAngle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // Check if within beam bounds
        const hitRange = bWidth + cr;
        return localX > 0 && localX < bLength && Math.abs(localY) < hitRange;
    },

    /**
     * Separation response for two circles
     * Modifies both objects to separate them
     * @param {object} a - First object with x, y, radius
     * @param {object} b - Second object with x, y, radius
     * @param {number} overlap - How much they overlap
     * @param {number} dx - Direction x (b - a)
     * @param {number} dy - Direction y (b - a)
     * @param {number} dist - Distance between centers
     */
    separateCircles(a, b, overlap, dx, dy, dist) {
        if (dist === 0) {
            // Perfectly overlapping - push in random direction
            dx = 1;
            dy = 0;
            dist = 1;
        }
        const nx = dx / dist;
        const ny = dy / dist;
        const pen = overlap / 2;

        a.x -= nx * pen;
        a.y -= ny * pen;
        b.x += nx * pen;
        b.y += ny * pen;
    },

    /**
     * Bounce response for two circles with velocity
     * @param {object} a - First object with vx, vy
     * @param {object} b - Second object with vx, vy
     * @param {number} dx - Direction x
     * @param {number} dy - Direction y
     * @param {number} dist - Distance
     * @param {number} pushStrength - Bounce force
     * @param {number} dt - Delta time
     */
    bounceCircles(a, b, dx, dy, dist, pushStrength, dt) {
        if (dist === 0) dist = 1;
        const nx = dx / dist;
        const ny = dy / dist;

        a.vx -= nx * pushStrength * dt;
        a.vy -= ny * pushStrength * dt;
        b.vx += nx * pushStrength * dt;
        b.vy += ny * pushStrength * dt;
    }
};

export default Collision;
