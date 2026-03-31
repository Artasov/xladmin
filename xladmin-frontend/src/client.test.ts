import {describe, expect, it, vi} from 'vitest';
import {createFetchXLAdminClient} from './client';

describe('fetch client', () => {
    it('passes query params and unwraps json payloads', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            meta: {page_size: 50},
            pagination: {limit: 50, offset: 0, total: 1},
            items: [{id: 1}],
        }), {status: 200}));
        const client = createFetchXLAdminClient({baseUrl: 'http://localhost:8000', fetch: fetchMock as typeof fetch});

        const response = await client.getItems('users', {q: 'alpha', status: 'true'});

        expect(response.items).toEqual([{id: 1}]);
        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:8000/xladmin/models/users/items/?q=alpha&status=true',
            expect.objectContaining({method: 'GET'}),
        );
    });

    it('surfaces backend error detail when request fails', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({detail: 'Access denied.'}), {status: 403}));
        const client = createFetchXLAdminClient({baseUrl: 'http://localhost:8000', fetch: fetchMock as typeof fetch});

        await expect(client.getModels()).rejects.toThrow('Access denied.');
    });
});
