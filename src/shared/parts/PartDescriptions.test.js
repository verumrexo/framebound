import test from 'node:test';
import assert from 'node:assert/strict';
import { PART_DESCRIPTIONS } from './PartDescriptions.js';

const EXPECTED_DESCRIPTION_COUNT = 72;

test('part descriptions contain exactly the canonical catalog', () => {
    assert.equal(Object.keys(PART_DESCRIPTIONS).length, EXPECTED_DESCRIPTION_COUNT);
    assert.equal(Object.isFrozen(PART_DESCRIPTIONS), true);
});

test('part descriptions are lowercase, nonempty, and end with punctuation', () => {
    for (const [id, description] of Object.entries(PART_DESCRIPTIONS)) {
        assert.equal(typeof description, 'string', `${id} must have a string description`);
        assert.notEqual(description.trim(), '', `${id} must have a nonempty description`);
        assert.equal(description, description.toLowerCase(), `${id} must be lowercase`);
        assert.match(description, /[.!?]$/, `${id} must end with terminal punctuation`);
    }
});

test('representative descriptions match the manager-authored wording exactly', () => {
    assert.equal(
        PART_DESCRIPTIONS.core,
        'the required center of your ship. lose it and the ship is done.'
    );
    assert.equal(
        PART_DESCRIPTIONS.drone_storm_lattice,
        'launches five tough drones that fire two laser shots at once.'
    );
    assert.equal(
        PART_DESCRIPTIONS.warp_gate,
        'select with q, then right-click toward your cursor to blink a short distance.'
    );
    assert.equal(
        PART_DESCRIPTIONS.decoy,
        'select with q, then right-click toward your cursor to drop a fake ship that distracts enemies.'
    );
    assert.equal(
        PART_DESCRIPTIONS.stealth,
        'select with q, then right-click to hide from enemies; firing or taking damage reveals you.'
    );
    assert.equal(
        PART_DESCRIPTIONS.emp,
        'select with q, then right-click to briefly stop nearby enemies from moving or shooting.'
    );
    assert.equal(
        PART_DESCRIPTIONS.hack_dart,
        'hits a normal enemy and makes it fight for you for a short time.'
    );
    assert.equal(
        PART_DESCRIPTIONS.torpedo_tube,
        'launches a slow torpedo with a huge explosion.'
    );
});
