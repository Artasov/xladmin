import {describe, expect, it} from 'vitest';
import {
    buildDetailCacheKey,
    buildListCacheKey,
    getClientCacheBucket,
    getModelCacheVersion,
    invalidateModelCache,
    setCachedDetailResponse,
    setCachedListResponse,
} from './cache';
import type {XLAdminClient} from './client';

function createClientStub(): XLAdminClient {
    return {} as XLAdminClient;
}

describe('cache helpers', () => {
    it('keeps caches isolated per client instance', () => {
        const firstClient = createClientStub();
        const secondClient = createClientStub();
        const key = buildDetailCacheKey('users', 1);

        setCachedDetailResponse(firstClient, key, {meta: {} as never, item: {id: 1}});

        expect(getClientCacheBucket(firstClient).detailResponseCache.get(key)?.item).toEqual({id: 1});
        expect(getClientCacheBucket(secondClient).detailResponseCache.has(key)).toBe(false);
    });

    it('invalidates model-specific list and detail cache entries', () => {
        const client = createClientStub();
        const listKey = buildListCacheKey('users', {q: 'alpha'});
        const otherListKey = buildListCacheKey('roles', {q: 'admin'});
        const detailKey = buildDetailCacheKey('users', 1);
        const otherDetailKey = buildDetailCacheKey('roles', 1);

        setCachedListResponse(client, listKey, {meta: {} as never, pagination: {limit: 50, offset: 0, total: 1}, items: []});
        setCachedListResponse(client, otherListKey, {meta: {} as never, pagination: {limit: 50, offset: 0, total: 1}, items: []});
        setCachedDetailResponse(client, detailKey, {meta: {} as never, item: {id: 1}});
        setCachedDetailResponse(client, otherDetailKey, {meta: {} as never, item: {id: 2}});

        invalidateModelCache(client, 'users');

        expect(getClientCacheBucket(client).listResponseCache.has(listKey)).toBe(false);
        expect(getClientCacheBucket(client).detailResponseCache.has(detailKey)).toBe(false);
        expect(getClientCacheBucket(client).listResponseCache.has(otherListKey)).toBe(true);
        expect(getClientCacheBucket(client).detailResponseCache.has(otherDetailKey)).toBe(true);
    });

    it('bumps model cache version on invalidation', () => {
        const client = createClientStub();

        expect(getModelCacheVersion(client, 'users')).toBe(0);

        invalidateModelCache(client, 'users');

        expect(getModelCacheVersion(client, 'users')).toBe(1);
        expect(getModelCacheVersion(client, 'roles')).toBe(0);
    });
});
