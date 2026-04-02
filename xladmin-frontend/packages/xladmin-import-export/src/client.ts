import type {XLAdminRequestOptions} from 'xladmin';

export type ImportExportFieldMeta = {
    name: string;
    label: string;
    default_selected: boolean;
};

export type ImportConflictMode = 'auto_generate_pk' | 'update_existing' | 'skip_existing';
export type ImportExportFormat = 'xlsx' | 'csv' | 'json';

export type ImportExportMetaResponse = {
    model_slug: string;
    export_formats: ImportExportFormat[];
    import_formats: ImportExportFormat[];
    export_fields: ImportExportFieldMeta[];
    import_fields: ImportExportFieldMeta[];
    pk_field: string;
    pk_type: string;
    available_conflict_modes: ImportConflictMode[];
};

export type ImportValidationResponse = {
    summary: {
        total_rows: number;
        create: number;
        update: number;
        skip: number;
        errors: number;
    };
    created_preview: Array<{row_number: number; label: string}>;
    updated_preview: Array<{row_number: number; label: string}>;
    skipped_preview: Array<{row_number: number; label: string}>;
    errors: Array<{row_number: number; field?: string | null; message: string}>;
};

export type ImportCommitResponse = {
    created: number;
    updated: number;
    skipped: number;
};

export type ImportExportSelectionScope = {
    q?: string;
    sort?: string;
    filters?: Record<string, string>;
};

export type ExportRequestPayload = {
    format: ImportExportFormat;
    fields: string[];
    ids: Array<string | number>;
    select_all?: boolean;
    selection_scope?: ImportExportSelectionScope;
};

export type ImportRequestPayload = {
    file: File;
    format: ImportExportFormat;
    fields: string[];
    conflict_mode: ImportConflictMode;
};

export type DownloadExportResponse = {
    blob: Blob;
    filename: string;
};

export type XLAdminImportExportAxiosLike = {
    get: <T>(url: string, config?: {signal?: AbortSignal}) => Promise<{data: T} | T>;
    post: <T>(
        url: string,
        body?: unknown,
        config?: {
            signal?: AbortSignal;
            headers?: Record<string, string>;
            responseType?: 'blob';
        },
    ) => Promise<{data: T; headers?: Record<string, string>} | T>;
};

export type XLAdminImportExportClient = {
    getMeta: (slug: string, options?: XLAdminRequestOptions) => Promise<ImportExportMetaResponse>;
    downloadExport: (slug: string, payload: ExportRequestPayload, options?: XLAdminRequestOptions) => Promise<DownloadExportResponse>;
    validateImport: (slug: string, payload: ImportRequestPayload, options?: XLAdminRequestOptions) => Promise<ImportValidationResponse>;
    commitImport: (slug: string, payload: ImportRequestPayload, options?: XLAdminRequestOptions) => Promise<ImportCommitResponse>;
};

export type XLAdminImportExportFetchClientConfig = {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
    headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
    credentials?: RequestCredentials;
};

export function createAxiosXLAdminImportExportClient(api: XLAdminImportExportAxiosLike): XLAdminImportExportClient {
    return {
        async getMeta(slug, options) {
            return unwrap(await api.get<ImportExportMetaResponse>(`/xladmin/models/${slug}/import-export/meta/`, {
                signal: options?.signal,
            }));
        },
        async downloadExport(slug, payload, options) {
            const response = await api.post<Blob>(
                `/xladmin/models/${slug}/export/`,
                payload,
                {
                    signal: options?.signal,
                    responseType: 'blob',
                },
            );
            const headers = isWrappedResponse(response) && response.headers ? response.headers : undefined;
            const blob = unwrap(response);
            return {
                blob,
                filename: resolveFilename(headers) ?? `${slug}-export.${payload.format}`,
            };
        },
        async validateImport(slug, payload, options) {
            return unwrap(await api.post<ImportValidationResponse>(
                `/xladmin/models/${slug}/import/validate/`,
                await buildImportFormData(payload),
                {
                    signal: options?.signal,
                    headers: {},
                },
            ));
        },
        async commitImport(slug, payload, options) {
            return unwrap(await api.post<ImportCommitResponse>(
                `/xladmin/models/${slug}/import/commit/`,
                await buildImportFormData(payload),
                {
                    signal: options?.signal,
                    headers: {},
                },
            ));
        },
    };
}

