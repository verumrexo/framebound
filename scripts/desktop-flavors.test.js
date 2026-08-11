import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('desktop flavors keep separate identity, feature, and artifact scripts', async () => {
    const base = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
    const dev = JSON.parse(await readFile('src-tauri/tauri.dev.conf.json', 'utf8'));
    const partLab = JSON.parse(await readFile('src-tauri/tauri.part-lab.conf.json', 'utf8'));
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
    const cargo = await readFile('src-tauri/Cargo.toml', 'utf8');

    assert.equal(base.productName, 'Framebound');
    assert.equal(base.identifier, 'com.verumrexo.framebound');
    assert.equal(dev.productName, 'Framebound Dev');
    assert.equal(dev.identifier, 'com.verumrexo.framebound.dev');
    assert.deepEqual(dev.build.features, ['part-lab']);
    assert.equal(partLab.productName, 'Framebound Part Lab');
    assert.equal(partLab.identifier, 'com.verumrexo.framebound.partlab');
    assert.deepEqual(partLab.build.features, ['part-lab']);
    assert.match(cargo, /\[features\][\s\S]*part-lab = \[\]/);
    assert.equal(packageJson.scripts['desktop:build:release'], 'node scripts/build-desktop.mjs --flavor release');
    assert.equal(packageJson.scripts['desktop:build:dev'], 'node scripts/build-desktop.mjs --flavor dev');
    assert.equal(packageJson.scripts['desktop:build:part-lab'], 'node scripts/build-desktop.mjs --flavor part-lab');
    assert.equal(packageJson.scripts['desktop:build:apps'], 'node scripts/build-desktop-apps.mjs');
});
