import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { verifyDesktopArtifact } from './verify-desktop-artifact.mjs';

const tauriCli = path.resolve(
    'node_modules',
    '@tauri-apps',
    'cli',
    'tauri.js'
);
const args = [tauriCli, 'build'];

if (process.platform === 'darwin') {
    args.push('--bundles', 'app');
} else if (process.platform === 'win32') {
    args.push('--bundles', 'nsis');
}

run(process.execPath, args);

if (process.platform === 'darwin') {
    run(process.execPath, [
        path.resolve('scripts', 'sign-macos-app.mjs')
    ]);
}

if (process.platform === 'darwin' || process.platform === 'win32') {
    await verifyDesktopArtifact();
}

function run(command, commandArgs) {
    const result = spawnSync(command, commandArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit'
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
