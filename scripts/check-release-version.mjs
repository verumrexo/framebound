import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const packageLock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const tauri = JSON.parse(await readFile(
    'src-tauri/tauri.conf.json',
    'utf8'
));
const cargo = await readFile('src-tauri/Cargo.toml', 'utf8');
const source = await readFile('src/version.js', 'utf8');
const readme = await readFile('README.md', 'utf8');
const deployWorkflow = await readFile(
    '.github/workflows/deploy.yml',
    'utf8'
);
const desktopWorkflow = await readFile(
    '.github/workflows/desktop.yml',
    'utf8'
);

const releaseVersion = packageJson.version;
const displayVersion = releaseVersion.replace('-beta', ' (beta)');
const cargoVersion = cargo.match(
    /^\[package\][\s\S]*?^version = "([^"]+)"/m
)?.[1];

assert.equal(packageLock.version, releaseVersion);
assert.equal(packageLock.packages[''].version, releaseVersion);
assert.equal(packageJson.engines.node, '>=22.12.0');
assert.equal(
    packageLock.packages[''].engines.node,
    packageJson.engines.node
);
assert.equal(tauri.version, releaseVersion);
assert.equal(cargoVersion, releaseVersion);
assert.match(
    source,
    new RegExp(
        `export const VERSION = '${escapeRegex(displayVersion)}'`
    )
);
assert.ok(
    readme.includes(`**v${displayVersion} `),
    'README release banner does not match package version'
);
assert.ok(
    readme.includes('22.12+'),
    'README node requirement does not match the release runtime'
);
for (const [name, workflow] of [
    ['pages', deployWorkflow],
    ['desktop', desktopWorkflow]
]) {
    assert.match(
        workflow,
        /node-version:\s*22\b/,
        `${name} workflow does not use the release node line`
    );
}

console.log(`release version aligned: ${releaseVersion}`);

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
