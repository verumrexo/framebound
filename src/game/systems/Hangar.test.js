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
