import type {XLAdminClient} from './client';
import type {AdminDetailResponse, AdminListResponse} from './types';

type ClientCacheBucket = {
    detailResponseCache: Map<string, AdminDetailResponse>;
    inFlightDetailRequests: Map<string, Promise<AdminDetailResponse>>;
    listResponseCache: Map<string, AdminListResponse>;
    inFlightListRequests: Map<string, Promise<AdminListResponse>>;
    modelVersions: Map<string, number>;
};

const MAX_CACHE_ENTRIES = 100;
const clientCaches = new WeakMap<XLAdminClient, ClientCacheBucket>();

export function buildDetailCacheKey(slug: string, id: string | number): string {
    return `detail:${slug}:${id}`;
}

export function buildListCacheKey(slug: string, params: {
    q?: string;
    sort?: string;
    limit?: number;
    offset?: number;
} & Record<string, unknown>): string {
    const {q, sort, limit, offset, ...filters} = params;
    return `list:${slug}:${JSON.stringify({
        q: q ?? null,
        sort: sort ?? null,
        limit: limit ?? 50,
        offset: offset ?? 0,
        filters: Object.fromEntries(
            Object.entries(filters)
                .filter(([, value]) => value !== undefined && value !== null && value !== '')
                .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
        ),
    })}`;
}

export function getClientCacheBucket(client: XLAdminClient): ClientCacheBucket {
    const existingBucket = clientCaches.get(client);
    if (existingBucket) {
        return existingBucket;
    }

    const nextBucket: ClientCacheBucket = {
        detailResponseCache: new Map(),
        inFlightDetailRequests: new Map(),
        listResponseCache: new Map(),
        inFlightListRequests: new Map(),
        modelVersions: new Map(),
    };
    clientCaches.set(client, nextBucket);
    return nextBucket;
}

export function getModelCacheVersion(client: XLAdminClient, slug: string): number {
    return getClientCacheBucket(client).modelVersions.get(slug) ?? 0;
}

export function setCachedListResponse(client: XLAdminClient, key: string, response: AdminListResponse): void {
    setBoundedMapEntry(getClientCacheBucket(client).listResponseCache, key, response);
}

export function setCachedDetailResponse(client: XLAdminClient, key: string, response: AdminDetailResponse): void {
    setBoundedMapEntry(getClientCacheBucket(client).detailResponseCache, key, response);
}

export function invalidateModelCache(client: XLAdminClient, slug: string): void {
    const bucket = getClientCacheBucket(client);
    bucket.modelVersions.set(slug, getModelCacheVersion(client, slug) + 1);
    for (const key of bucket.listResponseCache.keys()) {
        if (key.startsWith(`list:${slug}:`)) {
            bucket.listResponseCache.delete(key);
        }
    }
    for (const key of bucket.inFlightListRequests.keys()) {
        if (key.startsWith(`list:${slug}:`)) {
            bucket.inFlightListRequests.delete(key);
        }
    }
    for (const key of bucket.detailResponseCache.keys()) {
        if (key.startsWith(`detail:${slug}:`)) {
            bucket.detailResponseCache.delete(key);
        }
    }
    for (const key of bucket.inFlightDetailRequests.keys()) {
        if (key.startsWith(`detail:${slug}:`)) {
            bucket.inFlightDetailRequests.delete(key);
        }
    }
}

function setBoundedMapEntry<T>(map: Map<string, T>, key: string, value: T): void {
    if (map.has(key)) {
        map.delete(key);
    }
    map.set(key, value);
    while (map.size > MAX_CACHE_ENTRIES) {
        const oldestKey = map.keys().next().value;
        if (!oldestKey) {
            break;
        }
        map.delete(oldestKey);
    }
}
