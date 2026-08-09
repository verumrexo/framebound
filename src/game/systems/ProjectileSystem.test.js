import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { ProjectileSystem } = await import('./ProjectileSystem.js');
const { Decoy } = await import('../../shared/entities/Decoy.js');

function createGame(projectiles = [], overrides = {}, systemOptions = {}) {
    const events = [];
    const game = {
        projectiles,
        enemies: [],
        bosses: [],
        decoys: [],
        shipwrecks: [],
        asteroids: [],
        lootCrates: [],
        drones: [],
        itemPickups: [],
        playerShip: {
            parts: new Map(),
            takeDamage: () => {}
        },
        x: 0,
        y: 0,
        rotation: 0,
        audio: {
            sounds: {},
            play: (name) => events.push(`audio:${name}`)
        },
        network: {
            isConnected: false,
            sendEnemyHit: () => {}
        },
        spawnDamageNumber: () => {},
        spawnExplosion: () => {},
        spawnAsteroidLoot: () => {},
        spawnCrateLoot: () => {},
        ...overrides
    };

    return {
        events,
        game,
        system: new ProjectileSystem(game, systemOptions)
    };
}

function visualProjectile(name, shouldExpire, updates) {
    return {
        owner: 'player',
        isVisualOnly: true,
        isBeam: false,
        isDead: false,
        shouldExplode: false,
        update(dt, game) {
            updates.push({ name, dt, game });
            if (shouldExpire) this.isDead = true;
        }
    };
}

test('projectiles update in reverse order and remove from their original index', () => {
    const updates = [];
    const first = visualProjectile('first', false, updates);
    const second = visualProjectile('second', true, updates);
    const { game, system } = createGame([first, second]);

    system.update(0.25);

    assert.deepEqual(updates.map(({ name }) => name), ['second', 'first']);
    assert.ok(updates.every(({ dt, game: updateGame }) => dt === 0.25 && updateGame === game));
    assert.deepEqual(game.projectiles, [first]);
});

test('network enemy projectile spawning keeps owner, fields, sound mapping, and return value', () => {
    class ProjectileStub {
        constructor(...args) {
            this.args = args;
        }
    }
    const sounds = [];
    const { game } = createGame([], {
        audio: {
            play: (...args) => sounds.push(args)
        }
    });
    const random = () => 0.25;
    const system = new ProjectileSystem(game, {
        ProjectileClass: ProjectileStub,
        random
    });

    const rail = system.spawnEnemyProjectile({
        x: 10,
        y: 20,
        angle: 0.5,
        type: 'railgun',
        speed: 900,
        damage: 12
    });
    system.spawnEnemyProjectile({
        x: 1,
        y: 2,
        angle: 3,
        type: 'saber',
        speed: 0,
        damage: 4
    });
    system.spawnEnemyProjectile({
        x: 4,
        y: 5,
        angle: 6,
        type: 'bullet',
        speed: 600,
        damage: 7
    });

    assert.equal(game.projectiles[0], rail);
    assert.deepEqual(
        rail.args,
        [10, 20, 0.5, 'railgun', 900, 'enemy', 12, null, random]
    );
    assert.deepEqual(sounds, [
        ['rail_shot', { volume: 0.6 }],
        ['shoot_lsr', { volume: 0.6 }],
        ['shoot_lps', { volume: 0.6 }]
    ]);
});

test('ballistic pierce crosses extra targets before being consumed', () => {
    const damage = [];
    const enemy = id => ({
        id,
        isDead: false,
        x: 0,
        y: 0,
        radius: 10,
        checkShieldHit: () => ({ hit: false }),
        checkPartHit: () => ({ hit: true }),
        takeDamage: amount => damage.push([id, amount])
    });
    const projectile = {
        owner: 'player',
        type: 'bullet',
        x: 0,
        y: 0,
        radius: 4,
        damage: 10,
        remainingPierces: 1,
        isBeam: false,
        isDead: false,
        update() {}
    };
    const { game, system } = createGame([projectile], {
        enemies: [enemy('first'), enemy('second')]
    });

    system.update(0.016);

    assert.deepEqual(damage, [['first', 10], ['second', 10]]);
    assert.deepEqual(game.projectiles, []);
});