export function createFetchXLAdminImportExportClient(
    config: XLAdminImportExportFetchClientConfig,
): XLAdminImportExportClient {
    const fetchImpl = config.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
        throw new Error('Fetch API is not available in the current environment.');
    }

    return {
        async getMeta(slug, options) {
            return await requestJson<ImportExportMetaResponse>(fetchImpl, config, 'GET', `/xladmin/models/${slug}/import-export/meta/`, undefined, options?.signal);
        },
        async downloadExport(slug, payload, options) {
            const response = await request(fetchImpl, config, 'POST', `/xladmin/models/${slug}/export/`, payload, options?.signal);
            return {
                blob: await response.blob(),
                filename: resolveFilename(headersToRecord(response.headers)) ?? `${slug}-export.${payload.format}`,
            };
        },
        async validateImport(slug, payload, options) {
            return await requestJson<ImportValidationResponse>(
                fetchImpl,
                config,
                'POST',
                `/xladmin/models/${slug}/import/validate/`,
                await buildImportFormData(payload),
                options?.signal,
            );
        },
        async commitImport(slug, payload, options) {
            return await requestJson<ImportCommitResponse>(
                fetchImpl,
                config,
                'POST',
                `/xladmin/models/${slug}/import/commit/`,
                await buildImportFormData(payload),
                options?.signal,
            );
        },
    };
}

async function buildImportFormData(payload: ImportRequestPayload): Promise<FormData> {
    const formData = new FormData();
    formData.append('file', await createStableUploadFile(payload.file), payload.file.name);
    formData.append('format', payload.format);
    formData.append('conflict_mode', payload.conflict_mode);
    formData.append('fields', JSON.stringify(payload.fields));
    return formData;
}

async function createStableUploadFile(file: File): Promise<File> {
    const buffer = await file.arrayBuffer();
    return new File([buffer], file.name, {
        type: file.type,
        lastModified: file.lastModified,
    });
}

function isWrappedResponse<T>(response: {data: T} | T): response is {data: T; headers?: Record<string, string>} {
    return typeof response === 'object' && response !== null && 'data' in response;
}

function unwrap<T>(response: {data: T} | T): T {
    return isWrappedResponse(response) ? response.data : response as T;
}

function resolveFilename(headers?: Record<string, string>): string | null {
    const contentDisposition = headers?.['content-disposition'] ?? headers?.['Content-Disposition'];
    if (!contentDisposition) {
        return null;
    }
    const match = /filename="([^"]+)"/.exec(contentDisposition);
    return match?.[1] ?? null;
}

function headersToRecord(headers: Headers): Record<string, string> {
    const normalizedHeaders: Record<string, string> = {};
    headers.forEach((value, key) => {
        normalizedHeaders[key] = value;
    });
    return normalizedHeaders;
}

async function requestJson<T>(
    fetchImpl: typeof globalThis.fetch,
    config: XLAdminImportExportFetchClientConfig,
    method: 'GET' | 'POST',
    path: string,
    body: BodyInit | Record<string, unknown> | undefined,
    signal?: AbortSignal,
): Promise<T> {
    const response = await request(fetchImpl, config, method, path, body, signal);
    return await response.json() as T;
}

async function request(
    fetchImpl: typeof globalThis.fetch,
    config: XLAdminImportExportFetchClientConfig,
    method: 'GET' | 'POST',
    path: string,
    body: BodyInit | Record<string, unknown> | undefined,
    signal?: AbortSignal,
): Promise<Response> {
    const headers = await resolveHeaders(config.headers);
    const isFormData = body instanceof FormData;
    const response = await fetchImpl(buildRequestUrl(config.baseUrl, path), {
        method,
        signal,
        credentials: config.credentials ?? 'include',
        headers: isFormData ? headers : {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });

    if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json() as {detail?: string};
            if (typeof errorData.detail === 'string' && errorData.detail) {
                detail = errorData.detail;
            }
        } catch {
            const fallbackText = await response.text().catch(() => '');
            if (fallbackText.trim()) {
                detail = fallbackText.trim();
            }
        }
        throw new Error(detail);
    }

    return response;
}

async function resolveHeaders(
    headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>),
): Promise<HeadersInit> {
    if (headers === undefined) {
        return {};
    }
    if (typeof headers === 'function') {
        return headers();
    }
    return headers;
}

function buildRequestUrl(baseUrl: string, path: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (/^https?:\/\//i.test(normalizedBaseUrl)) {
        return `${normalizedBaseUrl}${normalizedPath}`;
    }
    return `${normalizedBaseUrl}${normalizedPath}`;
}
