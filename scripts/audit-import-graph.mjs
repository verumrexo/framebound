import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const allFiles = new Set();
const runtimeFiles = new Set();
const retainedEvidence = new Map([
    [
        path.join(sourceRoot, 'shared', 'Physics.js'),
        'pre-multiplayer movement parity evidence'
    ]
]);

await collect(sourceRoot);

const reachable = new Set();
await visit(path.join(sourceRoot, 'main.js'));
await visit(path.join(sourceRoot, 'server', 'server.js'));
for (const file of allFiles) {
    if (file.endsWith('.test.js')) await visit(file);
}

const unreachable = [...runtimeFiles]
    .filter(file =>
        !reachable.has(file) &&
        !retainedEvidence.has(file)
    )
    .map(file => path.relative(root, file))
    .sort();

if (unreachable.length === 0) {
    console.log('runtime import graph has no unreachable javascript modules');
} else {
    console.log('runtime-unreachable javascript modules:');
    for (const file of unreachable) console.log(`- ${file}`);
    process.exitCode = 1;
}

for (const [file, reason] of retainedEvidence) {
    if (!reachable.has(file)) {
        console.log(
            `retained non-runtime module: ` +
            `${path.relative(root, file)} (${reason})`
        );
    }
}

async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            await collect(file);
        } else if (
            file.endsWith('.js')
        ) {
            allFiles.add(file);
            if (!file.endsWith('.test.js')) runtimeFiles.add(file);
        }
    }
}

async function visit(file) {
    file = path.resolve(file);
    if (reachable.has(file) || !allFiles.has(file)) return;
    reachable.add(file);
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(
        /(?:from\s+|import\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g
    );
    for (const match of imports) {
        let dependency = path.resolve(path.dirname(file), match[1]);
        if (!path.extname(dependency)) dependency += '.js';
        await visit(dependency);
    }
}