test('ballistic pierce crosses rocks and crates instead of dying on debris', () => {
    const hits = [];
    const asteroid = {
        x: 0,
        y: 0,
        radius: 12,
        isDead: false,
        isBroken: false,
        takeDamage: amount => {
            hits.push(['asteroid', amount]);
            return false;
        }
    };
    const crate = {
        x: 0,
        y: 0,
        radius: 12,
        isOpened: false,
        rotSpeed: 0,
        takeDamage: amount => {
            hits.push(['crate', amount]);
            return false;
        }
    };
    const projectile = {
        owner: 'player',
        type: 'bullet',
        x: 0,
        y: 0,
        radius: 4,
        damage: 10,
        remainingPierces: 1,
        isBeam: false,
        isDead: false,
        update() {}
    };
    const { game, system } = createGame([projectile], {
        asteroids: [asteroid],
        lootCrates: [crate]
    });

    system.update(0.016);

    assert.deepEqual(hits, [
        ['asteroid', 10],
        ['crate', 10]
    ]);
    assert.deepEqual(game.projectiles, []);
    assert.equal(projectile.hitTargets.has(asteroid), true);
    assert.equal(projectile.hitTargets.has(crate), true);
});

test('laser chain and missile blast radius upgrades produce combat effects', () => {
    const damage = [];
    const explosions = [];
    const targets = [0, 100].map((x, index) => ({
        id: `enemy_${index}`,
        isDead: false,
        x,
        y: 0,
        radius: 10,
        checkShieldHit: () => ({ hit: false }),
        checkPartHit: px => ({ hit: px === 0 }),
        takeDamage: amount => damage.push([index, amount])
    }));
    const laser = {
        owner: 'player',
        type: 'laser',
        x: 0,
        y: 0,
        radius: 2,
        damage: 20,
        chainCount: 1,
        isBeam: false,
        isDead: false,
        update() {}
    };
    const { system } = createGame([laser], {
        enemies: targets,
        spawnExplosion: (...args) => explosions.push(args)
    });

    system.update(0.016);

    assert.deepEqual(damage, [[0, 20], [1, 11]]);
    assert.ok(explosions.some(([, , radius]) => radius === 8));
});

test('loaded shield audio suppresses the generic hit fallback', () => {
    const audioCalls = [];
    const shield = {
        partId: 'custom_1768410823264',
        shieldCooldown: 0
    };
    const projectile = {
        owner: 'enemy',
        type: 'bullet',
        x: 0,
        y: 0,
        radius: 4,
        damage: 5,
        isBeam: false,
        isDead: false,
        update() {}
    };
    const { game, system } = createGame([projectile], {
        playerShip: {
            parts: new Map([['0,0', shield]]),
            takeDamage: () => assert.fail('shielded shot damaged the player')
        },
        audio: {
            sounds: new Map([['shield_hit', {}]]),
            play: (...args) => audioCalls.push(args)
        }
    });

    system.update(0.016);

    assert.deepEqual(audioCalls, [
        ['shield_hit', { volume: 0.8 }]
    ]);
    assert.equal(shield.shieldCooldown, 3);
    assert.deepEqual(game.projectiles, []);
});

test('host authority applies direct enemy projectile damage to guests', () => {
    const damage = [];
    const guestShip = {
        x: 100,
        y: 0,
        rotation: 0,
        isDead: false,
        parts: new Map([[
            '0,0',
            { partId: 'core', shieldCooldown: 0 }
        ]]),
        takeDamage: amount => damage.push(amount)
    };
    const projectile = {
        owner: 'enemy',
        type: 'bullet',
        x: 100,
        y: 0,
        radius: 4,
        damage: 7,
        isBeam: false,
        isDead: false,
        update() {}
    };
    const { game, system } = createGame([projectile], {
        peerNetwork: {
            isHost: true,
            otherPlayers: new Map([['guest_1', guestShip]])
        }
    });

    system.update(0.016);

    assert.deepEqual(damage, [7]);
    assert.deepEqual(game.projectiles, []);
});

test('enemy bullets hit and consume on a decoy before reaching the player ship', () => {
    let playerDamage = 0;
    const decoy = new Decoy('decoy-front', 0, 0, 'host', { hp: 7 });
    const projectile = {
        owner: 'enemy',
        type: 'bullet',
        x: 0,
        y: 0,
        radius: 4,
        damage: 7,
        isBeam: false,
        isDead: false,
        shouldExplode: false,
        update() {}
    };
    const { game, system } = createGame([projectile], {
        decoys: [decoy],
        playerShip: {
            parts: new Map([['0,0', { partId: 'core' }]]),
            takeDamage: () => { playerDamage++; }
        }
    });

    system.update(0.016);

    assert.equal(decoy.hp, 0);
    assert.equal(decoy.isDead, true);
    assert.equal(playerDamage, 0);
    assert.deepEqual(game.projectiles, []);
});

