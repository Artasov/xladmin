import {cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync} from 'node:fs';
import {join} from 'node:path';

const projectDir = process.cwd();
const distDir = join(projectDir, 'dist');
const tempTypesDir = join(projectDir, '.tmp-types');
const indexTypesPath = join(distDir, 'index.d.ts');
const indexMtsTypesPath = join(distDir, 'index.d.mts');

function removeTestDeclarations(targetDir) {
    if (!existsSync(targetDir)) {
        return;
    }
    for (const entry of readdirSync(targetDir)) {
        const entryPath = join(targetDir, entry);
        if (statSync(entryPath).isDirectory()) {
            removeTestDeclarations(entryPath);
            continue;
        }
        if (entry.endsWith('.test.d.ts')) {
            rmSync(entryPath, {force: true});
        }
    }
}

if (existsSync(tempTypesDir)) {
    mkdirSync(distDir, {recursive: true});
    cpSync(tempTypesDir, distDir, {recursive: true, force: true});
    rmSync(tempTypesDir, {recursive: true, force: true});
}

removeTestDeclarations(distDir);

if (existsSync(indexTypesPath)) {
    copyFileSync(indexTypesPath, indexMtsTypesPath);
}
