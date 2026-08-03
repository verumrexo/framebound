import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from './Renderer.js';

test('renderer follows the resized css viewport instead of freezing launch dimensions', () => {
    const originalAddEventListener = window.addEventListener;
    const viewport = { width: 1280, height: 720 };
    let resizeHandler = null;
    const context = {
        scale() {},
        setTransform() {},
        fillRect() {}
    };
    const canvas = {
        style: { width: '1280px', height: '720px' },
        width: 0,
        height: 0,
        get clientWidth() {
            return this.style.width
                ? Number.parseInt(this.style.width, 10)
                : viewport.width;
        },
        get clientHeight() {
            return this.style.height
                ? Number.parseInt(this.style.height, 10)
                : viewport.height;
        },
        getContext: () => context
    };
    window.addEventListener = (type, handler) => {
        if (type === 'resize') resizeHandler = handler;
    };

    try {
        const renderer = new Renderer(canvas);
        assert.equal(renderer.width, 1280);
        assert.equal(renderer.height, 720);
        assert.equal(canvas.style.width, '');
        assert.equal(canvas.style.height, '');

        viewport.width = 1560;
        viewport.height = 940;
        resizeHandler();

        assert.equal(renderer.width, 1560);
        assert.equal(renderer.height, 940);
        assert.equal(canvas.width, 1560);
        assert.equal(canvas.height, 940);
    } finally {
        window.addEventListener = originalAddEventListener;
    }
});
