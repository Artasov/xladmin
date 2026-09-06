import {act, StrictMode, useLayoutEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AdminTranslationKey} from '../../i18n';
import {AdminLocaleProvider} from '../../i18n';
import {buildListCacheKey, getClientCacheBucket} from '../../cache';
import type {AdminDeletePreviewResponse, AdminListResponse} from '../../types';
import {readOnlyFixture} from '../read-only-fixtures';
import {useModelPageController} from './useModelPageController';
import {ModelPage} from '../ModelPage';

const messages = vi.hoisted(() => ({success: vi.fn(), error: vi.fn()}));
vi.mock('../layout/AdminMessageContext', () => ({useAdminMessage: () => messages}));
type Fixture = ReturnType<typeof readOnlyFixture>;
type Controller = ReturnType<typeof useModelPageController>;
const t = (key: AdminTranslationKey) => key;
let root: Root;
let container: HTMLDivElement;
let controller: Controller;

function Harness({fixture, search}: {fixture: Fixture; search: string}) {
    const current = useModelPageController({client: fixture.client, router: fixture.router, slug: fixture.meta.slug, pathname: '/admin/ledger', locationSearch: search, t});
    useLayoutEffect(() => {controller = current;}, [current]);
    return <output>{current.rows.map((row) => row.name).join(',')}</output>;
}
async function render(fixture: Fixture, search = '') {
    await act(async () => root.render(<StrictMode><Harness fixture={fixture} search={search}/></StrictMode>));
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
}
function withForm(fixture: Fixture) {
    fixture.meta.bulk_actions[1].form = fixture.meta.fields.map((field) => ({...field, placeholder: null, options: [], auto_now: false}));
    return fixture;
}
beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

