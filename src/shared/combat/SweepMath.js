export function easeSweep(value) {
    const t = Math.max(0, Math.min(1, value));
    return t < 0.5
        ? 16 * t ** 5
        : 1 - ((-2 * t + 2) ** 5) / 2;
}
