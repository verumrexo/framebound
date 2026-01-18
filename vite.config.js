import { defineConfig } from 'vite'

export default defineConfig({
    base: './', // Relative paths for easier deployment
    server: {
        host: true
    },
    build: {
        outDir: 'dist'
    }
})
