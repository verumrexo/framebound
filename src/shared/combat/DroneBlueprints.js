export const DRONE_BLUEPRINTS = Object.freeze({
    striker: Object.freeze({
        id: 'striker',
        label: 'striker drone',
        hp: 20,
        speed: 220,
        turnRate: 4,
        range: 300
    })
});

export function resolveDroneBlueprint(id) {
    return DRONE_BLUEPRINTS[id] || DRONE_BLUEPRINTS.striker;
}
