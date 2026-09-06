import {act, StrictMode, useLayoutEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {buildDetailCacheKey, getClientCacheBucket, setCachedDetailResponse} from '../../cache';
import {createFetchAdminClient} from '../../client';
import {AdminLocaleProvider, type AdminTranslationKey} from '../../i18n';
import type {AdminDeletePreviewResponse, AdminDetailResponse, AdminItemResponse, AdminObjectActionResponse} from '../../types';
import {ObjectPage} from '../ObjectPage';
import {readOnlyFixture} from '../read-only-fixtures';
import {useObjectPageController} from './useObjectPageController';

const messages = vi.hoisted(() => ({success: vi.fn(), error: vi.fn()}));
vi.mock('../layout/AdminMessageContext', () => ({useAdminMessage: () => messages}));
type Fixture = ReturnType<typeof readOnlyFixture>;
type Controller = ReturnType<typeof useObjectPageController>;
const t = (key: AdminTranslationKey) => key;
let root: Root;
let container: HTMLDivElement;
let controller: Controller;

function Harness({fixture, id, translate}: {fixture: Fixture; id: string; translate: typeof t}) {
    const current = useObjectPageController({client: fixture.client, router: fixture.router, slug: 'ledger', id, listPath: '/admin/ledger', t: translate});
    useLayoutEffect(() => {controller = current;}, [current]);
    return <output>{String(current.values.name ?? '')}</output>;
}
async function render(fixture: Fixture, id = '1', translate = t) {
    await act(async () => root.render(<StrictMode><Harness fixture={fixture} id={id} translate={translate}/></StrictMode>));
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
}
function withForm(fixture = readOnlyFixture(false)) {
    fixture.meta.object_actions[0].form = fixture.meta.fields.map((field) => ({...field, placeholder: null, options: [], auto_now: false}));
    return fixture;
}
function preview(canDelete = true): AdminDeletePreviewResponse {
    return {can_delete: canDelete, summary: {roots: 1, delete: 1, protect: canDelete ? 0 : 1, set_null: 0, total: 1}, roots: []};
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

describe('object operation lifecycle', () => {
    it('saves through the real fetch client with the item-only HTTP mutation response', async () => {
        const fixture = readOnlyFixture(false);
        const item = {id: 1, name: 'Saved over HTTP'};
        const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) =>
            Response.json(init?.method === 'PATCH' ? {item} : fixture.detail),
        );
        fixture.client = createFetchAdminClient({baseUrl: 'http://admin.test/api', fetch});
        await render(fixture);
        await act(async () => controller.handleFieldChange('name', item.name));
        await act(async () => controller.handleSave());
        expect(controller.error).toBeNull();
        expect(controller.isDirty).toBe(false);
        expect(controller.values).toEqual(item);
        expect(controller.meta).toEqual(fixture.meta);
        expect(messages.success).toHaveBeenCalledTimes(1);
        expect(messages.error).not.toHaveBeenCalled();
        expect(getClientCacheBucket(fixture.client).detailResponseCache.get(buildDetailCacheKey('ledger', '1'))).toEqual({meta: fixture.meta, item});
    });

    it('does not replace a newer preview with a late response', async () => {
        const fixture = readOnlyFixture(false);
        const first = deferred<AdminDeletePreviewResponse>();
        const second = deferred<AdminDeletePreviewResponse>();
        vi.mocked(fixture.client.getDeletePreview).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        await render(fixture);
        let oldRequest!: Promise<void>;
        let newRequest!: Promise<void>;
        await act(async () => {oldRequest = controller.handleOpenDeletePreview();});
        await act(async () => {controller.handleCloseDeletePreview();});
        await act(async () => {newRequest = controller.handleOpenDeletePreview();});
        await act(async () => {second.resolve(preview(false)); await newRequest;});
        await act(async () => {first.resolve(preview()); await oldRequest;});
        expect(controller.deletePreview?.can_delete).toBe(false);
        expect(controller.isDeletePreviewLoading).toBe(false);
        await act(async () => controller.handleDelete());
        expect(fixture.client.deleteItem).not.toHaveBeenCalled();
    });

    it('ignores closed preview errors and keeps a newer preview loading', async () => {
        const fixture = readOnlyFixture(false);
        const first = deferred<AdminDeletePreviewResponse>();
        const second = deferred<AdminDeletePreviewResponse>();
        vi.mocked(fixture.client.getDeletePreview).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        await render(fixture);
        let oldRequest!: Promise<void>;
        let newRequest!: Promise<void>;
        await act(async () => {oldRequest = controller.handleOpenDeletePreview();});
        await act(async () => controller.handleCloseDeletePreview());
        await act(async () => {newRequest = controller.handleOpenDeletePreview();});
        await act(async () => {first.reject(new Error('Old preview')); await oldRequest;});
        expect(controller.deletePreviewError).toBeNull();
        expect(controller.isDeletePreviewLoading).toBe(true);
        await act(async () => {second.resolve(preview()); await newRequest;});
        expect(controller.deletePreview?.can_delete).toBe(true);
    });

    it('requires the current ready preview and serializes repeated delete calls', async () => {
        const fixture = readOnlyFixture(false);
        const pending = deferred<void>();
        vi.mocked(fixture.client.deleteItem).mockReturnValue(pending.promise);
        await render(fixture);
        await act(async () => controller.handleDelete());
        expect(fixture.client.deleteItem).not.toHaveBeenCalled();
        await act(async () => controller.handleOpenDeletePreview());
        const oldConfirm = controller.handleDelete;
        await act(async () => controller.handleCloseDeletePreview());
        await act(async () => controller.handleOpenDeletePreview());
        await act(async () => oldConfirm());
        expect(fixture.client.deleteItem).not.toHaveBeenCalled();
        let operation!: Promise<void>;
        await act(async () => {operation = controller.handleDelete(); void controller.handleDelete(); void controller.handleRunObjectAction('recalculate');});
        expect(fixture.client.deleteItem).toHaveBeenCalledTimes(1);
        expect(fixture.client.runObjectAction).not.toHaveBeenCalled();
        await act(async () => {pending.resolve(); await operation;});
        expect(fixture.router.push).toHaveBeenCalledTimes(1);
        expect(controller.canWrite).toBe(false);
        await act(async () => {await controller.handleOpenDeletePreview(); await controller.handleDelete();});
        expect(fixture.client.deleteItem).toHaveBeenCalledTimes(1);
    });

    it('blocks a captured confirm immediately when a new preview starts', async () => {
        const fixture = readOnlyFixture(false);
        await render(fixture);
        await act(async () => controller.handleOpenDeletePreview());
        const confirm = controller.handleDelete;
        const pending = deferred<AdminDeletePreviewResponse>();
        vi.mocked(fixture.client.getDeletePreview).mockReturnValue(pending.promise);
        let request!: Promise<void>;
        await act(async () => {request = controller.handleOpenDeletePreview(); await confirm();});
        expect(fixture.client.deleteItem).not.toHaveBeenCalled();
        await act(async () => {pending.resolve(preview()); await request;});
    });

    it('locks edits and competing mutations during save and retains the loaded metadata', async () => {
        const fixture = readOnlyFixture(false);
        const pending = deferred<AdminItemResponse>();
        vi.mocked(fixture.client.patchItem).mockReturnValue(pending.promise);
        await render(fixture);
        await act(async () => controller.handleFieldChange('name', 'Saved draft'));
        let operation!: Promise<void>;
        await act(async () => {
            operation = controller.handleSave();
            void controller.handleSave();
            void controller.handleRunObjectAction('recalculate');
            void controller.handleOpenDeletePreview();
            controller.handleFieldChange('name', 'Must not overwrite');
        });
        expect(controller.values.name).toBe('Saved draft');
        expect(controller.isMutating).toBe(true);
        expect(fixture.client.patchItem).toHaveBeenCalledTimes(1);
        expect(fixture.client.runObjectAction).not.toHaveBeenCalled();
        expect(fixture.client.getDeletePreview).not.toHaveBeenCalled();
        await act(async () => {pending.resolve({item: {...fixture.item, name: 'Saved draft'}}); await operation;});
        expect(controller.canWrite).toBe(true);
        expect(controller.isDirty).toBe(false);
        expect(controller.meta).toBe(fixture.meta);
        expect(controller.isMutating).toBe(false);
    });

    it.each(['resolve', 'reject'] as const)('retires closed action callbacks on %s and permits a fresh opening after completion', async (outcome) => {
        const fixture = withForm();
        const pending = deferred<AdminObjectActionResponse>();
        vi.mocked(fixture.client.runObjectAction).mockReturnValueOnce(pending.promise);
        await render(fixture);
        await act(async () => controller.handleRunObjectAction('recalculate'));
        const oldSubmit = controller.handleSubmitObjectActionForm;
        let operation!: Promise<void>;
        await act(async () => {operation = oldSubmit({name: 'Old action'}); void oldSubmit({name: 'Duplicate'});});
        await act(async () => controller.handleCloseObjectActionForm());
        expect(controller.objectActionFormOpen).toBe(false);
        expect(controller.activeObjectAction).not.toBeNull();
        await act(async () => controller.handleRunObjectAction('recalculate'));
        expect(controller.objectActionFormOpen).toBe(false);
        await act(async () => {
            if (outcome === 'resolve') pending.resolve({item: {id: 1, name: 'Late action'}, result: {}});
            else pending.reject(new Error('Late failure'));
            await operation;
        });
        expect(controller.values.name).toBe(outcome === 'resolve' ? 'Late action' : 'Receipt');
        expect(messages.success).not.toHaveBeenCalled();
        expect(messages.error).not.toHaveBeenCalled();
        if (outcome === 'resolve') expect(getClientCacheBucket(fixture.client).detailResponseCache.get(buildDetailCacheKey('ledger', '1'))?.item.name).toBe('Late action');
        await act(async () => controller.handleRunObjectAction('recalculate'));
        await act(async () => oldSubmit({name: 'Retired opening'}));
        expect(controller.objectActionFormOpen).toBe(true);
        expect(fixture.client.runObjectAction).toHaveBeenCalledTimes(1);
        await act(async () => controller.handleSubmitObjectActionForm({name: 'Fresh'}));
        expect(fixture.client.runObjectAction).toHaveBeenCalledTimes(2);
        expect(controller.objectActionFormOpen).toBe(false);
        expect(controller.activeObjectAction).not.toBeNull();
    });

    it('keeps the active action form open on failure and releases its mutation lock', async () => {
        const fixture = withForm();
        vi.mocked(fixture.client.runObjectAction).mockRejectedValueOnce(new Error('Action failed'));
        await render(fixture);
        await act(async () => controller.handleRunObjectAction('recalculate'));
        await act(async () => {await expect(controller.handleSubmitObjectActionForm({})).rejects.toThrow('Action failed');});
        expect(controller.objectActionFormOpen).toBe(true);
        expect(controller.isMutating).toBe(false);
        await act(async () => controller.handleSubmitObjectActionForm({}));
        expect(controller.objectActionFormOpen).toBe(false);
    });

    it('preserves dirty card fields while refreshing the result of a closed action', async () => {
        const fixture = withForm();
        const pending = deferred<AdminObjectActionResponse>();
        vi.mocked(fixture.client.runObjectAction).mockReturnValue(pending.promise);
        await render(fixture);
        await act(async () => controller.handleFieldChange('name', 'Unsaved card name'));
        await act(async () => controller.handleRunObjectAction('recalculate'));
        let operation!: Promise<void>;
        await act(async () => {operation = controller.handleSubmitObjectActionForm({});});
        await act(async () => controller.handleCloseObjectActionForm());
        await act(async () => {pending.resolve({item: {id: 1, name: 'Server name', total: 42}, result: {}}); await operation;});
        expect(controller.values).toEqual({id: 1, name: 'Unsaved card name', total: 42});
        expect(controller.initialValues.name).toBe('Server name');
        expect(controller.isDirty).toBe(true);
        expect(controller.objectActionFormOpen).toBe(false);
        expect(messages.success).not.toHaveBeenCalled();
        expect(getClientCacheBucket(fixture.client).detailResponseCache.get(buildDetailCacheKey('ledger', '1'))?.item.name).toBe('Server name');
    });

    it('resets a cached workspace without remount and invalidates the retired mutation cache', async () => {
        const first = withForm();
        const second = withForm();
        second.item.name = 'Other tenant';
        setCachedDetailResponse(second.client, buildDetailCacheKey('ledger', '1'), second.detail);
        const pending = deferred<AdminObjectActionResponse>();
        vi.mocked(first.client.runObjectAction).mockReturnValue(pending.promise);
        await render(first);
        await act(async () => controller.handleRunObjectAction('recalculate'));
        let operation!: Promise<void>;
        await act(async () => {operation = controller.handleSubmitObjectActionForm({name: 'First'});});
        const previous = controller;
        await render(second);
        expect(controller.isMutating).toBe(false);
        expect(controller.objectActionFormOpen).toBe(false);
        expect(controller.activeObjectAction).toBeNull();
        expect(controller.values.name).toBe('Other tenant');
        await act(async () => {previous.handleFieldChange('name', 'Late edit'); previous.handleCloseObjectActionForm(); await previous.handleOpenDeletePreview();});
        await act(async () => {pending.resolve({item: {id: 1, name: 'First done'}, result: {}}); await operation;});
        expect(controller.values.name).toBe('Other tenant');
        expect(getClientCacheBucket(first.client).detailResponseCache.size).toBe(0);
        expect(getClientCacheBucket(second.client).detailResponseCache.get(buildDetailCacheKey('ledger', '1'))).toBe(second.detail);
        expect(messages.success).not.toHaveBeenCalled();
    });

    it('does not reset a dirty card when the translator reference changes', async () => {
        const fixture = readOnlyFixture(false);
        await render(fixture);
        await act(async () => controller.handleFieldChange('name', 'Unsaved'));
        await render(fixture, '1', (key) => key);
        expect(controller.values.name).toBe('Unsaved');
        expect(controller.isDirty).toBe(true);
        expect(fixture.client.getItem).toHaveBeenCalledTimes(1);
    });

    it('clears an old card while another ID loads and ignores its old handlers', async () => {
        const fixture = readOnlyFixture(false);
        await render(fixture);
        const previous = controller;
        const pending = deferred<AdminDetailResponse>();
        vi.mocked(fixture.client.getItem).mockReturnValue(pending.promise);
        await render(fixture, '2');
        expect(controller.data).toBeNull();
        expect(controller.canWrite).toBe(false);
        expect(container.textContent).toBe('');
        await act(async () => previous.handleRunObjectAction('recalculate'));
        expect(fixture.client.runObjectAction).not.toHaveBeenCalled();
        await act(async () => {pending.resolve({...fixture.detail, item: {id: 2, name: 'New card'}}); await pending.promise;});
        expect(controller.values.name).toBe('New card');
    });

    it('does not send unknown object actions', async () => {
        const fixture = readOnlyFixture(false);
        await render(fixture);
        await act(async () => controller.handleRunObjectAction('not-in-metadata'));
        expect(fixture.client.runObjectAction).not.toHaveBeenCalled();
    });

    it('retains the actual action dialog during its exit animation', async () => {
        const fixture = withForm();
        await act(async () => root.render(<AdminLocaleProvider locale='en'><ObjectPage client={fixture.client} router={fixture.router} slug='ledger' id='1'/></AdminLocaleProvider>));
        const action = Array.from(document.querySelectorAll('button')).find((node) => node.textContent === 'Recalculate');
        expect(action).toBeDefined();
        await act(async () => action!.click());
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        const cancel = Array.from(dialog!.querySelectorAll('button')).find((node) => node.textContent === 'Cancel');
        await act(async () => cancel!.click());
        expect(document.querySelector('[role="dialog"]')).toBe(dialog);
    });
});
