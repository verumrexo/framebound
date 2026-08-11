import { easeSweep } from './SweepMath.js';

export const BEAM_SWORD_SWEEP_DURATION = 0.22;
export const BEAM_SWORD_SWEEP_ARC = Math.PI / 2;
export const BEAM_SWORD_SWEEP_START = -Math.PI / 4;

export function beamSwordSweepAngle(baseAngle, elapsed) {
    const progress = easeSweep(elapsed / BEAM_SWORD_SWEEP_DURATION);
    return baseAngle + BEAM_SWORD_SWEEP_START + progress * BEAM_SWORD_SWEEP_ARC;
}
