import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {isAbsolute, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminRouterProvider, NavLink, createFetchAdminClient} from 'xladmin';
import {createNextAdminRouter} from 'xladmin-next';
import {createReactRouterAdminRouter} from 'xladmin-react-router';
import {ModelImportExportActions} from 'xladmin-import-export';

for (const name of ['xladmin', 'xladmin-next', 'xladmin-react-router', 'xladmin-import-export']) {
    const entry = realpathSync(fileURLToPath(import.meta.resolve(name)));
    const local = relative(realpathSync(process.cwd()), entry);
    assert.ok(!isAbsolute(local) && !local.startsWith('..'), `Non-consumer import: ${entry}`);
    console.log(`Installed artifact: ${name} at ${entry}`);
}
const adapter = {pathname: '/admin', search: '', push() {}, replace() {}, back() {}};
for (const create of [createNextAdminRouter, createReactRouterAdminRouter]) {
    assert.equal(create(adapter).resolveHref('/admin/models'), '/admin/models');
}
const router = {...createNextAdminRouter(adapter), resolveHref: (href) => `${href}?tenant_id=10`};
const html = renderToStaticMarkup(createElement(AdminRouterProvider, {router},
    createElement(NavLink, {href: '/admin/models'}, 'Models')));
assert.match(html, /href="\/admin\/models\?tenant_id=10"/);
assert.equal(typeof ModelImportExportActions, 'function');
for (const operation of ['createItem', 'patchItem']) {
    const calls = [];
    const client = createFetchAdminClient({baseUrl: 'http://artifact.test/api', fetch: async (url, init) => {
        calls.push({url, init});
        return Response.json({item: {id: 17}});
    }});
    const response = operation === 'createItem'
        ? await client.createItem('records', {name: 'Changed'})
        : await client.patchItem('records', 17, {name: 'Changed'});
    assert.deepEqual(response, {item: {id: 17}});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, operation === 'createItem' ? 'POST' : 'PATCH');
}
console.log('Packed ESM imports, adapter hrefs, SSR link and item-only mutation contract passed');
