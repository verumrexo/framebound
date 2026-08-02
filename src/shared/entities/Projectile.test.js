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
