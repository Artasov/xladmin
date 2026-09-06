import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {ModelPageToolbarContext} from 'xladmin';
import {readOnlyFixture} from '../../../xladmin-core/src/components/read-only-fixtures';
import {createFetchAdminImportExportClient, type ImportExportMetaResponse} from '../client';
import {ModelImportExportActions} from './ModelImportExportActions';

vi.mock('xladmin', () => ({useAdminLocale: () => 'en'}));

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

function fixture(readOnly: boolean, importFormats: ImportExportMetaResponse['import_formats'] = ['csv']) {
    const core = readOnlyFixture(readOnly);
    const context: ModelPageToolbarContext = {
        client: core.client, slug: 'ledger', meta: core.meta, selectedIds: [1],
        isAllMatchingSelected: false, selectionCount: 1, total: 5,
        appliedQuery: '', sortValue: '', appliedFilters: {}, refresh: vi.fn(),
    };
    const client = createFetchAdminImportExportClient({baseUrl: '/admin-api'});
    const fields = [{name: 'name', label: 'Name', default_selected: true}];
    vi.spyOn(client, 'getMeta').mockResolvedValue({
        model_slug: 'ledger', export_formats: ['csv'], import_formats: importFormats,
        export_fields: fields, import_fields: fields, pk_field: 'id', pk_type: 'integer',
        available_conflict_modes: ['update_existing'],
    });
    vi.spyOn(client, 'validateImport').mockResolvedValue({
        summary: {total_rows: 1, create: 1, update: 0, skip: 0, errors: 0},
        created_preview: [], updated_preview: [], skipped_preview: [], errors: [],
    });
    vi.spyOn(client, 'commitImport').mockResolvedValue({created: 1, updated: 0, skipped: 0});
    return {client, context};
}

function button(label: string) {
    return Array.from(document.querySelectorAll('button')).find((item) => item.textContent === label)!;
}

it.each([true, false])('keeps export available when import is forbidden (model readonly=%s)', async (readOnly) => {
    const {client, context} = fixture(readOnly, readOnly ? ['csv'] : []);
    await act(async () => root.render(<ModelImportExportActions client={client} context={context}/>));
    expect(container.querySelector('button[aria-label="Import"]')).toBeNull();
    const exportButton = container.querySelector<HTMLButtonElement>('button[aria-label="Export"]')!;
    expect(exportButton).not.toBeNull();
    await act(async () => exportButton.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Name');
    expect(button('Export').disabled).toBe(false);
    expect(client.validateImport).not.toHaveBeenCalled();
    expect(client.commitImport).not.toHaveBeenCalled();
});

it.each([true, false])('checks current model policy before committing a validated import (readonly=%s)', async (readOnly) => {
    const {client, context} = fixture(false);
    await act(async () => root.render(<ModelImportExportActions client={client} context={context}/>));
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Import"]')!.click());
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(fileInput, 'files', {value: [new File(['name\nReceipt'], 'ledger.csv', {type: 'text/csv'})]});
    await act(async () => fileInput.dispatchEvent(new Event('change', {bubbles: true})));
    await act(async () => button('Validate').click());
    expect(client.validateImport).toHaveBeenCalledTimes(1);
    const commit = button('Confirm import');
    expect(commit.disabled).toBe(false);
    await act(async () => root.render(<ModelImportExportActions client={client} context={{...context, meta: {...context.meta, read_only: readOnly}}}/>));
    expect(commit.disabled).toBe(readOnly);
    await act(async () => commit.click());
    expect(client.commitImport).toHaveBeenCalledTimes(readOnly ? 0 : 1);
    expect(context.refresh).toHaveBeenCalledTimes(readOnly ? 0 : 1);
});
