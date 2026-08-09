import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hangar } from './Hangar.js';
import { ShipBuilder } from './ShipBuilder.js';

test('hangar reset removes infinite dev inventory and hides stale ui', () => {
    const hangar = Object.create(Hangar.prototype);
    Object.assign(hangar, {
        active: true,
        ui: { style: { display: 'block' } },
        tooltip: { style: { display: 'block' } },
        isHoveringUI: true,
        selectedPartId: 'rocket_he',
        rotation: 3,
        rotateDebounce: true,
        lastPlacedGrid: '1,2',
        draftShip: {},
        hasInfiniteParts: true,
        inventory: { rocket_he: 999 }
    });

    hangar.resetRunState();

    assert.equal(hangar.active, false);
    assert.equal(hangar.ui.style.display, 'none');
    assert.equal(hangar.tooltip.style.display, 'none');
    assert.equal(hangar.hasInfiniteParts, false);
    assert.deepEqual(hangar.inventory, {});
    assert.equal(hangar.draftShip, null);
    assert.equal(hangar.lastPlacedGrid, null);
});

test('ship builder reset discards its draft and hides stale ui', () => {
    const turretToggle = {
        textContent: 'turret mode // active',
        className: 'builder-action is-selected',
        style: { background: 'green' }
    };
    const builder = Object.create(ShipBuilder.prototype);
    Object.assign(builder, {
        active: true,
        ui: {
            style: { display: 'block' },
            querySelector: selector =>
                selector === '#builder-turret-toggle' ? turretToggle : null
        },
        tooltip: { style: { display: 'block' } },
        isHoveringUI: true,
        selectedPartId: 'rocket_he',
        rotation: 3,
        rotateDebounce: true,
        lastPlacedGrid: '1,2',
        ghostGrid: { x: 1, y: 2 },
        draftShip: {},
        turretEditorMode: true
    });

    builder.resetRunState();

    assert.equal(builder.active, false);
    assert.equal(builder.ui.style.display, 'none');
    assert.equal(builder.tooltip.style.display, 'none');
    assert.equal(builder.isHoveringUI, false);
    assert.equal(builder.draftShip, null);
    assert.equal(builder.turretEditorMode, false);
    assert.equal(builder.lastPlacedGrid, null);
    assert.equal(builder.ghostGrid, null);
    assert.equal(turretToggle.textContent, 'turret mode // off');
    assert.equal(turretToggle.className, 'builder-action');
});
