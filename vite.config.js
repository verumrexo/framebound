
import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // Relative paths for easier deployment
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
