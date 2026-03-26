import {cpSync, copyFileSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const projectDir = process.cwd();
const distDir = join(projectDir, 'dist');
const tempTypesDir = join(projectDir, '.tmp-types');
const indexTypesPath = join(distDir, 'index.d.ts');
const indexMtsTypesPath = join(distDir, 'index.d.mts');

if (existsSync(tempTypesDir)) {
    mkdirSync(distDir, {recursive: true});
    cpSync(tempTypesDir, distDir, {recursive: true, force: true});
    rmSync(tempTypesDir, {recursive: true, force: true});
}

if (existsSync(indexTypesPath)) {
    copyFileSync(indexTypesPath, indexMtsTypesPath);
}
