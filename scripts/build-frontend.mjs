import { spawnSync } from 'node:child_process';
import path from 'node:path';

const flavor = process.argv.includes('--flavor')
    ? process.argv[process.argv.indexOf('--flavor') + 1]
    : 'release';

if (!['release', 'dev'].includes(flavor)) {
    throw new Error(`unsupported frontend flavor: ${flavor}`);
}

const result = spawnSync(
    process.execPath,
    [path.resolve('node_modules', 'vite', 'bin', 'vite.js'), 'build'],
    {
        cwd: process.cwd(),
        env: {
            ...process.env,
            VITE_FRAMEBOUND_FLAVOR: flavor
        },
        stdio: 'inherit'
    }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
