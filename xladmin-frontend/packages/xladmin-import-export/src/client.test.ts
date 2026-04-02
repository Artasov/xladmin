import {describe, expect, it, vi} from 'vitest';
import {
    type AdminImportExportAxiosLike,
    createAxiosAdminImportExportClient,
    createFetchAdminImportExportClient,
    type ImportValidationResponse,
} from './client';

describe('xladmin-import-export client', () => {
    it('reads export filename from content-disposition', async () => {
        const fetchMock = vi.fn(async () => new Response(
            new Blob(['[]'], {type: 'application/json'}),
            {
                status: 200,
                headers: {
                    'Content-Disposition': 'attachment; filename="widgets-export.json"',
                },
            },
        ));
        const client = createFetchAdminImportExportClient({
            baseUrl: 'https://example.com',
            fetch: fetchMock as typeof fetch,
        });

        const result = await client.downloadExport('widgets', {
            format: 'json',
            fields: ['id'],
            ids: [1],
        });

        expect(result.filename).toBe('widgets-export.json');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sends import payload as form-data', async () => {
        const postMock = vi.fn(async () => ({
            data: {
                summary: {total_rows: 1, create: 1, update: 0, skip: 0, errors: 0},
                created_preview: [],
                updated_preview: [],
                skipped_preview: [],
                errors: [],
            } satisfies ImportValidationResponse,
        }));
        const post = postMock as unknown as AdminImportExportAxiosLike['post'];
        const client = createAxiosAdminImportExportClient({
            get: vi.fn(),
            post,
        });

        await client.validateImport('widgets', {
            file: new File(['[]'], 'widgets.json', {type: 'application/json'}),
            format: 'json',
            fields: ['id', 'name'],
            conflict_mode: 'update_existing',
        });

        expect(postMock).toHaveBeenCalledTimes(1);
        const firstCall = postMock.mock.calls[0] as unknown[];
        const formData = firstCall[1] as FormData;
        expect(formData).toBeInstanceOf(FormData);
        expect(formData.get('format')).toBe('json');
        expect(formData.get('conflict_mode')).toBe('update_existing');
        expect(formData.get('fields')).toBe('["id","name"]');
    });
});
