import test from 'node:test';
import assert from 'node:assert/strict';
import { WebGLCompositor } from './WebGLCompositor.js';

function createGl(calls) {
    return {
        VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
        ARRAY_BUFFER: 5, STATIC_DRAW: 6, TEXTURE_2D: 7, TEXTURE_MIN_FILTER: 8,
        TEXTURE_MAG_FILTER: 9, TEXTURE_WRAP_S: 10, TEXTURE_WRAP_T: 11,
        NEAREST: 12, CLAMP_TO_EDGE: 13, BLEND: 14, FLOAT: 15, TEXTURE0: 16,
        UNPACK_PREMULTIPLY_ALPHA_WEBGL: 17, UNPACK_FLIP_Y_WEBGL: 18, RGBA: 19, UNSIGNED_BYTE: 20,
        TRIANGLE_STRIP: 21, COLOR_BUFFER_BIT: 22,
        createShader: () => ({}), shaderSource() {}, compileShader() {},
        getShaderParameter: () => true, getShaderInfoLog: () => '',
        createProgram: () => ({}), attachShader() {}, linkProgram() {},
        getProgramParameter: () => true, getProgramInfoLog: () => '',
        createBuffer: () => ({}), bindBuffer() {}, bufferData() {},
        createTexture: () => ({}), bindTexture() {},
        texParameteri: (...args) => calls.push(['param', ...args]),
        getAttribLocation: () => 0, getUniformLocation: () => ({}),
        viewport() {}, disable() {}, useProgram() {}, enableVertexAttribArray() {},
        vertexAttribPointer() {}, activeTexture() {},
        pixelStorei: (...args) => calls.push(['pixelStore', ...args]),
        texImage2D() {}, clearColor() {}, clear() {},
        uniform2f: (...args) => calls.push(['size', ...args]),
        drawArrays: () => calls.push(['draw'])
    };
}

test('webgl compositor pins the world texture to nearest sampling and recovers safely on context loss', () => {
    const calls = [];
    const listeners = new Map();
    const fallbackCalls = [];
    const fallback = {
        imageSmoothingEnabled: true,
        setTransform() {},
        clearRect() {},
        drawImage: (...args) => fallbackCalls.push(args)
    };
    const fallbackCanvas = { style: {}, getContext: () => fallback };
    const canvas = {
        width: 0,
        height: 0,
        style: {},
        addEventListener: (type, listener) => listeners.set(type, listener),
        getContext: () => fallback
    };
    const viewport = { physicalWidth: 1280, physicalHeight: 720 };
    const gl = createGl(calls);
    const compositor = new WebGLCompositor(canvas, viewport, {
        adapter: { createContext: () => gl },
        warn: message => calls.push(['warn', message]),
        createFallbackCanvas: () => fallbackCanvas
    });

    compositor.resize();
    compositor.present({ width: 640, height: 360 });

    assert.equal(compositor.available, true);
    assert.equal(compositor.backend, 'webgl2');
    assert.equal(fallback.imageSmoothingEnabled, true);
    assert.deepEqual(calls.filter(([type]) => type === 'param').map(call => call.at(-1)), [12, 12, 13, 13]);
    assert.deepEqual(calls.filter(([type]) => type === 'pixelStore'), [
        ['pixelStore', 18, true],
        ['pixelStore', 17, false]
    ]);
    assert.deepEqual(calls.find(([type]) => type === 'size').slice(-2), [640, 360]);
    assert.equal(calls.some(([type]) => type === 'draw'), true);

    let prevented = false;
    listeners.get('webglcontextlost')({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(compositor.available, false);
    assert.equal(compositor.backend, 'fallback');
    assert.equal(calls.filter(([type]) => type === 'warn').length, 1);
    compositor.present({ width: 640, height: 360 });
    assert.equal(fallbackCanvas.style.display, 'block');
    assert.equal(fallbackCalls.length, 1);
});