describe('list scope lifecycle', () => {
    it('resets selection and dialogs for a new client even with the same model and object ID', async () => {
        const first = withForm(readOnlyFixture(false));
        const second = readOnlyFixture(false);
        second.item.name = 'Other tenant';
        await render(first);
        await act(async () => {controller.handleToggleSelection(1, true); controller.setCreateOpen(true);});
        await act(async () => controller.handleRunNamedBulkAction('recalculate'));
        const previous = controller;
        await render(second);
        expect(container.textContent).toBe('Other tenant');
        expect(controller.selectedIds).toEqual([]);
        expect(controller.createOpen).toBe(false);
        expect(controller.bulkActionFormOpen).toBe(false);
        await act(async () => {
            await previous.handleRunNamedBulkAction('recalculate');
            await previous.handleSubmitBulkActionForm({name: 'Old'});
            await previous.handleRowDelete(1);
            await previous.refresh();
        });
        expect(first.client.runBulkAction).not.toHaveBeenCalled();
        expect(first.client.getDeletePreview).not.toHaveBeenCalled();
        expect(first.client.getItems).toHaveBeenCalledTimes(1);
    });

    it('ignores a late list rejection after changing the query', async () => {
        const fixture = readOnlyFixture(false);
        const pending = deferred<AdminListResponse>();
        vi.mocked(fixture.client.getItems).mockReturnValueOnce(pending.promise);
        await render(fixture);
        await render(fixture, '?q=new');
        await act(async () => {pending.reject(new Error('Old list failed')); await pending.promise.catch(() => {});});
        expect(controller.error).toBeNull();
        expect(controller.isLoading).toBe(false);
        expect(container.textContent).toBe('Receipt');
    });

    it('does not replace the new client data with an old pending response', async () => {
        const first = readOnlyFixture(false);
        const second = readOnlyFixture(false);
        second.item.name = 'Second tenant';
        const pending = deferred<AdminListResponse>();
        vi.mocked(first.client.getItems).mockReturnValue(pending.promise);
        await render(first);
        await render(second);
        await act(async () => {pending.resolve(first.list); await pending.promise;});
        expect(container.textContent).toBe('Second tenant');
        expect(controller.error).toBeNull();
    });

    it('keeps the newer in-flight cache entry when an invalidated request finishes', async () => {
        const fixture = readOnlyFixture(false);
        const first = deferred<AdminListResponse>();
        const second = deferred<AdminListResponse>();
        vi.mocked(fixture.client.getItems).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        await render(fixture);
        let result!: Promise<void>;
        await act(async () => {result = controller.refresh();});
        const bucket = getClientCacheBucket(fixture.client);
        const key = buildListCacheKey('ledger', {limit: 50, offset: 0});
        const newer = bucket.inFlightListRequests.get(key);
        expect(newer).toBeDefined();
        await act(async () => {first.resolve(fixture.list); await first.promise;});
        expect(bucket.inFlightListRequests.get(key)).toBe(newer);
        expect(bucket.listResponseCache.has(key)).toBe(false);
        await act(async () => {second.resolve(fixture.list); await result;});
        expect(controller.rows).toEqual(fixture.list.items);
    });

    it('invalidates all-matching selection and its form after browser filter navigation', async () => {
        const fixture = withForm(readOnlyFixture(false));
        await render(fixture);
        await act(async () => controller.handleToggleSelection(1, true));
        await act(async () => controller.handleSelectAllMatching());
        await act(async () => controller.handleRunNamedBulkAction('recalculate'));
        const previous = controller;
        await render(fixture, '?q=changed');
        expect(controller.hasSelection).toBe(false);
        expect(controller.bulkActionFormOpen).toBe(false);
        await act(async () => previous.handleSubmitBulkActionForm({}));
        expect(fixture.client.runBulkAction).not.toHaveBeenCalled();
    });

    it('does not clear a newly selected row when an older bulk action refreshes the list', async () => {
        const fixture = readOnlyFixture(false);
        fixture.list.items.push({id: 2, name: 'Second row'});
        fixture.list.pagination.total = 2;
        const pending = deferred<{processed: number}>();
        vi.mocked(fixture.client.runBulkAction).mockReturnValue(pending.promise);
        await render(fixture);
        await act(async () => controller.handleToggleSelection(1, true));
        let result!: Promise<void>;
        await act(async () => {
            result = controller.handleRunNamedBulkAction('recalculate');
            await controller.handleRunNamedBulkAction('recalculate');
        });
        await act(async () => {controller.handleToggleSelection(1, false); controller.handleToggleSelection(2, true);});
        await act(async () => {pending.resolve({processed: 1}); await result;});
        expect(fixture.client.runBulkAction).toHaveBeenCalledTimes(1);
        expect(fixture.client.runBulkAction).toHaveBeenCalledWith('ledger', 'recalculate', [1], undefined, undefined);
        expect(controller.selectedIds).toEqual([2]);
        expect(controller.isBulkSubmitting).toBe(false);
    });

    it.each(['resolve', 'reject'] as const)('ignores a bulk %s from a replaced client', async (outcome) => {
        const first = readOnlyFixture(false);
        const second = readOnlyFixture(false);
        const pending = deferred<{processed: number}>();
        vi.mocked(first.client.runBulkAction).mockReturnValue(pending.promise);
        await render(first);
        await act(async () => controller.handleToggleSelection(1, true));
        let result!: Promise<void>;
        await act(async () => {result = controller.handleRunNamedBulkAction('recalculate');});
        await render(second);
        await act(async () => {
            if (outcome === 'resolve') pending.resolve({processed: 1});
            else pending.reject(new Error('Old action failed'));
            await result;
        });
        expect(first.client.getItems).toHaveBeenCalledTimes(1);
        expect(second.client.getItems).toHaveBeenCalledTimes(1);
        expect(messages.success).not.toHaveBeenCalled();
        expect(messages.error).not.toHaveBeenCalled();
        expect(controller.isBulkSubmitting).toBe(false);
    });

    it('suppresses callbacks inside a bulk form submit after unmount', async () => {
        const fixture = withForm(readOnlyFixture(false));
        const pending = deferred<{processed: number}>();
        vi.mocked(fixture.client.runBulkAction).mockReturnValue(pending.promise);
        await render(fixture);
        await act(async () => controller.handleToggleSelection(1, true));
        await act(async () => controller.handleRunNamedBulkAction('recalculate'));
        let result!: Promise<void>;
        await act(async () => {result = controller.handleSubmitBulkActionForm({name: 'Submitted'});});
        await act(async () => root.render(null));
        await act(async () => {pending.resolve({processed: 1}); await result;});
        expect(fixture.client.getItems).toHaveBeenCalledTimes(1);
        expect(messages.success).not.toHaveBeenCalled();
    });

    it('does not submit a stale selection callback after changing rows', async () => {
        const fixture = readOnlyFixture(false);
        await render(fixture);
        await act(async () => controller.handleToggleSelection(1, true));
        const previous = controller;
        await act(async () => controller.handleToggleSelection(1, false));
        await act(async () => previous.handleRunNamedBulkAction('recalculate'));
        expect(fixture.client.runBulkAction).not.toHaveBeenCalled();
    });
});

