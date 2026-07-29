import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from './Input.js';

test('input releases held controls when the window loses focus', () => {
    const originalWindow = globalThis.window;
    const windowHandlers = new Map();
    const canvas = {
        addEventListener() {}
    };

    globalThis.window = {
        addEventListener(type, handler) {
            windowHandlers.set(type, handler);
        }
    };

    try {
        const input = new Input(canvas);
        windowHandlers.get('keydown')({ code: 'KeyW' });
        windowHandlers.get('mousedown')({ button: 0 });
        windowHandlers.get('mousedown')({ button: 2 });

        windowHandlers.get('blur')();

        assert.equal(input.isKeyDown('KeyW'), false);
        assert.equal(input.isKeyPressed('KeyW'), false);
        assert.equal(input.isMouseDown(), false);
        assert.equal(input.isRightMouseDown(), false);
        assert.equal('joysticks' in input, false);
        assert.equal('isTouch' in input, false);
    } finally {
        globalThis.window = originalWindow;
    }
});
