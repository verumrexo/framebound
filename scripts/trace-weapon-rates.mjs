import '../src/tests/setup.js';

const { PartsLibrary } = await import('../src/shared/parts/Part.js');
const { WeaponSystem } = await import(
    '../src/game/systems/WeaponSystem.js'
);

const WEAPONS = [
    { id: 'gun_basic', label: 'dart', stat: 'velocityRateAdd' },
    { id: 'lps', label: 'lps laser', stat: 'laserRateAdd' }
];
const LEVELS = [1, 10];
const UPGRADES = [0, 0.05, 0.15, 0.4, 1];

function currentCooldown(weapon, level, upgrade) {
    const part = {
        partId: weapon.id,
        x: 0,
        y: 0,
        rotation: 0
    };
    const permanentStats = {
        velocityRateAdd: weapon.stat === 'velocityRateAdd' ? upgrade : 0,
        laserRateAdd: weapon.stat === 'laserRateAdd' ? upgrade : 0,
        missileSpeedMul: 1
    };
    const game = {
        x: 0,
        y: 0,
        rotation: 0,
        playerShip: {
            stats: {
                accelerantCount: 0,
                rocketBayCount: 0
            },
            permanentStats,
            getUniqueParts: () => [part]
        },
        input: { getMousePos: () => ({ x: 0, y: 0 }) },
        designer: { active: false },
        mouseDownLastFrame: false,
        audio: { play: () => null },
        network: { isConnected: false },
        spawnProjectile: () => {}
    };
    const system = new WeaponSystem(game);
    system.update(0, {
        isMouseDown: true,
        worldMouseX: 1000,
        worldMouseY: 0,
        levelBonus: 1 + (level - 1) * 0.01
    });
    return part.cooldown;
}

function intendedHistoricalCooldown(weapon, level, upgrade) {
    const def = PartsLibrary[weapon.id];
    const levelBonus = 1 + (level - 1) * 0.01;
    let fireRateMultiplier = levelBonus;

    if (def.stats.weaponGroup === 'laser') {
        fireRateMultiplier *= 1 + upgrade;
    } else if (def.stats.weaponGroup === 'velocity') {
        fireRateMultiplier += upgrade;
    }

    return def.stats.cooldown / fireRateMultiplier;
}

console.log('| weapon | level | offered bonus | current cooldown | intended cooldown | current shots/s | intended shots/s |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');

for (const weapon of WEAPONS) {
    for (const level of LEVELS) {
        for (const upgrade of UPGRADES) {
            const current = currentCooldown(weapon, level, upgrade);
            const intended = intendedHistoricalCooldown(weapon, level, upgrade);
            console.log(
                `| ${weapon.label} | ${level} | +${(upgrade * 100).toFixed(0)}% | ` +
                `${current.toFixed(4)}s | ${intended.toFixed(4)}s | ` +
                `${(1 / current).toFixed(3)} | ${(1 / intended).toFixed(3)} |`
            );
        }
    }
}
