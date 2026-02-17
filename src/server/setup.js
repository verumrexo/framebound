// --- HEADLESS ENVIRONMENT MOCKS ---
// Must be imported BEFORE any game modules that use DOM/Canvas

import { fileURLToPath } from 'url';
import { dirname } from 'path';

global.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: () => { },
    removeEventListener: () => { }
};

const mockContext = {
    canvas: { width: 0, height: 0 },
    clearRect: () => { },
    fillRect: () => { },
    drawImage: () => { },
    save: () => { },
    restore: () => { },
    translate: () => { },
    rotate: () => { },
    scale: () => { },
    beginPath: () => { },
    moveTo: () => { },
    lineTo: () => { },
    closePath: () => { },
    stroke: () => { },
    fill: () => { },
    arc: () => { },
    strokeRect: () => { },
    fillText: () => { },
    measureText: () => ({ width: 0 }),
    createRadialGradient: () => ({ addColorStop: () => { } }),
    createLinearGradient: () => ({ addColorStop: () => { } }),
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    shadowBlur: 0,
    shadowColor: '#000',
    lineWidth: 1,
    strokeStyle: '#000',
    fillStyle: '#000',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic'
};

global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                getContext: () => mockContext,
                style: {},
                width: 0,
                height: 0,
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
            };
        }
        return {
            style: {},
            appendChild: () => { }
        };
    },
    body: {
        appendChild: () => { },
        style: {}
    }
};

global.Image = class {
    constructor() {
        this.onload = null;
        this.src = '';
        this.width = 0;
        this.height = 0;
    }
};

global.Audio = class {
    play() { }
    pause() { }
    cloneNode() { return this; }
};

if (!global.navigator) {
    global.navigator = { userAgent: 'node' };
} else {
    try {
        global.navigator.userAgent = 'node';
    } catch (e) {
        // ignore
    }
}

// Mock requestAnimationFrame for game loops if needed
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
