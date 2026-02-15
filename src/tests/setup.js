/**
 * Test setup for Node.js environment.
 * Mocks browser globals needed for the game engine.
 */

const noop = () => {};
const mockContext = new Proxy({}, {
    get: (target, prop) => {
        if (prop === 'canvas') return mockCanvas;
        return noop;
    }
});

const mockCanvas = {
    getContext: () => mockContext,
    style: {},
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: () => {}
};

global.window = {
    addEventListener: () => {},
    innerWidth: 1920,
    innerHeight: 1080,
    location: {
        hostname: 'localhost',
        origin: 'http://localhost:3000'
    }
};
global.document = {
    createElement: () => mockCanvas,
    body: {
        appendChild: () => {}
    },
    addEventListener: () => {}
};
global.Image = class {};
global.performance = { now: () => Date.now() };

// Mock navigator which is read-only in Node.js
Object.defineProperty(global, 'navigator', {
    value: { userAgent: 'node' },
    configurable: true
});
