import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AdminTranslationKey} from '../i18n';
import {AdminLocaleProvider} from '../i18n';
import {FormDialog} from './FormDialog';
import {ModelPage, type ModelPageToolbarContext} from './ModelPage';
import {ObjectPage} from './ObjectPage';
import {useModelPageController} from './model-page/useModelPageController';
import {useObjectPageController} from './object-page/useObjectPageController';
import {readOnlyFixture} from './read-only-fixtures';

const t = (key: AdminTranslationKey) => key;
let container: HTMLDivElement;
let root: Root;

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
});

async function render(node: ReactNode) {
    await act(async () => root.render(<AdminLocaleProvider locale="en">{node}</AdminLocaleProvider>));
}

describe('read-only model UI', () => {
    it('keeps list navigation and export selection but hides write controls', async () => {
        const {client, router} = readOnlyFixture(true);
        const toolbar = vi.fn((_context: ModelPageToolbarContext) => null);
        await render(<ModelPage client={client} router={router} slug="ledger" basePath="/admin" renderBeforePagination={toolbar}/>);
        expect(container.querySelector('a[href="/admin/ledger/1"]')?.textContent).toBe('Receipt');
        expect(container.querySelector('button[aria-label="Create"]')).toBeNull();
        expect(container.querySelectorAll('tbody button')).toHaveLength(0);
        const checkbox = container.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!;
        await act(async () => checkbox.click());
        expect(toolbar.mock.lastCall?.[0]).toMatchObject({meta: {read_only: true}, selectedIds: [1], selectionCount: 1});
        expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Actions')).toBe(false);
    });

    it('renders object data without editors or mutation buttons', async () => {
        const {client, router} = readOnlyFixture(true);
        await render(<ObjectPage client={client} router={router} slug="ledger" id="1"/>);
        expect(container.textContent).toContain('Receipt');
        expect(container.querySelector('input')).toBeNull();
        expect(container.textContent).not.toContain('Recalculate');
        expect(container.textContent).not.toContain('Delete');
    });

    it.each(['create', 'patch'] as const)('closes %s form and disables its exiting submit after policy changes', async (mode) => {
        const {client, meta, item} = readOnlyFixture(false);
        const props = {client, meta, mode, itemId: 1, initialValues: item, slug: 'ledger', open: true, title: 'Edit', onClose: vi.fn(), onSuccess: vi.fn()};
        await render(<FormDialog {...props}/>);
        const save = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Save')!;
        expect(save).toBeDefined();
        await render(<FormDialog {...props} meta={{...meta, read_only: true}}/>);
        expect(save.disabled).toBe(true);
        await act(async () => save.click());
        expect(client.createItem).not.toHaveBeenCalled();
        expect(client.patchItem).not.toHaveBeenCalled();
        expect(props.onSuccess).not.toHaveBeenCalled();
    });
});

describe('read-only mutation handlers', () => {
    it('blocks object writes even when handlers are invoked directly', async () => {
        const {client, router} = readOnlyFixture(true);
        let controller!: ReturnType<typeof useObjectPageController>;
        function Harness() {
            controller = useObjectPageController({client, router, slug: 'ledger', id: '1', listPath: '/admin/ledger', t});
            return null;
        }
        await render(<Harness/>);
        await act(async () => {
            controller.handleFieldChange('name', 'Changed');
            await controller.handleSave();
            await controller.handleOpenDeletePreview();
            await controller.handleDelete();
            await controller.handleRunObjectAction('recalculate');
            await controller.handleSubmitObjectActionForm({name: 'Changed'});
        });
        expect(controller.values.name).toBe('Receipt');
        expect(controller.editableFieldNames.size).toBe(0);
        expect(client.patchItem).not.toHaveBeenCalled();
        expect(client.deleteItem).not.toHaveBeenCalled();
        expect(client.getDeletePreview).not.toHaveBeenCalled();
        expect(client.runObjectAction).not.toHaveBeenCalled();
    });

    it('rejects pending deletion and bulk actions after refreshed metadata becomes read-only', async () => {
        const {client, router, list, meta} = readOnlyFixture(false);
        let controller!: ReturnType<typeof useModelPageController>;
        function Harness() {
            controller = useModelPageController({client, router, slug: 'ledger', pathname: '/admin/ledger', locationSearch: '', t});
            return null;
        }
        await render(<Harness/>);
        await act(async () => controller.handleToggleSelection(1, true));
        await act(async () => controller.handleRunNamedBulkAction('delete'));
        expect(client.getBulkDeletePreview).toHaveBeenCalledTimes(1);
        vi.mocked(client.getItems).mockResolvedValue({...list, meta: {...meta, read_only: true}});
        await act(async () => controller.refresh());
        expect(controller.canWrite).toBe(false);
        await act(async () => {
            await controller.handleConfirmDelete();
            await controller.handleRowDelete(1);
            await controller.handleRunNamedBulkAction('recalculate');
            await controller.handleSubmitBulkActionForm({});
        });
        expect(client.bulkDelete).not.toHaveBeenCalled();
        expect(client.deleteItem).not.toHaveBeenCalled();
        expect(client.runBulkAction).not.toHaveBeenCalled();
        expect(client.getDeletePreview).not.toHaveBeenCalled();
    });

    it('preserves save, object actions and delete for writable models', async () => {
        const {client, router} = readOnlyFixture(false);
        let controller!: ReturnType<typeof useObjectPageController>;
        function Harness() {
            controller = useObjectPageController({client, router, slug: 'ledger', id: '1', listPath: '/admin/ledger', t});
            return null;
        }
        await render(<Harness/>);
        await act(async () => controller.handleFieldChange('name', 'Changed'));
        await act(async () => controller.handleSave());
        expect(client.patchItem).toHaveBeenCalledWith('ledger', '1', {name: 'Changed'});
        await act(async () => controller.handleRunObjectAction('recalculate'));
        await act(async () => controller.handleOpenDeletePreview());
        await act(async () => controller.handleDelete());
        expect(client.runObjectAction).toHaveBeenCalledWith('ledger', '1', 'recalculate');
        expect(client.deleteItem).toHaveBeenCalledWith('ledger', '1');
    });
});
