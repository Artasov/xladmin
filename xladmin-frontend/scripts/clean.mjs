import {existsSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const projectDir = process.cwd();

for (const target of ['dist', '.tmp-types']) {
    const targetPath = join(projectDir, target);
    if (existsSync(targetPath)) {
        rmSync(targetPath, {recursive: true, force: true});
    }
}
