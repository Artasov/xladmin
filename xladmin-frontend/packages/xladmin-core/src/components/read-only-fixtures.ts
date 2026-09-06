import {vi} from 'vitest';
import {createFetchAdminClient} from '../client';
import type {AdminModelMeta} from '../types';
import type {AdminRouter} from '../router';

export function readOnlyFixture(readOnly: boolean) {
    // Deliberately retain writable fields/actions: model policy must win.
    const meta: AdminModelMeta = {
        slug: 'ledger', title: 'Ledger', locale: 'en', read_only: readOnly,
        pk_field: 'id', display_field: 'name', page_size: 50, list_filters: [],
        list_fields: ['name'], detail_fields: ['name'], create_fields: ['name'],
        update_fields: ['name'], create_form: null,
        bulk_actions: [{slug: 'delete', label: 'Delete', form: null}, {slug: 'recalculate', label: 'Recalculate', form: null}],
        object_actions: [{slug: 'recalculate', label: 'Recalculate', form: null}],
        fields: [{
            name: 'name', label: 'Name', help_text: null, required: true, nullable: false,
            read_only: false, type: 'text', input_kind: 'text', has_choices: false,
            is_relation_many: false, display_kind: 'text', hidden_in_list: false,
            hidden_in_detail: false, hidden_in_form: false, hidden_in_create: false,
            hidden_in_update: false, is_primary_key: false, is_virtual: false,
            is_relation: false, is_sortable: true,
        }],
    };
    const item = {id: 1, name: 'Receipt'};
    const detail = {meta, item};
    const list = {meta, items: [item], pagination: {limit: 50, offset: 0, total: 1}};
    const client = createFetchAdminClient({baseUrl: '/admin-api'});
    vi.spyOn(client, 'getItems').mockResolvedValue(list);
    vi.spyOn(client, 'getItem').mockResolvedValue(detail);
    vi.spyOn(client, 'createItem').mockResolvedValue({item});
    vi.spyOn(client, 'patchItem').mockResolvedValue({item});
    vi.spyOn(client, 'deleteItem').mockResolvedValue(undefined);
    vi.spyOn(client, 'bulkDelete').mockResolvedValue({deleted: 1});
    vi.spyOn(client, 'runBulkAction').mockResolvedValue({processed: 1});
    vi.spyOn(client, 'runObjectAction').mockResolvedValue({item, result: {}});
    const preview = {can_delete: true, summary: {roots: 1, delete: 1, protect: 0, set_null: 0, total: 1}, roots: []};
    vi.spyOn(client, 'getDeletePreview').mockResolvedValue(preview);
    vi.spyOn(client, 'getBulkDeletePreview').mockResolvedValue(preview);
    const router: AdminRouter = {
        resolveHref: (href) => href,
        getLocation: () => ({pathname: '/admin/ledger', search: ''}),
        subscribe: () => () => undefined, push: vi.fn(), replace: vi.fn(), back: vi.fn(),
    };
    return {meta, item, detail, list, client, router};
}
