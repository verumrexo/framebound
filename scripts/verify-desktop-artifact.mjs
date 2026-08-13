import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
    access,
    readFile,
    readdir,
    stat
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

const MACH_O_MAGICS = new Set([
    'cafebabe',
    'bebafeca',
    'cffaedfe',
    'feedfacf'
]);

export async function verifyDesktopArtifact({
    platform = process.platform,
    root = process.cwd(),
    flavor = 'release'
} = {}) {
    const packageJson = JSON.parse(await readFile(
        path.join(root, 'package.json'),
        'utf8'
    ));
    const baseTauri = JSON.parse(await readFile(
        path.join(root, 'src-tauri', 'tauri.conf.json'),
        'utf8'
    ));
    const tauri = flavor !== 'release'
        ? {
            ...baseTauri,
            ...JSON.parse(await readFile(
                path.join(root, 'src-tauri', `tauri.${flavor}.conf.json`),
                'utf8'
            ))
        }
        : baseTauri;
    assert.ok(
        ['release', 'dev', 'part-lab', 'enemy-lab'].includes(flavor),
        `unsupported desktop flavor: ${flavor}`
    );
    const expected = {
        productName: tauri.productName,
        identifier: tauri.identifier,
        version: packageJson.version
    };
    assert.equal(
        tauri.version,
        expected.version,
        'tauri and package versions must match before artifact verification'
    );

    if (platform === 'darwin') {
        const appPath = path.join(
            root,
            'src-tauri',
            'target',
            'release',
            'bundle',
            'macos',
            `${expected.productName}.app`
        );
        await verifyMacArtifact(appPath, expected);
        await verifyMacCodeSignature(appPath);
        console.log(`verified macos app artifact: ${appPath}`);
        return appPath;
    }

    if (platform === 'win32') {
        const directory = path.join(
            root,
            'src-tauri',
            'target',
            'release',
            'bundle',
            'nsis'
        );
        const installer = await verifyWindowsArtifact(directory, expected);
        console.log(`verified windows installer artifact: ${installer}`);
        return installer;
    }

    throw new Error(
        `desktop artifact verification is unsupported on ${platform}`
    );
}

export async function verifyMacCodeSignature(
    appPath,
    execFileImpl = execFileAsync
) {
    await execFileImpl('/usr/bin/codesign', [
        '--verify',
        '--deep',
        '--strict',
        '--verbose=2',
        appPath
    ]);
}

export async function verifyMacArtifact(appPath, expected) {
    const contents = path.join(appPath, 'Contents');
    const executable = path.join(contents, 'MacOS', 'framebound');
    const icon = path.join(contents, 'Resources', 'icon.icns');
    const plistPath = path.join(contents, 'Info.plist');
    const [plist, executableStat, iconStat, executableHeader] =
        await Promise.all([
            readFile(plistPath, 'utf8'),
            stat(executable),
            stat(icon),
            readHeader(executable, 4)
        ]);

    assert.equal(executableStat.isFile(), true);
    if (process.platform !== 'win32') {
        assert.ok(
            (executableStat.mode & 0o111) !== 0,
            'macos app executable is not executable'
        );
    }
    assert.ok(executableStat.size > 0, 'macos app executable is empty');
    assert.ok(iconStat.isFile() && iconStat.size > 0, 'macos icon is missing');
    assert.ok(
        MACH_O_MAGICS.has(executableHeader.toString('hex')),
        'macos app executable is not a mach-o binary'
    );

    for (const [key, value] of [
        ['CFBundleDisplayName', expected.productName],
        ['CFBundleExecutable', 'framebound'],
        ['CFBundleIdentifier', expected.identifier],
        ['CFBundleShortVersionString', expected.version],
        ['CFBundleVersion', expected.version]
    ]) {
        assertPlistValue(plist, key, value);
    }
}

export async function verifyWindowsArtifact(directory, expected) {
    const entries = await readdir(directory, { withFileTypes: true });
    const installers = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.exe'))
        .map(entry => path.join(directory, entry.name));
    assert.equal(
        installers.length,
        1,
        `expected one nsis installer, found ${installers.length}`
    );

    const installer = installers[0];
    const [installerStat, header] = await Promise.all([
        stat(installer),
        readHeader(installer, 2)
    ]);
    assert.ok(
        installerStat.size >= 1024,
        'windows installer is suspiciously small'
    );
    assert.equal(
        header.toString('ascii'),
        'MZ',
        'windows installer is not a portable executable'
    );
    const normalizedName = path.basename(installer).toLowerCase();
    assert.ok(
        normalizedName.includes(expected.productName.toLowerCase()),
        'windows installer filename is missing the product name'
    );
    assert.ok(
        normalizedName.includes(expected.version.toLowerCase()),
        'windows installer filename is missing the release version'
    );
    return installer;
}

async function readHeader(file, length) {
    await access(file);
    const raw = await readFile(file);
    return raw.subarray(0, length);
}

function assertPlistValue(plist, key, value) {
    const escapedKey = escapeRegex(key);
    const escapedValue = escapeRegex(escapeXml(value));
    assert.match(
        plist,
        new RegExp(
            `<key>\\s*${escapedKey}\\s*</key>\\s*` +
            `<string>\\s*${escapedValue}\\s*</string>`
        ),
        `macos plist does not contain ${key}=${value}`
    );
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const invokedPath = process.argv[1]
    ? pathToFileURL(path.resolve(process.argv[1])).href
    : null;
if (invokedPath === import.meta.url) {
    const flavorIndex = process.argv.indexOf('--flavor');
    const flavor = flavorIndex >= 0
        ? process.argv[flavorIndex + 1]
        : 'release';
    verifyDesktopArtifact({ flavor }).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