describe('delete preview lifecycle', () => {
    it('rejects an old confirmation callback after another target is opened', async () => {
        const fixture = readOnlyFixture(false);
        await render(fixture);
        await act(async () => controller.handleRowDelete(1));
        const previous = controller;
        await act(async () => controller.handleRowDelete(2));
        await act(async () => previous.handleConfirmDelete());
        expect(fixture.client.deleteItem).not.toHaveBeenCalled();
        await act(async () => controller.handleConfirmDelete());
        expect(fixture.client.deleteItem).toHaveBeenCalledWith('ledger', 2);
    });

    it('keeps the newest preview when two responses arrive in reverse order', async () => {
        const fixture = readOnlyFixture(false);
        const first = deferred<AdminDeletePreviewResponse>();
        const second = deferred<AdminDeletePreviewResponse>();
        const preview = await fixture.client.getDeletePreview('ledger', 2);
        vi.mocked(fixture.client.getDeletePreview).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        await render(fixture);
        let firstResult!: Promise<void>;
        let secondResult!: Promise<void>;
        await act(async () => {firstResult = controller.handleRowDelete(1);});
        await act(async () => {secondResult = controller.handleRowDelete(2);});
        await act(async () => {second.resolve(preview); await secondResult;});
        await act(async () => {first.resolve({...preview, can_delete: false}); await firstResult;});
        expect(controller.pendingDeleteIds).toEqual([2]);
        expect(controller.deletePreview?.can_delete).toBe(true);
    });

    it('cannot apply or confirm a preview after it was closed', async () => {
        const fixture = readOnlyFixture(false);
        const preview = await fixture.client.getDeletePreview('ledger', 1);
        const pending = deferred<AdminDeletePreviewResponse>();
        vi.mocked(fixture.client.getDeletePreview).mockReturnValue(pending.promise);
        await render(fixture);
        let result!: Promise<void>;
        await act(async () => {result = controller.handleRowDelete(1);});
        await act(async () => controller.handleClearDeletePreview());
        await act(async () => {pending.resolve(preview); await result; await controller.handleConfirmDelete();});
        expect(controller.deletePreviewOpen).toBe(false);
        expect(controller.deletePreview).toBeNull();
        expect(fixture.client.deleteItem).not.toHaveBeenCalled();
    });

    it('locks duplicate deletion and does not refresh a replaced workspace', async () => {
        const first = readOnlyFixture(false);
        const second = readOnlyFixture(false);
        const pending = deferred<void>();
        vi.mocked(first.client.deleteItem).mockReturnValue(pending.promise);
        await render(first);
        await act(async () => controller.handleRowDelete(1));
        let result!: Promise<void>;
        await act(async () => {result = controller.handleConfirmDelete(); await controller.handleConfirmDelete();});
        expect(first.client.deleteItem).toHaveBeenCalledTimes(1);
        await render(second);
        await act(async () => {pending.resolve(); await result;});
        expect(first.client.getItems).toHaveBeenCalledTimes(1);
        expect(second.client.getItems).toHaveBeenCalledTimes(1);
        expect(controller.isDeleteSubmitting).toBe(false);
        expect(messages.success).not.toHaveBeenCalled();
    });

    it('refreshes the current query after deletion without restoring its old preview or selection', async () => {
        const fixture = readOnlyFixture(false);
        const pending = deferred<void>();
        vi.mocked(fixture.client.deleteItem).mockReturnValue(pending.promise);
        await render(fixture);
        await act(async () => controller.handleRowDelete(1));
        let result!: Promise<void>;
        await act(async () => {result = controller.handleConfirmDelete();});
        await render(fixture, '?q=new');
        await act(async () => controller.handleToggleSelection(2, true));
        await act(async () => {pending.resolve(); await result;});
        expect(fixture.client.getItems).toHaveBeenCalledTimes(3);
        expect(vi.mocked(fixture.client.getItems).mock.lastCall?.[1]).toMatchObject({q: 'new'});
        expect(controller.selectedIds).toEqual([2]);
        expect(controller.deletePreviewOpen).toBe(false);
    });
});

it('keeps the bulk action dialog mounted while it exits', async () => {
    const fixture = withForm(readOnlyFixture(false));
    await act(async () => root.render(<AdminLocaleProvider locale="en"><ModelPage client={fixture.client} router={fixture.router} slug="ledger" basePath="/admin"/></AdminLocaleProvider>));
    const button = (name: string) => Array.from(document.querySelectorAll('button')).find((item) => item.textContent === name)!;
    await act(async () => container.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!.click());
    await act(async () => button('Actions').click());
    await act(async () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent === 'Recalculate')!.click());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    await act(async () => button('Cancel').click());
    expect(document.contains(dialog)).toBe(true);
    expect(dialog?.textContent).toContain('Recalculate');
});
