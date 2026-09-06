import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scripts = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(scripts, '..');
const npm = process.env.npm_execpath ?? resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const directories = ['xladmin-core', 'xladmin-next', 'xladmin-react-router', 'xladmin-import-export'];
const argument = process.argv.indexOf('--output-dir');
assert.ok(argument >= 0 && process.argv[argument + 1], '--output-dir must name a new artifact directory');
const output = resolve(process.argv[argument + 1]);
mkdirSync(output, {recursive: false});

function run(command, args, cwd, capture = false) {
    console.log(`Running: ${command} ${args.join(' ')}`);
    const environment = {...process.env};
    delete environment.NODE_PATH;
    delete environment.NODE_OPTIONS;
    const result = spawnSync(command, args, {cwd, env: environment, encoding: 'utf8',
        stdio: capture ? 'pipe' : 'inherit', maxBuffer: 10 * 1024 * 1024});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${result.stderr ?? ''}`);
    return result.stdout;
}

const lock = JSON.parse(readFileSync(join(workspace, 'package-lock.json'), 'utf8'));
const peers = new Set(['typescript', '@types/react', '@types/react-dom']);
const tarballs = [];
for (const directory of directories) {
    const location = join(workspace, 'packages', directory);
    const manifest = JSON.parse(readFileSync(join(location, 'package.json'), 'utf8'));
    const locked = lock.packages[`packages/${directory}`];
    assert.equal(locked.version, manifest.version, `Lockfile version: ${directory}`);
    assert.deepEqual(locked.peerDependencies, manifest.peerDependencies, `Lockfile peers: ${directory}`);
    const [packed] = JSON.parse(run(process.execPath,
        [npm, 'pack', '--json', '--ignore-scripts', '--pack-destination', output], location, true));
    assert.equal(packed.version, manifest.version);
    assert.equal(packed.name, manifest.name);
    for (const required of [manifest.main, manifest.types]) {
        assert.ok(packed.files.some((file) => file.path === required.replace(/^\.\//, '')), `Missing entry: ${required}`);
    }
    assert.ok(!packed.files.some(({path}) => /(?:\.test\.|fixtures|(^|\/)tests\/)/.test(path)), 'Test artifacts leaked into npm package');
    tarballs.push({...packed, path: join(output, packed.filename)});
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) if (!peer.startsWith('xladmin')) peers.add(peer);
}

const dependencies = Object.fromEntries([...peers].map((name) => {
    const version = lock.packages[`node_modules/${name}`]?.version;
    assert.ok(version, `Missing locked consumer dependency: ${name}`);
    return [name, version];
}));
for (const [flag, names] of [['--next-version', ['next']], ['--react-version', ['react', 'react-dom']]]) {
    const index = process.argv.indexOf(flag);
    if (index < 0) continue;
    const version = process.argv[index + 1];
    assert.match(version ?? '', /^\d+\.\d+\.\d+$/, `${flag} must specify an exact stable version`);
    for (const name of names) dependencies[name] = version;
}
const temporaryRoot = realpathSync(tmpdir());
const consumer = mkdtempSync(join(temporaryRoot, 'xladmin-npm-consumer-'));
try {
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({name: 'xladmin-artifact-consumer',
        private: true, type: 'module', dependencies}, null, 2) + '\n', 'utf8');
    run(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund',
        ...tarballs.map(({path}) => path)], consumer);
    for (const [name, version] of Object.entries(dependencies)) {
        const installed = JSON.parse(readFileSync(join(consumer, 'node_modules', name, 'package.json'), 'utf8'));
        assert.equal(installed.version, version, `Installed consumer dependency: ${name}`);
    }
    for (const extension of ['mjs', 'ts']) {
        copyFileSync(join(scripts, `artifact-consumer.${extension}`), join(consumer, `artifact-consumer.${extension}`));
    }
    run(process.execPath, [join(consumer, 'artifact-consumer.mjs')], consumer);
    run(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict',
        '--skipLibCheck', '--moduleResolution', 'bundler', '--module', 'esnext', '--target', 'es2022',
        '--lib', 'es2022,dom', 'artifact-consumer.ts'], consumer);
} finally {
    assert.equal(dirname(realpathSync(consumer)), temporaryRoot, 'Refusing to remove a directory outside the temporary root');
    rmSync(consumer, {recursive: true, force: true});
}
writeFileSync(join(output, 'result.json'), JSON.stringify({packages: tarballs.map(({name, version, integrity, filename}) =>
    ({name, version, integrity, filename})), dependencies, isolatedInstall: true, runtimeAndTypes: 'passed'}, null, 2) + '\n', 'utf8');
console.log(`Artifact verification passed: ${output}`);
