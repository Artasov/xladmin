import {cpSync, copyFileSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const projectDir = process.cwd();
const distDir = join(projectDir, 'dist');
const tempTypesDir = join(projectDir, '.tmp-types');
const indexTypesPath = join(distDir, 'index.d.ts');
const indexMtsTypesPath = join(distDir, 'index.d.mts');

rmSync(join(distDir, 'cache.test.d.ts'), {force: true});
rmSync(join(distDir, 'client.test.d.ts'), {force: true});
rmSync(join(distDir, 'router.test.d.ts'), {force: true});
rmSync(join(distDir, 'utils', 'adminFields.test.d.ts'), {force: true});

if (existsSync(tempTypesDir)) {
    mkdirSync(distDir, {recursive: true});
    cpSync(tempTypesDir, distDir, {recursive: true, force: true});
    rmSync(tempTypesDir, {recursive: true, force: true});
}

rmSync(join(distDir, 'cache.test.d.ts'), {force: true});
rmSync(join(distDir, 'client.test.d.ts'), {force: true});
rmSync(join(distDir, 'router.test.d.ts'), {force: true});
rmSync(join(distDir, 'utils', 'adminFields.test.d.ts'), {force: true});

if (existsSync(indexTypesPath)) {
    copyFileSync(indexTypesPath, indexMtsTypesPath);
}
