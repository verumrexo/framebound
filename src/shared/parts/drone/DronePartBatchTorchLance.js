const freezeRows = rows => Object.freeze(rows);

const torchKennelCarrier = freezeRows([
    '00011000',
    '00111100',
    '01100110',
    '01000010',
    '11011011',
    '10011001',
    '10111101',
    '10100101',
    '10111101',
    '10011001',
    '11011011',
    '01000010',
    '01100110',
    '00111100',
    '00011000'
]);

const torchKennelDrone = freezeRows([
    '00011000',
    '00111100',
    '01122110',
    '11011011',
    '11222211',
    '01122110',
    '00111100',
    '00011000'
]);

const lanceCradleCarrier = freezeRows([
    '00000001',
    '00000011',
    '00000111',
    '00001110',
    '00011100',
    '00111000',
    '01110000',
    '11111111',
    '01110000',
    '00111000',
    '00011100',
    '00001110',
    '00000111',
    '00000011',
    '00000001'
]);

const lanceCradleDrone = freezeRows([
    '00000001',
    '00000011',
    '00000111',
    '00001111',
    '00011111',
    '00111111',
    '01111111',
    '11111111'
]);

const silhouette = (carrier, deployedDrone) => Object.freeze({
    carrier,
    deployedDrone
});

const partSpec = (id, name, droneType, stats, carrier, deployedDrone) =>
    Object.freeze({
        id,
        name,
        type: 'drone',
        width: 1,
        height: 2,
        stats: Object.freeze({
            hp: 40,
            mass: 4,
            weaponGroup: 'drone',
            droneSpawnCooldown: stats.spawn,
            droneCapacity: stats.capacity,
            droneDamage: stats.damage,
            droneAttackCooldown: stats.attack,
            droneType
        }),
        silhouette: silhouette(carrier, deployedDrone),
        carrierSilhouette: carrier,
        deployedDroneSilhouette: deployedDrone
    });

// pure content batch: the integration layer owns PartDef/Sprite construction.
export const DRONE_PART_SPECS_TORCH_LANCE = Object.freeze({
    drone_torch_kennel: partSpec(
        'drone_torch_kennel',
        'torch kennel',
        'torch',
        { spawn: 5.5, capacity: 3, damage: 4, attack: 0.3 },
        torchKennelCarrier,
        torchKennelDrone
    ),
    drone_lance_cradle: partSpec(
        'drone_lance_cradle',
        'lance cradle',
        'lancer',
        { spawn: 8, capacity: 1, damage: 22, attack: 2.4 },
        lanceCradleCarrier,
        lanceCradleDrone
    )
});

const blueprint = (
    id,
    label,
    hp,
    speed,
    turnRate,
    range,
    optimalRange,
    projectileType,
    projectileSpeed
) => Object.freeze({
    id,
    label,
    hp,
    speed,
    turnRate,
    range,
    optimalRange,
    projectileType,
    projectileSpeed,
    shotCount: 1,
    role: 'attack'
});

export const DRONE_BLUEPRINT_SPECS_TORCH_LANCE = Object.freeze({
    torch: blueprint(
        'torch',
        'torch drone',
        12,
        280,
        6,
        190,
        100,
        'small_laser',
        1800
    ),
    lancer: Object.freeze({
        id: 'lancer',
        label: 'lancer drone',
        hp: 16,
        speed: 170,
        turnRate: 3,
        range: 700,
        optimalRange: 520,
        projectileType: 'railgun',
        projectileSpeed: 0,
        lifetime: 0.12,
        shotCount: 1,
        role: 'attack'
    })
});
