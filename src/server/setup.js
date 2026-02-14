// --- HEADLESS ENVIRONMENT MOCKS ---
// Must be imported BEFORE any game modules that use DOM/Canvas

import { fileURLToPath } from 'url';
import { dirname } from 'path';

global.window = { innerWidth: 1920, innerHeight: 1080 };
global.document = {
    createElement: (tag) => {
        // Return a mock canvas for any element creation to be safe
        return {
            getContext: () => ({
                canvas: { width: 0, height: 0 },
                clearRect: () => { },
                fillRect: () => { },
                drawImage: () => { },
                save: () => { },
                restore: () => { },
                translate: () => { },
                rotate: () => { },
                beginPath: () => { },
                moveTo: () => { },
                lineTo: () => { },
                closePath: () => { },
                stroke: () => { },
                fill: () => { },
                scale: () => { },
                arc: () => { },
                globalAlpha: 1
            }),
            style: {},
            width: 0,
            height: 0
        };
    }
};
global.Image = class { };
global.Audio = class { play() { } pause() { } };
if (!global.navigator) {
    global.navigator = { userAgent: 'node' };
} else {
    // If it exists but is read-only, we might not be able to set userAgent easily
    // But let's try to ignore if it fails
    try {
        global.navigator.userAgent = 'node';
    } catch (e) {
        // ignore
    }
}
// ----------------------------------
