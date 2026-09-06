import {describe, expect, expectTypeOf, it, vi} from 'vitest';
import {createFetchAdminClient, type AdminClient} from './client';
import type {AdminItemResponse} from './types';

describe('fetch client', () => {
    it('passes query params and unwraps json payloads', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            meta: {page_size: 50},
            pagination: {limit: 50, offset: 0, total: 1},
            items: [{id: 1}],
        }), {status: 200}));
        const client = createFetchAdminClient({baseUrl: 'http://localhost:8000', fetch: fetchMock as typeof fetch});

        const response = await client.getItems('users', {q: 'alpha', status: 'true'});

        expect(response.items).toEqual([{id: 1}]);
        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:8000/xladmin/models/users/items/?q=alpha&status=true',
            expect.objectContaining({method: 'GET'}),
        );
    });

    it('surfaces backend error detail when request fails', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({detail: 'Access denied.'}), {status: 403}));
        const client = createFetchAdminClient({baseUrl: 'http://localhost:8000', fetch: fetchMock as typeof fetch});

        return expect(client.getModels()).rejects.toThrow('Access denied.');
    });

    it('sends select_all payload for bulk actions', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({processed: 12}), {status: 200}));
        const client = createFetchAdminClient({baseUrl: 'http://localhost:8000', fetch: fetchMock as typeof fetch});

        const response = await client.runBulkAction(
            'users',
            'activate',
            [],
            undefined,
            {
                selectAll: true,
                selectionScope: {
                    q: 'al',
                    filters: {status: 'false'},
                },
            },
        );

        expect(response.processed).toBe(12);
        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:8000/xladmin/models/users/bulk-actions/activate/',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    ids: [],
                    select_all: true,
                    selection_scope: {
                        q: 'al',
                        filters: {status: 'false'},
                    },
                }),
            }),
        );
    });

    it('loads bulk action choices from the action field endpoint', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({items: [{id: 1, label: 'Admin'}]}), {status: 200}));
        const client = createFetchAdminClient({baseUrl: 'http://localhost:8000', fetch: fetchMock as typeof fetch});

        const response = await client.getBulkActionChoices('users', 'assign-role', 'role_id', 'adm', [1, 2]);

        expect(response.items).toEqual([{id: 1, label: 'Admin'}]);
        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:8000/xladmin/models/users/bulk-actions/assign-role/fields/role_id/choices/?q=adm&ids=1%2C2',
            expect.objectContaining({method: 'GET'}),
        );
    });

    it('loads object action choices from the item action field endpoint', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({items: [{id: 7, label: 'Owner'}]}), {status: 200}));
        const client = createFetchAdminClient({baseUrl: 'http://localhost:8000', fetch: fetchMock as typeof fetch});

        const response = await client.getObjectActionChoices('users', 42, 'assign-role', 'role_id', 'own', [7]);

        expect(response.items).toEqual([{id: 7, label: 'Owner'}]);
        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:8000/xladmin/models/users/items/42/actions/assign-role/fields/role_id/choices/?q=own&ids=7',
            expect.objectContaining({method: 'GET'}),
        );
    });
});

describe('mutation response contract', () => {
    it.each(['createItem', 'patchItem'] as const)('%s returns only the item sent by the HTTP API', async (method) => {
        const payload = {name: 'Changed'};
        const response: AdminItemResponse = {item: {id: 17, ...payload}};
        const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(response));
        const client = createFetchAdminClient({baseUrl: 'http://admin.test/api', fetch});
        const result = method === 'createItem'
            ? await client.createItem('ledger', payload)
            : await client.patchItem('ledger', 17, payload);
        expect(result).toEqual(response);
        expect(result).not.toHaveProperty('meta');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][1]?.method).toBe(method === 'createItem' ? 'POST' : 'PATCH');
        expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual(payload);
    });

    it('does not promise metadata absent from mutation responses', () => {
        expectTypeOf<Awaited<ReturnType<AdminClient['createItem']>>>().toEqualTypeOf<AdminItemResponse>();
        expectTypeOf<Awaited<ReturnType<AdminClient['patchItem']>>>().toEqualTypeOf<AdminItemResponse>();
    });
});
