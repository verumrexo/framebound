export function seededRandom(seed) {
    let state = seed;
    const random = function () {
        let t = state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    random.getState = () => state;
    random.setState = nextState => {
        if (Number.isFinite(nextState)) state = nextState;
    };
    return random;
}
