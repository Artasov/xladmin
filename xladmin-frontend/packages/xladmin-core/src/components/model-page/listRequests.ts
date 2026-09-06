import type {AdminClient} from '../../client';
import {
    getClientCacheBucket,
    getModelCacheVersion,
    setCachedListResponse,
} from '../../cache';

type AdminListRequestParams = {
    limit?: number;
    offset?: number;
    q?: string;
    sort?: string;
    [key: string]: unknown;
};

export function requestListItems(client: AdminClient, slug: string, params: AdminListRequestParams, requestKey: string) {
    const bucket = getClientCacheBucket(client);
    const cachedResponse = bucket.listResponseCache.get(requestKey);
    if (cachedResponse) {
        return Promise.resolve(cachedResponse);
    }

    const existingRequest = bucket.inFlightListRequests.get(requestKey);
    if (existingRequest) {
        return existingRequest;
    }

    const cacheVersion = getModelCacheVersion(client, slug);
    const request = client.getItems(slug, params)
        .then((response) => {
            if (getModelCacheVersion(client, slug) === cacheVersion) {
                setCachedListResponse(client, requestKey, response);
            }
            return response;
        })
        .finally(() => {
            if (bucket.inFlightListRequests.get(requestKey) === request) bucket.inFlightListRequests.delete(requestKey);
        });

    bucket.inFlightListRequests.set(requestKey, request);
    return request;
}
