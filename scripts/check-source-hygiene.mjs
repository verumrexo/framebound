import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const runtimeFiles = [];
const failures = [];

await collect(sourceRoot);

for (const file of runtimeFiles) {
    const relative = path.relative(root, file);
    const syntax = spawnSync(process.execPath, ['--check', file], {
        cwd: root,
        encoding: 'utf8'
    });
    if (syntax.status !== 0) {
        failures.push(
            `${relative}: javascript syntax check failed\n` +
            `${syntax.stderr || syntax.stdout}`
        );
        continue;
    }

    const source = await readFile(file, 'utf8');
    if (/\beval\s*\(/.test(source) || /\bnew\s+Function\s*\(/.test(source)) {
        failures.push(`${relative}: dynamic javascript execution is forbidden`);
    }
    if (/\son[a-z]+\s*=\s*["']/i.test(source)) {
        failures.push(
            `${relative}: inline html event handlers are forbidden by csp`
        );
    }
}

const html = await readFile(path.join(root, 'index.html'), 'utf8');
const csp = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
)?.[1];
checkCsp('index.html', csp);

const tauri = JSON.parse(await readFile(
    path.join(root, 'src-tauri', 'tauri.conf.json'),
    'utf8'
));
const nativeCsp = tauri.app?.security?.csp;
checkCsp('src-tauri/tauri.conf.json', nativeCsp, {
    requireIpc: true
});

if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
} else {
    console.log(
        `source hygiene passed for ${runtimeFiles.length} runtime modules`
    );
}

async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            await collect(file);
        } else if (
            file.endsWith('.js') &&
            !file.endsWith('.test.js')
        ) {
            runtimeFiles.push(file);
        }
    }
}

function checkCsp(label, policy, { requireIpc = false } = {}) {
    if (typeof policy !== 'string' || policy.length === 0) {
        failures.push(`${label}: content security policy is missing`);
        return;
    }
    if (policy.includes("'unsafe-eval'")) {
        failures.push(`${label}: unsafe-eval is forbidden`);
    }
    if (!/(?:^|;)\s*script-src\s+'self'(?:\s|;|$)/.test(policy)) {
        failures.push(`${label}: script-src must be restricted to self`);
    }
    for (const directive of ['base-uri', 'object-src', 'frame-src']) {
        const pattern = new RegExp(
            `(?:^|;)\\s*${directive}\\s+'none'(?:\\s|;|$)`
        );
        if (!pattern.test(policy)) {
            failures.push(`${label}: ${directive} must be restricted to none`);
        }
    }
    if (
        requireIpc &&
        !/(?:^|;)\s*connect-src[^;]*\bipc:/.test(policy)
    ) {
        failures.push(`${label}: native connect-src must allow tauri ipc`);
    }
}
