import test from 'node:test';
import assert from 'node:assert/strict';
import {
    chmod,
    mkdir,
    mkdtemp,
    rm,
    writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    verifyMacArtifact,
    verifyWindowsArtifact
} from './verify-desktop-artifact.mjs';

const expected = {
    productName: 'Framebound',
    identifier: 'com.verumrexo.framebound',
    version: '1.1.0-beta'
};

test('mac artifact verification checks identity, version, icon, and binary', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'framebound-app-'));
    const app = path.join(root, 'Framebound.app');
    const contents = path.join(app, 'Contents');
    const executable = path.join(contents, 'MacOS', 'framebound');
    try {
        await mkdir(path.dirname(executable), { recursive: true });
        await mkdir(path.join(contents, 'Resources'), { recursive: true });
        await writeFile(executable, Buffer.from('cffaedfe', 'hex'));
        await chmod(executable, 0o755);
        await writeFile(path.join(contents, 'Resources', 'icon.icns'), 'icon');
        await writeFile(
            path.join(contents, 'Info.plist'),
            plistFor(expected)
        );

        await assert.doesNotReject(() => verifyMacArtifact(app, expected));
        if (process.platform !== 'win32') {
            await chmod(executable, 0o644);
            await assert.rejects(
                () => verifyMacArtifact(app, expected),
                /not executable/
            );
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('windows artifact verification rejects fake installers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'framebound-exe-'));
    const installer = path.join(
        root,
        'Framebound_1.1.0-beta_x64-setup.exe'
    );
    try {
        const valid = Buffer.alloc(1024);
        valid.write('MZ');
        await writeFile(installer, valid);
        assert.equal(
            await verifyWindowsArtifact(root, expected),
            installer
        );

        valid.write('NO');
        await writeFile(installer, valid);
        await assert.rejects(
            () => verifyWindowsArtifact(root, expected),
            /portable executable/
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

function plistFor({ productName, identifier, version }) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>${productName}</string>
<key>CFBundleExecutable</key><string>framebound</string>
<key>CFBundleIdentifier</key><string>${identifier}</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundleVersion</key><string>${version}</string>
</dict></plist>`;
}
