import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parse} from 'yaml';

const workflow = (name) => parse(readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));

for (const name of ['backend', 'backend-import-export', 'frontend', 'frontend-import-export']) {
    test(`${name} publication waits for both source and installed-artifact checks`, () => {
        const definition = workflow(name);
        assert.equal(definition.jobs['artifact-checks'].uses, './.github/workflows/artifacts.yml');
        assert.deepEqual(definition.jobs.publish.needs, ['quality-checks', 'artifact-checks']);
    });
}

test('artifact workflow checks wheels and tarballs without publication permissions', () => {
    const definition = workflow('artifacts');
    assert.ok(Object.hasOwn(definition.on, 'workflow_call'));
    assert.ok(Object.hasOwn(definition.on, 'pull_request'));
    assert.deepEqual(definition.permissions, {contents: 'read'});
    const commands = definition.jobs['installed-consumers'].steps.map(({run = ''}) => run).join('\n');
    assert.match(commands, /check_backend_artifacts\.py --output-dir/);
    assert.match(commands, /npm run check:artifacts -- --output-dir/);
    assert.match(commands, /npm run check:artifacts -- --next-version 16\.2\.12 --react-version 19\.2\.5 --output-dir/);
    assert.doesNotMatch(commands, /npm publish|twine upload|git push/);
});
