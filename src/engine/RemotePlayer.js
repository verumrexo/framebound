
import { PartsLibrary } from '../shared/parts/Part.js';
import { Assets } from '../Assets.js';
import { TILE_SIZE } from '../shared/parts/Part.js';
import { EntityRenderer } from '../game/renderers/EntityRenderer.js';

export class RemotePlayer {
    constructor(id) {
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.parts = []; // Array of {x, y, partId, rotation}
        this.input = {}; // { up, down, left, right, x, y, rotation }
        this.hp = 100;
        this.maxHp = 100;
        this.isDead = false;
        this.suspended = false;

        // Interpolation
        this.interpolationBuffer = [];
        this.INTERPOLATION_DELAY = 100; // ms
    }

    setShipData(parts) {
        this.parts = parts || [];
    }

    addSnapshot(data) {
        if (typeof data.isDead === 'boolean') this.isDead = data.isDead;
        if (typeof data.suspended === 'boolean') {
            this.suspended = data.suspended;
        }
        // data: { x, y, rotation, input, hp, maxHp }
        // We add a timestamp when we receive it (or server timestamp if available, but client receive time is simpler for now)
        this.interpolationBuffer.push({
            timestamp: Date.now(),
            ...data
        });

        // Prune old snapshots (older than 1s is useless)
        if (this.interpolationBuffer.length > 20) {
            this.interpolationBuffer.splice(0, this.interpolationBuffer.length - 20);
        }
    }

    update(dt) {
        const renderTime = Date.now() - this.INTERPOLATION_DELAY;

        // Find two snapshots around renderTime
        let fromNode = null;
        let toNode = null;

        for (let i = this.interpolationBuffer.length - 1; i >= 0; i--) {
            const snap = this.interpolationBuffer[i];
            if (snap.timestamp <= renderTime) {
                fromNode = snap;
                toNode = this.interpolationBuffer[i + 1];
                break;
            }
        }

        if (!fromNode) {
            // Render time is older than our history (lag spike?)
            // Snap to oldest available
            if (this.interpolationBuffer.length > 0) {
                const snap = this.interpolationBuffer[0];
                this.x = snap.x;
                this.y = snap.y;
                this.rotation = snap.rotation;
                if (snap.input) this.input = snap.input;
                if (snap.hp !== undefined) this.hp = snap.hp;
                if (snap.maxHp !== undefined) this.maxHp = snap.maxHp;
            }
            return;
        }

        if (!toNode) {
            // Render time is newer than latest snapshot (waiting for packets)
            // Snap to latest (or extrapolate)
            // For now, snap to latest to avoid overshooting
            const snap = fromNode;
            this.x = snap.x;
            this.y = snap.y;
            this.rotation = snap.rotation;
            if (snap.input) this.input = snap.input;
            if (snap.hp !== undefined) this.hp = snap.hp;
            if (snap.maxHp !== undefined) this.maxHp = snap.maxHp;
            return;
        }

        // Interpolate
        const timeDiff = toNode.timestamp - fromNode.timestamp;
        const progress = (renderTime - fromNode.timestamp) / timeDiff;

        this.x = fromNode.x + (toNode.x - fromNode.x) * progress;
        this.y = fromNode.y + (toNode.y - fromNode.y) * progress;

        // Rotation Lerp (shortest path)
        let rotDiff = toNode.rotation - fromNode.rotation;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        this.rotation = fromNode.rotation + rotDiff * progress;

        // Update other properties from latest known valid state (toNode is future, fromNode is past)
        // Usually visual properties should be from 'fromNode' or interpolated.
        // HP/Input etc.
        if (fromNode.input) this.input = fromNode.input;
        if (fromNode.hp !== undefined) this.hp = fromNode.hp;
        if (fromNode.maxHp !== undefined) this.maxHp = fromNode.maxHp;
    }

    draw(renderer) {
        // Draw Health Bar (Simplified for Remote)
        if (this.hp < this.maxHp) {
            EntityRenderer.drawHealthBar(renderer, this);
        }

        // Draw Ship
        // Calculate aim target (forward) since we don't sync aim yet
        const aimDist = 2000;
        const aimX = this.x + Math.cos(this.rotation) * aimDist;
        const aimY = this.y + Math.sin(this.rotation) * aimDist;

        EntityRenderer.drawShip(renderer, this, aimX, aimY);
    }

    // Polyfill for EntityRenderer to access parts
    getUniqueParts() {
        return this.parts; // Array is iterable
    }
}
