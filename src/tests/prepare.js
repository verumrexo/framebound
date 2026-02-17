import fs from 'node:fs';
import path from 'node:path';

/**
 * Ensures that dummy files exist for external dependencies in node_modules,
 * allowing tests to run even if those dependencies are missing or broken
 * in the environment.
 */

const dependencies = [
    '@supabase/supabase-js',
    'socket.io-client',
    'socket.io',
    'express'
];

dependencies.forEach(dep => {
    const dir = path.join('node_modules', dep);
    if (!fs.existsSync(dir)) {
        console.log(`[Prepare] Creating dummy directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    }

    const indexFile = path.join(dir, 'index.js');
    if (!fs.existsSync(indexFile)) {
        console.log(`[Prepare] Creating dummy index: ${indexFile}`);
        fs.writeFileSync(indexFile, '');
    }

    const pkgFile = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgFile)) {
        console.log(`[Prepare] Creating dummy package.json: ${pkgFile}`);
        fs.writeFileSync(pkgFile, JSON.stringify({ type: 'module', main: 'index.js' }));
    }
});

console.log('[Prepare] Test environment ready.');
