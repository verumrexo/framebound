import '../../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { PartsLibrary } = await import('../../shared/parts/Part.js');
const { Hangar } = await import('./Hangar.js');

test('hangar tooltips show the part description', () => {
    const tooltip = {
        style: { setProperty() {} },
        innerHTML: ''
    };

    Hangar.updateTooltip(tooltip, PartsLibrary.warp_gate);

    assert.match(
        tooltip.innerHTML,
        /select with q, then right-click toward your cursor to blink a short distance\./
    );
});

test('hangar tooltips flip and stay inside every viewport wall', () => {
    const tooltip = {
        style: {},
        getBoundingClientRect: () => ({ width: 280, height: 220 })
    };

    Hangar.positionTooltip(tooltip, 790, 590, { width: 800, height: 600 });
    assert.deepEqual(
        { left: tooltip.style.left, top: tooltip.style.top },
        { left: '495px', top: '355px' }
    );

    Hangar.positionTooltip(tooltip, 2, 3, { width: 800, height: 600 });
    assert.deepEqual(
        { left: tooltip.style.left, top: tooltip.style.top },
        { left: '17px', top: '18px' }
    );
});
