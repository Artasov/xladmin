import type {AdminClient, AdminModelMeta, AdminRouter} from 'xladmin';
import {createNextAdminRouter} from 'xladmin-next';
import {createReactRouterAdminRouter} from 'xladmin-react-router';

const adapter = {pathname: '/admin', search: '', push() {}, replace() {}, back() {}};
const routers: AdminRouter[] = [createNextAdminRouter(adapter), createReactRouterAdminRouter(adapter)];
const hrefs: string[] = routers.map((router) => router.resolveHref('/admin/models'));
const readonly: Pick<AdminModelMeta, 'read_only'> = {read_only: true};
const created: Awaited<ReturnType<AdminClient['createItem']>> = {item: {id: 1}};
const patched: Awaited<ReturnType<AdminClient['patchItem']>> = {item: {id: 1}};
export {hrefs, readonly, created, patched};
