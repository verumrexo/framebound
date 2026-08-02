import '../src/tests/setup.js';

const { Projectile } = await import(
    '../src/shared/entities/Projectile.js'
);
const { ProjectileSystem } = await import(
    '../src/game/systems/ProjectileSystem.js'
);

const TYPES = [
    'rocket',
    'rocket_le',
    'rocket_he',
    'guided_rocket',
    'ggbm',
    'cluster_grenade',
    'mini_grenade',
    'tiny_grenade'
];

const COLLISIONS = [
    'timeout',
    'enemy shield',
    'enemy body',
    'boss shield',
    'boss body',
    'wreck',
    'asteroid',
    'crate',
    'enemy drone'
];

function baseGame(projectile) {
    return {
        projectiles: [projectile],
        enemies: [],
        bosses: [],
        shipwrecks: [],
        asteroids: [],
        lootCrates: [],
        drones: [],
        itemPickups: [],
        playerShip: {
            parts: new Map(),
            takeDamage: () => {}
        },
        x: 10000,
        y: 10000,
        rotation: 0,
        audio: {
            sounds: {},
            play: () => {}
        },
        network: {
            isConnected: false,
            sendEnemyHit: () => {}
        },
        spawnDamageNumber: () => {},
        spawnExplosion: () => {},
        spawnAsteroidLoot: () => {},
        spawnCrateLoot: () => {}
    };
}

function collisionProjectile(type) {
    return {
        owner: 'player',
        type,
        damage: 10,
        x: 0,
        y: 0,
        radius: 4,
        isVisualOnly: false,
        isBeam: false,
        isDead: false,
        shouldExplode: false,
        clusterCount: 1,
        update: () => {}
    };
}

function simulate(type, collision) {
    let projectile;
    if (collision === 'timeout') {
        projectile = new Projectile(
            0,
            0,
            0,
            type,
            600,
            'player',
            10,
            0,
            () => 0.5
        );
    } else {
        projectile = collisionProjectile(type);
    }

    const game = baseGame(projectile);
    const target = {
        id: 'target',
        x: 0,
        y: 0,
        radius: 10,
        isDead: false,
        takeDamage: () => false,
        checkShieldHit: () => ({ hit: false }),
        checkPartHit: () => ({ hit: true })
    };

    if (collision === 'enemy shield') {
        target.checkShieldHit = () => ({
            hit: true,
            shieldX: 0,
            shieldY: 0
        });
        game.enemies = [target];
    } else if (collision === 'enemy body') {
        game.enemies = [target];
    } else if (collision === 'boss shield') {
        target.checkShieldHit = () => ({ hit: true });
        game.bosses = [target];
    } else if (collision === 'boss body') {
        game.bosses = [target];
    } else if (collision === 'wreck') {
        target.takeDamage = () => ({
            destroyed: true,
            shouldDrop: false
        });
        game.shipwrecks = [target];
    } else if (collision === 'asteroid') {
        target.isBroken = false;
        game.asteroids = [target];
    } else if (collision === 'crate') {
        target.isOpened = false;
        target.rotSpeed = 0;
        game.lootCrates = [target];
    } else if (collision === 'enemy drone') {
        target.owner = 'enemy';
        game.drones = [target];
    }

    new ProjectileSystem(game).update(0.1);
    return projectile.shouldExplode === true;
}

const matrix = new Map();
for (const type of TYPES) {
    const results = new Map();
    for (const collision of COLLISIONS) {
        results.set(collision, simulate(type, collision));
    }
    matrix.set(type, results);
}

console.log(
    `| projectile | ${COLLISIONS.join(' | ')} |`
);
console.log(
    `| --- | ${COLLISIONS.map(() => ':---:').join(' | ')} |`
);
for (const type of TYPES) {
    const results = COLLISIONS.map(collision =>
        matrix.get(type).get(collision) ? 'explode' : 'vanish'
    );
    console.log(`| ${type} | ${results.join(' | ')} |`);
}