test('enemy beams damage a decoy on the same deterministic throttle as other targets', () => {
    const decoy = new Decoy('beam-decoy', 50, 0, 'host', { hp: 20 });
    const projectile = {
        owner: 'enemy',
        type: 'railgun',
        x: 0,
        y: 0,
        angle: 0,
        beamLength: 100,
        radius: 6,
        damage: 5,
        isBeam: true,
        isDead: false,
        shouldExplode: false,
        targetHits: new Map(),
        update() {}
    };
    const { game, system } = createGame([projectile], {
        x: 200,
        decoys: [decoy]
    });

    system.update(0.016);
    assert.equal(decoy.hp, 15);

    system.update(0.05);
    assert.equal(decoy.hp, 15);

    system.update(0.1);
    assert.equal(decoy.hp, 10);
});

test('host authority applies enemy explosion damage to every nearby guest', () => {
    const damage = [];
    const guestShip = {
        x: 100,
        y: 0,
        rotation: 0,
        isDead: false,
        parts: new Map([['0,0', { partId: 'core' }]]),
        takeDamage: amount => damage.push(amount)
    };
    const projectile = {
        owner: 'enemy',
        type: 'mini_grenade',
        x: 100,
        y: 0,
        radius: 4,
        damage: 10,
        isBeam: false,
        isDead: true,
        shouldExplode: true,
        update() {}
    };
    const { game, system } = createGame([projectile], {
        peerNetwork: {
            isHost: true,
            otherPlayers: new Map([['guest_1', guestShip]])
        }
    });

    system.update(0.016);

    assert.deepEqual(damage, [5]);
    assert.deepEqual(game.projectiles, []);
});

test('direct enemy hits keep collision, damage, audio, and network ordering', () => {
    const order = [];
    const projectile = {
        owner: 'player',
        isVisualOnly: false,
        isBeam: false,
        isDead: false,
        shouldExplode: false,
        type: 'bullet',
        damage: 5,
        x: 10,
        y: 20,
        radius: 4,
        update() {
            order.push('update');
        }
    };
    const enemy = {
        id: 'enemy-1',
        isDead: false,
        checkShieldHit() {
            order.push('shield');
            return { hit: false };
        },
        checkPartHit() {
            order.push('part');
            return { hit: true };
        },
        takeDamage() {
            order.push('damage');
            this.isDead = true;
        }
    };
    const { game, system } = createGame([projectile], {
        enemies: [enemy],
        spawnDamageNumber: () => order.push('number'),
        audio: {
            sounds: {},
            play: () => order.push('audio')
        },
        network: {
            isConnected: true,
            sendEnemyHit(id, damage, killed) {
                order.push(['network', id, damage, killed]);
            }
        }
    });

    system.update(0.016);

    assert.deepEqual(order, [
        'update',
        'shield',
        'part',
        'damage',
        'number',
        'audio',
        ['network', 'enemy-1', 5, true]
    ]);
    assert.deepEqual(game.projectiles, []);
});

test('visual-only beams expire without running collision work', () => {
    const projectile = {
        owner: 'player',
        isVisualOnly: true,
        isBeam: true,
        isDead: false,
        shouldExplode: false,
        update() {
            this.isDead = true;
        }
    };
    const { game, system } = createGame([projectile], {
        enemies: [{
            isDead: false,
            checkShieldHit: () => assert.fail('visual-only beam checked a shield'),
            checkPartHit: () => assert.fail('visual-only beam checked a body')
        }]
    });

    system.update(0.016);

    assert.deepEqual(game.projectiles, []);
});

test('an expired gameplay beam still receives its final collision tick', () => {
    let hitCount = 0;
    const projectile = {
        owner: 'player',
        isVisualOnly: false,
        isBeam: true,
        isDead: false,
        shouldExplode: false,
        type: 'railgun',
        damage: 3,
        x: 0,
        y: 0,
        angle: 0,
        beamLength: 100,
        radius: 10,
        targetHits: new Map(),
        update() {
            this.isDead = true;
        }
    };
    const enemy = {
        id: 'enemy-1',
        isDead: false,
        x: 50,
        y: 0,
        radius: 10,
        takeDamage() {
            hitCount++;
        }
    };
    const { game, system } = createGame([projectile], {
        enemies: [enemy]
    });

    system.update(0.016);

    assert.equal(hitCount, 1);
    assert.deepEqual(game.projectiles, []);
});

test('cluster child scatter and fuse use the injected random source', () => {
    const values = [1, 0.5];
    const parent = {
        owner: 'player',
        isVisualOnly: false,
        isBeam: false,
        isDead: false,
        shouldExplode: true,
        type: 'cluster_grenade',
        damage: 10,
        x: 10,
        y: 20,
        clusterCount: 1,
        update() {
            this.isDead = true;
        }
    };
    const { game, system } = createGame(
        [parent],
        {},
        { random: () => values.shift() }
    );

    system.update(0.016);

    assert.equal(game.projectiles.length, 1);
    assert.equal(game.projectiles[0].type, 'mini_grenade');
    assert.ok(Math.abs(game.projectiles[0].angle - 0.15) < 0.000001);
    assert.equal(game.projectiles[0].life, 1);
    assert.equal(values.length, 0);
});

