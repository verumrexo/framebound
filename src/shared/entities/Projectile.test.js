import test from 'node:test';
import assert from 'node:assert/strict';
import { Projectile } from './Projectile.js';

test('pellet speed uses the injected random source', () => {
    let calls = 0;
    const projectile = new Projectile(
        0,
        0,
        0,
        'pellet',
        600,
        'player',
        10,
        null,
        () => {
            calls++;
            return 0.25;
        }
    );

    assert.equal(projectile.vx, 750);
    assert.equal(projectile.vy, 0);
    assert.equal(calls, 1);
});

test('rocket movement parameters consume the injected sequence in original order', () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5];
    const projectile = new Projectile(
        10,
        20,
        Math.PI / 4,
        'rocket',
        500,
        'player',
        25,
        null,
        () => values.shift()
    );

    assert.equal(projectile.wavyTime, 10);
    assert.equal(projectile.wavySpeed, 4.4);
    assert.equal(projectile.wavyAmp, 0.245);
    assert.ok(Math.abs(projectile.driftDirection - (-0.04)) < 1e-12);
    assert.equal(projectile.secondaryWavySpeed, 8);
    assert.equal(projectile.secondaryWavyAmp, 0.1225);
    assert.deepEqual(values, []);
});

test('same injected sequence produces identical erratic projectile state', () => {
    const makeRandom = () => {
        const values = [0.91, 0.12, 0.73, 0.34, 0.56];
        return () => values.shift();
    };
    const first = new Projectile(0, 0, 0.2, 'rocket_he', 700, 'enemy', 10, null, makeRandom());
    const second = new Projectile(0, 0, 0.2, 'rocket_he', 700, 'enemy', 10, null, makeRandom());

    assert.deepEqual(
        {
            wavyTime: first.wavyTime,
            wavySpeed: first.wavySpeed,
            wavyAmp: first.wavyAmp,
            driftDirection: first.driftDirection,
            secondaryWavySpeed: first.secondaryWavySpeed
        },
        {
            wavyTime: second.wavyTime,
            wavySpeed: second.wavySpeed,
            wavyAmp: second.wavyAmp,
            driftDirection: second.driftDirection,
            secondaryWavySpeed: second.secondaryWavySpeed
        }
    );
});

test('new beam types keep their restrained ranges and lifetimes', () => {
    const sword = new Projectile(0, 0, 0, 'beam_sword', 0, 'player', 28);
    const welder = new Projectile(0, 0, 0, 'arc_welder', 0, 'player', 3.5);

    assert.equal(sword.isBeam, true);
    assert.equal(sword.beamLength, 120);
    assert.equal(sword.life, 0.22);
    assert.equal(welder.isBeam, true);
    assert.equal(welder.beamLength, 140);
    assert.equal(welder.life, 0.06);
});

test('beam sword sweeps from minus forty-five to plus forty-five degrees', () => {
    const sword = new Projectile(0, 0, 0, 'beam_sword', 0, 'player', 28);
    const start = sword.angle;
    sword.update(0.11);
    const middle = sword.angle;
    sword.update(0.11);

    assert.ok(Math.abs(start + Math.PI / 4) < 1e-9);
    assert.ok(Math.abs(middle) < 1e-9);
    assert.ok(Math.abs(sword.angle - Math.PI / 4) < 1e-9);
});

test('proximity mines arm on a simulation timer and expire without a stray explosion', () => {
    const mine = new Projectile(0, 0, 0, 'proximity_mine', 0, 'player', 18);
    mine.armingTimeRemaining = 0.65;

    mine.update(0.64);
    assert.equal(mine.armed, false);
    mine.update(0.01);
    assert.equal(mine.armed, true);
    mine.update(17.35);

    assert.equal(mine.isDead, true);
    assert.equal(mine.shouldExplode, false);
});

test('legacy laser constructors keep their fixed speed contract', () => {
    const projectile = new Projectile(0, 0, Math.PI / 2, 'laser', 900, 'player', 10);

    assert.ok(Math.abs(projectile.vx) < 1e-9);
    assert.equal(projectile.vy, 1500);
    assert.equal(projectile.speed, 1500);
});
