
import { defineConfig } from 'vite';

const frameboundFlavor = process.env.VITE_FRAMEBOUND_FLAVOR || 'release';

export default defineConfig({
    base: './', // Relative paths for easier deployment
    define: {
        'import.meta.env.VITE_FRAMEBOUND_FLAVOR': JSON.stringify(frameboundFlavor)
    },
    server: {
        host: true,
        watch: {
            ignored: ['**/src-tauri/**']
        },
        proxy: {
            '/socket.io': {
                target: 'http://localhost:3000',
                ws: true
            }
        }
    },
    build: {
        outDir: 'dist'
    }
});
