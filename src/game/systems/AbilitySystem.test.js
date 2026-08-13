import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { AbilitySystem } = await import('./AbilitySystem.js');

function shipWith(...parts) {
    return {
        isDead: false,
        x: 100,
        y: 100,
        getUniqueParts: () => new Set(parts)
    };
}

function game(overrides = {}) {
    return {
        x: 100,
        y: 100,
        currentRoom: { x: 0, y: 0, width: 400, height: 400 },
        enemies: [],
        bosses: [],
        decoys: [],
        ...overrides
    };
}

test('active systems cycle in deterministic part order and ignore duplicates', () => {
    const playerShip = shipWith(
        { partId: 'emp', x: 3, y: 0 },
        { partId: 'warp_gate', x: -1, y: 0 },
        { partId: 'warp_gate', x: 0, y: 0 },
        { partId: 'decoy', x: 2, y: 0 }
    );
    const system = new AbilitySystem(game({ playerShip }));

    assert.deepEqual(
        system.getInstalledAbilities().map(ability => ability.id),
        ['blink', 'decoy', 'emp']
    );
    assert.equal(system.selectedAbility().id, 'blink');
    assert.equal(system.cycleSelection().id, 'decoy');
    assert.equal(system.cycleSelection().id, 'emp');
    assert.equal(system.cycleSelection().id, 'blink');
});

test('warp is host-derived, clamped, and cooldown-protected', () => {
    const playerShip = shipWith({ partId: 'warp_gate', x: 0, y: 0 });
    const sounds = [];
    const target = game({
        playerShip,
        audio: { playEvent: (key, fallback) => sounds.push([key, fallback]) }
    });
    const system = new AbilitySystem(target);

    const used = system.activateForPlayer('host', playerShip, {
        abilityId: 'blink',
        aimAngle: 0
    });
    assert.equal(used.x, 360);
    assert.equal(used.y, 100);
    assert.equal(target.x, 360);
    assert.deepEqual(sounds, [
        ['part:warp_gate:departure', 'dash'],
        ['part:warp_gate:arrival', 'nova']
    ]);
    assert.equal(system.activateForPlayer('host', playerShip, {
        abilityId: 'blink',
        aimAngle: 0
    }), false);
    assert.equal(system.activateForPlayer('host', playerShip, {
        abilityId: 'blink',
        aimAngle: Infinity
    }), false);
});

test('decoy, stealth, and emp apply their authoritative effects', () => {
    const enemy = { id: 'e1', x: 140, y: 100, isDead: false };
    const boss = { id: 'b1', type: 'boss', x: 150, y: 100, isDead: false };
    const playerShip = shipWith(
        { partId: 'decoy', x: 0, y: 0 },
        { partId: 'stealth', x: 1, y: 0 },
        { partId: 'emp', x: 2, y: 0 }
    );
    const sounds = [];
    const target = game({
        playerShip,
        enemies: [enemy],
        bosses: [boss],
        audio: { playEvent: (key, fallback) => sounds.push([key, fallback]) }
    });
    const system = new AbilitySystem(target);

    const decoy = system.activateForPlayer('host', playerShip, {
        abilityId: 'decoy',
        aimAngle: Math.PI
    });
    assert.equal(target.decoys.length, 1);
    assert.equal(target.decoys[0].id, decoy.decoyId);
    assert.equal(target.decoys[0].ownerPlayerId, 'host');

    assert.equal(system.activateForPlayer('host', playerShip, {
        abilityId: 'stealth',
        aimAngle: 0
    }).duration, 4);
    assert.equal(playerShip.stealthTimer, 4);

    const emp = system.activateForPlayer('host', playerShip, {
        abilityId: 'emp',
        aimAngle: 0
    });
    assert.deepEqual(emp.affected, ['e1', 'b1']);
    assert.equal(enemy.empTimer, 3);
    assert.equal(boss.empTimer, 1.25);

    target.decoys[0].isDead = true;
    system.update(4);
    assert.deepEqual(sounds, [
        ['part:decoy:deploy', 'reload'],
        ['part:stealth:cloak', 'dash'],
        ['part:emp:activate', 'reload'],
        ['part:emp:pulse', 'nova'],
        ['part:stealth:reveal', 'hit'],
        ['part:decoy:destroyed', 'hit']
    ]);
});

test('cooldowns and decoys round-trip through the state helpers', () => {
    const playerShip = shipWith({ partId: 'decoy', x: 0, y: 0 });
    const target = game({ playerShip });
    const system = new AbilitySystem(target);
    system.activateForPlayer('host', playerShip, {
        abilityId: 'decoy',
        aimAngle: 0
    });
    playerShip.stealthTimer = 1.5;
    const snapshot = system.snapshotShipState(playerShip);
    const restored = shipWith({ partId: 'decoy', x: 0, y: 0 });
    assert.equal(system.restoreShipState(restored, snapshot), true);
    assert.equal(restored.abilityCooldowns.decoy, 12);
    assert.equal(restored.stealthTimer, 1.5);
    system.update(6);
    assert.equal(target.decoys.length, 0);
});

test('decoy ids advance past restored and existing decoys', () => {
    const playerShip = shipWith({ partId: 'decoy', x: 0, y: 0 });
    const target = game({
        playerShip,
        decoys: [
            { id: 'decoy_host_2' },
            { id: 'decoy_guest_11' }
        ]
    });
    const system = new AbilitySystem(target);

    const created = system.activateForPlayer('host', playerShip, {
        abilityId: 'decoy',
        aimAngle: 0
    });

    assert.equal(created.decoyId, 'decoy_host_12');
    assert.equal(new Set(target.decoys.map(decoy => decoy.id)).size, 3);
});

test('doctrine ability timing is authoritative and boss control stays reduced', () => {
    const enemy = { id: 'e1', x: 140, y: 100, isDead: false };
    const boss = { id: 'b1', type: 'boss', x: 150, y: 100, isDead: false };
    const playerShip = shipWith(
        { partId: 'decoy', x: 0, y: 0 },
        { partId: 'stealth', x: 1, y: 0 },
        { partId: 'emp', x: 2, y: 0 }
    );
    playerShip.stats = { profile: {
        abilityCooldownMul: 0.75,
        empDurationMul: 1.5,
        stealthDurationMul: 1.35,
        decoyDurationMul: 1.35
    } };
    const target = game({
        playerShip,
        enemies: [enemy],
        bosses: [boss],
        audio: { playEvent() {} }
    });
    const system = new AbilitySystem(target);

    const decoy = system.activateForPlayer('host', playerShip, {
        abilityId: 'decoy', aimAngle: 0
    });
    const stealth = system.activateForPlayer('host', playerShip, {
        abilityId: 'stealth', aimAngle: 0
    });
    system.activateForPlayer('host', playerShip, {
        abilityId: 'emp', aimAngle: 0
    });

    assert.ok(Math.abs(
        target.decoys.find(item => item.id === decoy.decoyId).duration - 8.1
    ) < 1e-12);
    assert.equal(stealth.duration, 5.4);
    assert.equal(playerShip.abilityCooldowns.emp, 12);
    assert.equal(enemy.empTimer, 4.5);
    assert.equal(boss.empTimer, 1.5625);
});
