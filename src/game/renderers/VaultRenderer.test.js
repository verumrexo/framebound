import test from 'node:test';
import assert from 'node:assert/strict';
import { VaultRenderer } from './VaultRenderer.js';

function createHarness(phase = 'offer') {
    const calls = [];
    const target = {
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        beginPath: () => calls.push(['begin']),
        closePath: () => calls.push(['close']),
        moveTo: (...args) => calls.push(['move', ...args]),
        lineTo: (...args) => calls.push(['line', ...args]),
        arc: (...args) => calls.push(['arc', ...args]),
        stroke: () => calls.push(['stroke', target.strokeStyle, target.lineWidth]),
        fill: () => calls.push(['fill', target.fillStyle]),
        fillRect: (...args) => calls.push(['fillRect', target.fillStyle, ...args]),
        strokeRect: (...args) => calls.push(['strokeRect', target.strokeStyle, ...args]),
        fillText: (...args) => calls.push(['text', ...args])
    };
    const room = {
        x: 2000,
        y: 2000,
        width: 2000,
        height: 2000,
        vaultState: {
            phase,
            contractId: phase === 'offer' ? null : 'blood',
            elapsed: 9
        },
        vaultChests: [
            { x: 2730, y: 3120, contractId: 'gilded', sealed: phase !== 'offer', life: 2 },
            { x: 3270, y: 3120, contractId: 'blood', sealed: false, life: 2 }
        ]
    };
    return { calls, renderer: { ctx: target }, room };
}

test('vault renderer draws physical protocol shapes without hud text', () => {
    const { calls, renderer, room } = createHarness('offer');

    VaultRenderer.draw(renderer, room, true);

    assert.ok(calls.some(call => call[0] === 'strokeRect'));
    assert.ok(calls.some(call => call[0] === 'arc'));
    assert.ok(calls.some(call =>
        call[0] === 'stroke' && call[1] === '#ffd75a'
    ));
    assert.ok(calls.some(call =>
        call[0] === 'stroke' && call[1] === '#ff4f70'
    ));
    assert.equal(calls.some(call => call[0] === 'text'), false);
});

test('containment renderer exposes progress and seals the rejected shape', () => {
    const { calls, renderer, room } = createHarness('containment');

    VaultRenderer.draw(renderer, room, false);

    assert.ok(calls.some(call =>
        call[0] === 'stroke' && call[1] === '#667080' && call[2] === 10
    ));
    assert.ok(calls.some(call =>
        call[0] === 'stroke' && call[1] === '#ff4f70' && call[2] === 12
    ));
});
