import { easeSweep } from '../../shared/combat/SweepMath.js';

const CHARGE_DURATION = 5;
const SWEEP_DURATION = 1;
const START_ANGLE = -Math.PI / 2;
const FULL_TURN = Math.PI * 2;

export class SalvageSweepSystem {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset() {
        this.status = 'idle';
        this.room = null;
        this.roomKey = null;
        this.originX = 0;
        this.originY = 0;
        this.elapsed = 0;
        this.previousTurn = 0;
        this.guestRequestHeld = false;
    }

    update(dt) {
        const room = this.game.currentRoom;
        if (this.status === 'sweeping') {
            if (room !== this.room) {
                this.setIdle();
                return;
            }
            this.updateSweep(dt);
            return;
        }
        if (!this.canCharge(room)) {
            this.setIdle();
            return;
        }

        this.room = room;
        this.roomKey = keyForRoom(room);
        if (!Number.isFinite(room.sweepChargeRemaining)) {
            room.sweepChargeRemaining = CHARGE_DURATION;
        }
        if (room.sweepChargeRemaining > 0) {
            room.sweepChargeRemaining = Math.max(
                0,
                room.sweepChargeRemaining - dt
            );
            this.status = room.sweepChargeRemaining > 0
                ? 'charging'
                : 'ready';
        } else {
            this.status = 'ready';
        }

        if (
            this.status === 'ready' &&
            this.game.input.isKeyPressed('KeyR')
        ) {
            this.triggerFor({
                x: this.game.x,
                y: this.game.y,
                id: 'host'
            });
        }
    }

    updateGuest(dt) {
        if (this.status === 'sweeping') {
            this.elapsed = Math.min(SWEEP_DURATION, this.elapsed + dt);
        }
        const pressed = this.game.input.isKeyPressed('KeyR');
        if (pressed && !this.guestRequestHeld && this.status === 'ready') {
            this.game.peerNetwork?.sendSalvageSweep?.();
        }
        this.guestRequestHeld = pressed;
    }

    canCharge(room) {
        return Boolean(
            room?.cleared &&
            !room.sweepUsed &&
            this.getTargets(room).length > 0
        );
    }

    triggerFor(player) {
        const room = this.game.currentRoom;
        if (
            !player ||
            this.status !== 'ready' ||
            !this.canCharge(room)
        ) {
            return false;
        }
        this.status = 'sweeping';
        this.room = room;
        this.roomKey = keyForRoom(room);
        this.originX = Number.isFinite(player.x) ? player.x : this.game.x;
        this.originY = Number.isFinite(player.y) ? player.y : this.game.y;
        this.elapsed = 0;
        this.previousTurn = 0;
        this.game.audio.play('rail', { volume: 0.55, pitch: 1.6 });
        this.game.showNotification('salvage sweep engaged', '#35f2ff');
        return true;
    }

    updateSweep(dt) {
        const previous = easeSweep(this.elapsed / SWEEP_DURATION) * FULL_TURN;
        this.elapsed = Math.min(SWEEP_DURATION, this.elapsed + dt);
        const current = easeSweep(this.elapsed / SWEEP_DURATION) * FULL_TURN;
        this.destroyCrossedTargets(previous, current);
        this.previousTurn = current;
        if (this.elapsed < SWEEP_DURATION) return;

        this.destroyCrossedTargets(0, FULL_TURN + 0.0001);
        this.room.sweepUsed = true;
        this.room.sweepChargeRemaining = 0;
        this.game.audio.play('explosion', { volume: 0.35, pitch: 1.8 });
        this.game.showNotification('salvage field cleared', '#74ff6a');
        this.setIdle();
    }

    destroyCrossedTargets(previousTurn, currentTurn) {
        for (const target of this.getTargets(this.room)) {
            const angle = normalizeTurn(
                Math.atan2(target.y - this.originY, target.x - this.originX) -
                START_ANGLE
            );
            if (angle + 0.0001 < previousTurn || angle > currentTurn + 0.0001) {
                continue;
            }
            if (target.kind === 'asteroid') {
                if (target.entity.takeDamage(target.entity.hp + 1)) {
                    this.game.spawnAsteroidLoot(target.entity);
                }
            } else if (target.entity.takeDamage(target.entity.hp + 1)) {
                this.game.spawnCrateLoot(target.entity);
            }
            this.game.spawnExplosion(
                target.entity.x,
                target.entity.y,
                Math.max(14, target.entity.radius * 0.65),
                0.22,
                '#35f2ff'
            );
        }
    }

    getTargets(room) {
        if (!room) return [];
        const asteroids = room === this.game.currentRoom
            ? this.game.asteroids
            : room.asteroids;
        const crates = room === this.game.currentRoom
            ? this.game.lootCrates
            : room.lootCrates;
        return [
            ...(asteroids || [])
                .filter(entity => !entity.isDead && !entity.isBroken && room.contains(entity.x, entity.y))
                .map(entity => ({ kind: 'asteroid', entity, x: entity.x, y: entity.y })),
            ...(crates || [])
                .filter(entity => !entity.isOpened && room.contains(entity.x, entity.y))
                .map(entity => ({ kind: 'crate', entity, x: entity.x, y: entity.y }))
        ];
    }

    snapshot() {
        return {
            status: this.status,
            roomKey: this.roomKey,
            originX: this.originX,
            originY: this.originY,
            elapsed: this.elapsed,
            chargeRemaining: this.room?.sweepChargeRemaining ?? null
        };
    }

    applyRemoteState(state) {
        if (!state) return;
        this.status = state.status;
        this.roomKey = state.roomKey;
        this.originX = state.originX;
        this.originY = state.originY;
        this.elapsed = state.elapsed;
        this.room = keyForRoom(this.game.currentRoom) === state.roomKey
            ? this.game.currentRoom
            : null;
        if (this.room && Number.isFinite(state.chargeRemaining)) {
            this.room.sweepChargeRemaining = state.chargeRemaining;
        }
    }

    draw(renderer) {
        if (this.status !== 'sweeping' || !this.room) return;
        const progress = easeSweep(this.elapsed / SWEEP_DURATION);
        const angle = START_ANGLE + progress * FULL_TURN;
        const length = Math.hypot(this.room.width, this.room.height) * 1.1;
        const endX = this.originX + Math.cos(angle) * length;
        const endY = this.originY + Math.sin(angle) * length;
        const ctx = renderer.ctx;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowColor = '#35f2ff';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = 'rgba(53, 242, 255, 0.3)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(this.originX, this.originY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#dffcff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.originX, this.originY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(116, 255, 106, 0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(
            this.originX,
            this.originY,
            54,
            angle - 0.55,
            angle
        );
        ctx.stroke();
        ctx.restore();
    }

    setIdle() {
        this.status = 'idle';
        this.room = null;
        this.roomKey = null;
        this.elapsed = 0;
        this.previousTurn = 0;
    }
}

export { easeSweep };

function normalizeTurn(angle) {
    return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

function keyForRoom(room) {
    return room ? `${room.gridX},${room.gridY}` : null;
}
