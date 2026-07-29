import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.platform !== 'darwin') {
    console.log('macos app signing skipped on this platform');
    process.exit(0);
}

const appPath = resolve(
    'src-tauri',
    'target',
    'release',
    'bundle',
    'macos',
    'Framebound.app'
);

if (!existsSync(appPath)) {
    console.error(`macos app bundle not found: ${appPath}`);
    process.exit(1);
}

const result = spawnSync('/usr/bin/codesign', [
    '--force',
    '--deep',
    '--sign',
    '-',
    '--timestamp=none',
    appPath
], {
    stdio: 'inherit'
});

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}

process.exit(result.status ?? 1);
