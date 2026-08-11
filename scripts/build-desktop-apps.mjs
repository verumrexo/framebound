import { spawnSync } from 'node:child_process';
import path from 'node:path';

for (const flavor of ['release', 'dev']) {
    const result = spawnSync(
        process.execPath,
        [
            path.resolve('scripts', 'build-desktop.mjs'),
            '--flavor',
            flavor
        ],
        {
            cwd: process.cwd(),
            env: process.env,
            stdio: 'inherit'
        }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
