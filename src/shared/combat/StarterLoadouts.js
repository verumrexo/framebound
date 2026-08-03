const STARTER_THRUSTER = Object.freeze({
    x: 0,
    y: 1,
    partId: 'custom_1767997495375',
    rotation: 0
});

export const STARTER_LOADOUTS = Object.freeze([
    Object.freeze({
        id: 'ballistic',
        label: 'dart lattice',
        theoreticalDps: 15,
        parts: Object.freeze([
            Object.freeze({ x: -1, y: 0, partId: 'gun_basic', rotation: 0 }),
            Object.freeze({ x: 1, y: 0, partId: 'gun_basic', rotation: 0 }),
            Object.freeze({ x: 0, y: -1, partId: 'gun_basic', rotation: 0 })
        ])
    }),
    Object.freeze({
        id: 'laser',
        label: 'lps pair',
        theoreticalDps: 15.22,
        parts: Object.freeze([
            Object.freeze({ x: -1, y: 0, partId: 'lps', rotation: 0 }),
            Object.freeze({ x: 1, y: 0, partId: 'lps', rotation: 0 })
        ])
    }),
    Object.freeze({
        id: 'missile',
        label: 'rocketle rack',
        theoreticalDps: 15.43,
        parts: Object.freeze([
            Object.freeze({ x: 0, y: -1, partId: 'rocketle', rotation: 1 })
        ])
    })
]);

export function applyRandomStarterLoadout(ship, random = Math.random) {
    if (!ship?.parts?.clear || typeof ship.addPart !== 'function') return null;

    const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
    const loadout = STARTER_LOADOUTS[Math.floor(roll * STARTER_LOADOUTS.length)];
    ship.parts.clear();
    ship.maxHp = 0;
    ship.hp = 0;

    const layout = [
        { x: 0, y: 0, partId: 'core', rotation: 0 },
        STARTER_THRUSTER,
        ...loadout.parts
    ];
    for (const part of layout) {
        if (!ship.addPart(part.x, part.y, part.partId, part.rotation)) {
            throw new Error(`invalid starter loadout ${loadout.id}`);
        }
    }
    ship.hp = ship.maxHp;
    ship.starterLoadoutId = loadout.id;
    return loadout;
}
