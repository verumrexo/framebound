import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CombatTelemetry,
    damageSourceFromProjectile
} from './CombatTelemetry.js';

test('combat telemetry separates exact parts and sorts by accumulated damage', () => {
    const telemetry = new CombatTelemetry();
    telemetry.record(5, {
        playerId: 'host',
        partKey: 'dart@-1,0',
        partId: 'gun_basic',
        partName: 'dart',
        family: 'velocity'
    });
    telemetry.record(9, {
        playerId: 'host',
        partKey: 'dart@1,0',
        partId: 'gun_basic',
        partName: 'dart',
        family: 'velocity'
    });
    telemetry.record(4, {
        playerId: 'host',
        partKey: 'dart@-1,0',
        partId: 'gun_basic',
        partName: 'dart',
        family: 'velocity'
    });

    assert.deepEqual(
        telemetry.entriesFor('host').map(entry => [entry.key, entry.damage]),
        [['dart@-1,0', 9], ['dart@1,0', 9]]
    );
});

test('projectile attribution survives snapshot replacement for a guest', () => {
    const source = damageSourceFromProjectile({
        sourcePlayerId: 'guest_1',
        sourcePartKey: 'rocketle@0,-1',
        sourcePartId: 'rocketle',
        sourcePartName: 'rocketle',
        weaponFamily: 'rocket'
    });
    const telemetry = new CombatTelemetry();
    telemetry.record(18, source);
    const snapshot = telemetry.snapshotFor('guest_1');

    const replica = new CombatTelemetry();
    replica.replaceFor('guest_1', snapshot);
    assert.deepEqual(replica.snapshotFor('guest_1'), snapshot);
});
