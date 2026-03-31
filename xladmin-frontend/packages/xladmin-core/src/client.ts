import type {
    AdminChoicesResponse,
    AdminDeletePreviewResponse,
    AdminDetailResponse,
    AdminListResponse,
    AdminModelMeta,
    AdminModelsResponse,
    AdminObjectActionResponse,
} from './types';

export type XLAdminRequestOptions = {
    signal?: AbortSignal;
};

export type XLAdminClient = {
    getModels: () => Promise<AdminModelsResponse>;
    getModel: (slug: string) => Promise<AdminModelMeta>;
    getItems: (slug: string, params?: {limit?: number; offset?: number; q?: string; sort?: string} & Record<string, unknown>) => Promise<AdminListResponse>;
    getItem: (slug: string, id: string | number) => Promise<AdminDetailResponse>;
    createItem: (slug: string, payload: Record<string, unknown>) => Promise<AdminDetailResponse>;
    patchItem: (slug: string, id: string | number, payload: Record<string, unknown>) => Promise<AdminDetailResponse>;
    deleteItem: (slug: string, id: string | number) => Promise<void>;
    getDeletePreview: (slug: string, id: string | number) => Promise<AdminDeletePreviewResponse>;
    bulkDelete: (slug: string, ids: Array<string | number>) => Promise<{deleted: number}>;
    getBulkDeletePreview: (slug: string, ids: Array<string | number>) => Promise<AdminDeletePreviewResponse>;
    runBulkAction: (slug: string, actionSlug: string, ids: Array<string | number>, payload?: Record<string, unknown>) => Promise<{processed: number} & Record<string, unknown>>;
    runObjectAction: (slug: string, id: string | number, actionSlug: string, payload?: Record<string, unknown>) => Promise<AdminObjectActionResponse>;
    getChoices: (
        slug: string,
        fieldName: string,
        q?: string,
        ids?: Array<string | number>,
        options?: XLAdminRequestOptions,
    ) => Promise<AdminChoicesResponse>;
    getFilterChoices: (
        slug: string,
        filterSlug: string,
        q?: string,
        ids?: Array<string | number>,
        options?: XLAdminRequestOptions,
    ) => Promise<AdminChoicesResponse>;
};

type XLAdminTransportResponse<T> = T | {data: T};

export type XLAdminTransport = {
    get: <T>(url: string, options?: XLAdminRequestOptions & {params?: Record<string, unknown>}) => Promise<XLAdminTransportResponse<T>>;
    post: <T>(url: string, body?: Record<string, unknown>, options?: XLAdminRequestOptions) => Promise<XLAdminTransportResponse<T>>;
    patch: <T>(url: string, body: Record<string, unknown>, options?: XLAdminRequestOptions) => Promise<XLAdminTransportResponse<T>>;
    delete: (url: string, options?: XLAdminRequestOptions) => Promise<unknown>;
};

export type XLAdminAxiosLike = XLAdminTransport;

export type XLAdminFetchClientConfig = {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
    headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
    credentials?: RequestCredentials;
};

export function createXLAdminClient(transport: XLAdminTransport): XLAdminClient {
    return {
        async getModels() {
            return await transportGet<AdminModelsResponse>(transport, '/xladmin/models/');
        },
        async getModel(slug) {
            return await transportGet<AdminModelMeta>(transport, `/xladmin/models/${slug}/`);
        },
        async getItems(slug, params) {
            return await transportGet<AdminListResponse>(transport, `/xladmin/models/${slug}/items/`, {params});
        },
        async getItem(slug, id) {
            return await transportGet<AdminDetailResponse>(transport, `/xladmin/models/${slug}/items/${id}/`);
        },
        async createItem(slug, payload) {
            return await transportPost<AdminDetailResponse>(transport, `/xladmin/models/${slug}/items/`, payload);
        },
        async patchItem(slug, id, payload) {
            return await transportPatch<AdminDetailResponse>(transport, `/xladmin/models/${slug}/items/${id}/`, payload);
        },
        async deleteItem(slug, id) {
            await transport.delete(`/xladmin/models/${slug}/items/${id}/`);
        },
        async getDeletePreview(slug, id) {
            return await transportGet<AdminDeletePreviewResponse>(transport, `/xladmin/models/${slug}/items/${id}/delete-preview/`);
        },
        async bulkDelete(slug, ids) {
            return await transportPost<{deleted: number}>(transport, `/xladmin/models/${slug}/bulk-delete/`, {ids});
        },
        async getBulkDeletePreview(slug, ids) {
            return await transportPost<AdminDeletePreviewResponse>(transport, `/xladmin/models/${slug}/bulk-delete-preview/`, {ids});
        },
        async runBulkAction(slug, actionSlug, ids, payload) {
            return await transportPost<{processed: number} & Record<string, unknown>>(
                transport,
                `/xladmin/models/${slug}/bulk-actions/${actionSlug}/`,
                {ids, ...(payload ?? {})},
            );
        },
        async runObjectAction(slug, id, actionSlug, payload) {
            return await transportPost<AdminObjectActionResponse>(
                transport,
                `/xladmin/models/${slug}/items/${id}/actions/${actionSlug}/`,
                payload ?? {},
            );
        },
        async getChoices(slug, fieldName, q, ids, options) {
            return await transportGet<AdminChoicesResponse>(
                transport,
                `/xladmin/models/${slug}/fields/${fieldName}/choices/`,
                {
                    signal: options?.signal,
                    params: {
                        ...(q ? {q} : {}),
                        ...(ids && ids.length > 0 ? {ids: ids.join(',')} : {}),
                    },
                },
            );
        },
        async getFilterChoices(slug, filterSlug, q, ids, options) {
            return await transportGet<AdminChoicesResponse>(
                transport,
                `/xladmin/models/${slug}/filters/${filterSlug}/choices/`,
                {
                    signal: options?.signal,
                    params: {
                        ...(q ? {q} : {}),
                        ...(ids && ids.length > 0 ? {ids: ids.join(',')} : {}),
                    },
                },
            );
        },
    };
}