test('proximity mines arm, trigger inside 80, and deal their full 90-radius damage', () => {
    const damage = [];
    const explosions = [];
    const enemy = {
        id: 'mine-target',
        x: 70,
        y: 0,
        radius: 10,
        isDead: false,
        takeDamage: amount => damage.push(amount)
    };
    const mine = {
        owner: 'player',
        type: 'proximity_mine',
        x: 0,
        y: 0,
        damage: 18,
        explosionDamage: 18,
        blastRadius: 90,
        triggerRadius: 80,
        armed: true,
        isDead: false,
        shouldExplode: false,
        update() {}
    };
    const { game, system } = createGame([mine], {
        enemies: [enemy],
        spawnExplosion: (...args) => explosions.push(args)
    });

    system.update(0.016);

    assert.deepEqual(damage, [18]);
    assert.equal(explosions[0][2], 90);
    assert.deepEqual(game.projectiles, []);
});

test('shrapnel grenades fuse into ten deterministic fragments at 3.5 damage', () => {
    const grenade = {
        owner: 'player',
        type: 'shrapnel_grenade',
        x: 10,
        y: 20,
        angle: 0,
        damage: 12,
        shrapnelCount: 10,
        shrapnelDamage: 3.5,
        blastRadius: 70,
        isVisualOnly: false,
        isBeam: false,
        isDead: false,
        shouldExplode: true,
        update() {
            this.isDead = true;
        }
    };
    const { game, system } = createGame([grenade]);

    system.update(0.016);

    assert.equal(game.projectiles.length, 10);
    assert.ok(game.projectiles.every(fragment => fragment.type === 'shrapnel_fragment'));
    assert.ok(game.projectiles.every(fragment => fragment.damage === 3.5));
    assert.equal(game.projectiles[0].angle, 0);
    assert.ok(Math.abs(game.projectiles[5].angle - Math.PI) < 1e-12);
});

test('hack darts convert normal enemies, while later player shots ignore hacked allies', () => {
    const damage = [];
    const enemy = {
        id: 'hack-target',
        x: 0,
        y: 0,
        radius: 10,
        isDead: false,
        checkShieldHit: () => ({ hit: false }),
        checkPartHit: () => ({ hit: true }),
        takeDamage: amount => damage.push(amount)
    };
    const dart = {
        owner: 'player',
        sourcePlayerId: 'player-1',
        type: 'hack_dart',
        x: 0,
        y: 0,
        radius: 4,
        damage: 1,
        isBeam: false,
        isDead: false,
        update() {}
    };
    const { game, system } = createGame([dart], { enemies: [enemy] });

    system.update(0.016);

    assert.deepEqual(damage, [1]);
    assert.equal(enemy.hackTimer, 8);
    assert.equal(enemy.hackedByPlayerId, 'player-1');

    const followUp = {
        owner: 'player',
        type: 'bullet',
        x: 0,
        y: 0,
        radius: 4,
        damage: 10,
        isBeam: false,
        isDead: false,
        update() {}
    };
    game.projectiles.push(followUp);
    system.update(0.016);

    assert.deepEqual(damage, [1]);
    assert.deepEqual(game.projectiles, [followUp]);
});

test('ricochet slugs bounce once to the nearest unhit hostile for 70 percent damage', () => {
    const damage = [];
    const makeEnemy = (id, x) => ({
        id,
        x,
        y: 0,
        radius: 10,
        isDead: false,
        checkShieldHit: () => ({ hit: false }),
        checkPartHit: () => ({ hit: true }),
        takeDamage: amount => damage.push([id, amount])
    });
    const projectile = {
        owner: 'player',
        type: 'ricochet_slug',
        x: 0,
        y: 0,
        angle: 0,
        speed: 500,
        vx: 500,
        vy: 0,
        radius: 4,
        damage: 8,
        ricochetCount: 1,
        ricochetRange: 320,
        ricochetDamageMul: 0.7,
        isBeam: false,
        isDead: false,
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
    };
    const { game, system } = createGame([projectile], {
        enemies: [makeEnemy('first', 0), makeEnemy('second', 70)]
    });

    for (let i = 0; i < 20 && game.projectiles.length; i++) system.update(0.016);

    assert.deepEqual(damage, [['first', 8], ['second', 5.6]]);
    assert.deepEqual(game.projectiles, []);
});