export function createAxiosXLAdminClient(api: XLAdminAxiosLike): XLAdminClient {
    return createXLAdminClient(api);
}

export function createFetchXLAdminClient(config: XLAdminFetchClientConfig): XLAdminClient {
    return createXLAdminClient(createFetchXLAdminTransport(config));
}

export function createFetchXLAdminTransport(config: XLAdminFetchClientConfig): XLAdminTransport {
    const fetchImpl = config.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
        throw new Error('Fetch API is not available in the current environment.');
    }

    return {
        get: async <T>(
            url: string,
            options?: XLAdminRequestOptions & {params?: Record<string, unknown>},
        ): Promise<T> => (
            await requestJson<T>(fetchImpl, config, 'GET', url, undefined, options?.params, options?.signal)
        ),
        post: async <T>(url: string, body?: Record<string, unknown>, options?: XLAdminRequestOptions): Promise<T> => (
            await requestJson<T>(fetchImpl, config, 'POST', url, body, undefined, options?.signal)
        ),
        patch: async <T>(url: string, body: Record<string, unknown>, options?: XLAdminRequestOptions): Promise<T> => (
            await requestJson<T>(fetchImpl, config, 'PATCH', url, body, undefined, options?.signal)
        ),
        delete: async (url: string, options?: XLAdminRequestOptions): Promise<void> => {
            await requestRaw(fetchImpl, config, 'DELETE', url, undefined, undefined, options?.signal);
        },
    };
}

async function transportGet<T>(
    transport: XLAdminTransport,
    url: string,
    options?: XLAdminRequestOptions & {params?: Record<string, unknown>},
): Promise<T> {
    return unwrapTransportResponse(await transport.get<T>(url, options));
}

async function transportPost<T>(
    transport: XLAdminTransport,
    url: string,
    body?: Record<string, unknown>,
    options?: XLAdminRequestOptions,
): Promise<T> {
    return unwrapTransportResponse(await transport.post<T>(url, body, options));
}

async function transportPatch<T>(
    transport: XLAdminTransport,
    url: string,
    body: Record<string, unknown>,
    options?: XLAdminRequestOptions,
): Promise<T> {
    return unwrapTransportResponse(await transport.patch<T>(url, body, options));
}

function unwrapTransportResponse<T>(response: XLAdminTransportResponse<T>): T {
    if (isWrappedTransportResponse<T>(response)) {
        return response.data;
    }
    return response;
}

function isWrappedTransportResponse<T>(response: XLAdminTransportResponse<T>): response is {data: T} {
    return typeof response === 'object' && response !== null && 'data' in response;
}

async function requestJson<T>(
    fetchImpl: typeof globalThis.fetch,
    config: XLAdminFetchClientConfig,
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    body?: Record<string, unknown>,
    params?: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<T> {
    const response = await requestRaw(fetchImpl, config, method, url, body, params, signal);
    return await response.json() as T;
}

async function requestRaw(
    fetchImpl: typeof globalThis.fetch,
    config: XLAdminFetchClientConfig,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: Record<string, unknown>,
    params?: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<Response> {
    const headers = await resolveHeaders(config.headers);
    const response = await fetchImpl(buildRequestUrl(config.baseUrl, url, params), {
        method,
        signal,
        credentials: config.credentials ?? 'include',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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

function buildRequestUrl(baseUrl: string, path: string, params?: Record<string, unknown>): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const requestUrl = new URL(`${normalizedBaseUrl}${normalizedPath}`, 'http://localhost');
    const query = buildSearchParams(params);
    if (query) {
        requestUrl.search = query;
    }

    if (/^https?:\/\//i.test(normalizedBaseUrl)) {
        return requestUrl.toString();
    }
    return `${normalizedBaseUrl}${normalizedPath}${query ? `?${query}` : ''}`;
}

function buildSearchParams(params?: Record<string, unknown>): string {
    if (!params) {
        return '';
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue;
        }
        searchParams.set(key, String(value));
    }
    return searchParams.toString();
}
