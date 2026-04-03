'use client';

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
    buildListCacheKey,
    getClientCacheBucket,
    getModelCacheVersion,
    invalidateModelCache,
    setCachedListResponse,
} from '../../cache';
import type {AdminClient} from '@xladmin-core/client';
import type {AdminTranslationKey} from '@xladmin-core/i18n';
import type {AdminRouter} from '@xladmin-core/router';
import {buildUrlWithParams} from '@xladmin-core/router';
import type {AdminDeletePreviewResponse, AdminListResponse} from '@xladmin-core/types';
import {useAdminMessage} from '../layout/AdminMessageContext';

const DEFAULT_PAGE_SIZE = 50;

type UseModelPageControllerOptions = {
    client: AdminClient;
    slug: string;
    pathname: string;
    locationSearch: string;
    router: AdminRouter;
    t: (key: AdminTranslationKey, params?: Record<string, string | number>) => string;
};

type AdminListRequestParams = {
    limit?: number;
    offset?: number;
    q?: string;
    sort?: string;
    [key: string]: unknown;
};

export function useModelPageController({
                                           client,
                                           slug,
                                           pathname,
                                           locationSearch,
                                           router,
                                           t,
                                       }: UseModelPageControllerOptions) {
    const message = useAdminMessage();
    const searchParams = useMemo(() => new URLSearchParams(locationSearch), [locationSearch]);
    const initialQuery = searchParams.get('q') ?? '';
    const initialSort = searchParams.get('sort') ?? '';
    const initialPage = parsePageParam(searchParams.get('page'));
    const initialFilters = extractFilterParams(searchParams);
    const initialCachedResponse = getClientCacheBucket(client).listResponseCache.get(
        buildListCacheKey(slug, {
            q: initialQuery || undefined,
            sort: initialSort || undefined,
            limit: DEFAULT_PAGE_SIZE,
            offset: (initialPage - 1) * DEFAULT_PAGE_SIZE,
            ...initialFilters,
        }),
    ) ?? null;

    const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
    const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [data, setData] = useState<AdminListResponse | null>(() => initialCachedResponse);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(initialCachedResponse === null);
    const [rowActionMenuAnchor, setRowActionMenuAnchor] = useState<HTMLElement | null>(null);
    const [rowActionMenuId, setRowActionMenuId] = useState<string | number | null>(null);
    const [bulkActionMenuAnchor, setBulkActionMenuAnchor] = useState<HTMLElement | null>(null);
    const [appliedQuery, setAppliedQuery] = useState(initialQuery);
    const [sortValue, setSortValue] = useState(initialSort);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [pageInput, setPageInput] = useState(String(initialPage));
    const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>(initialFilters);
    const [deletePreviewOpen, setDeletePreviewOpen] = useState(false);
    const [deletePreview, setDeletePreview] = useState<AdminDeletePreviewResponse | null>(null);
    const [deletePreviewError, setDeletePreviewError] = useState<string | null>(null);
    const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false);
    const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Array<string | number>>([]);
    const [pendingDeleteSelectAll, setPendingDeleteSelectAll] = useState(false);
    const [pendingDeleteScope, setPendingDeleteScope] = useState<{ q?: string; filters: Record<string, string> } | null>(null);
    const [pendingDeleteMode, setPendingDeleteMode] = useState<'single' | 'bulk'>('single');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const requestIdRef = useRef(0);
    const dataRef = useRef<AdminListResponse | null>(initialCachedResponse);
    const pageSizeRef = useRef<number>(initialCachedResponse?.meta.page_size ?? DEFAULT_PAGE_SIZE);
    const previousSlugRef = useRef(slug);

    const sortFields = useMemo(() => sortValue.split(',').filter(Boolean), [sortValue]);
    const meta = data?.meta ?? null;
    const rows = data?.items ?? [];
    const total = data?.pagination.total ?? 0;
    const pageSize = meta?.page_size ?? pageSizeRef.current;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const fieldMap = useMemo(
        () => new Map((meta?.fields ?? []).map((field) => [field.name, field])),
        [meta?.fields],
    );
    const listFields = meta?.list_fields ?? [];
    const listFilters = meta?.list_filters ?? [];
    const hasListFilters = listFilters.length > 0;
    const bulkActions = meta?.bulk_actions ?? [];
    const selectionScope = useMemo(
        () => ({
            q: appliedQuery || undefined,
            filters: {...appliedFilters},
        }),
        [appliedFilters, appliedQuery],
    );
    const selectedIdSet = useMemo(() => {
        if (isAllMatchingSelected) {
            return new Set(rows.map((row) => String(row[meta?.pk_field ?? 'id'])));
        }
        return new Set(selectedIds.map((item) => String(item)));
    }, [isAllMatchingSelected, meta?.pk_field, rows, selectedIds]);
    const allVisibleSelected = rows.length > 0 && (
        isAllMatchingSelected || rows.every((row) => selectedIdSet.has(String(row[meta?.pk_field ?? 'id'])))
    );
    const hasVisibleSelection = isAllMatchingSelected || rows.some((row) => selectedIdSet.has(String(row[meta?.pk_field ?? 'id'])));
    const hasSelection = isAllMatchingSelected || selectedIds.length > 0;
    const selectionCount = isAllMatchingSelected ? total : selectedIds.length;

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    useLayoutEffect(() => {
        if (previousSlugRef.current === slug) {
            return;
        }

        previousSlugRef.current = slug;
        const nextSearchParams = new URLSearchParams(locationSearch);
        const nextQuery = nextSearchParams.get('q') ?? '';
        const nextSort = nextSearchParams.get('sort') ?? '';
        const nextPage = parsePageParam(nextSearchParams.get('page'));
        const nextFilters = extractFilterParams(nextSearchParams);
        const nextCachedResponse = getClientCacheBucket(client).listResponseCache.get(
            buildListCacheKey(slug, {
                q: nextQuery || undefined,
                sort: nextSort || undefined,
                limit: DEFAULT_PAGE_SIZE,
                offset: (nextPage - 1) * DEFAULT_PAGE_SIZE,
                ...nextFilters,
            }),
        ) ?? null;

        dataRef.current = nextCachedResponse;
        pageSizeRef.current = nextCachedResponse?.meta.page_size ?? DEFAULT_PAGE_SIZE;
        setData(nextCachedResponse);
        setError(null);
        setIsLoading(nextCachedResponse === null);
        setSelectedIds([]);
        setIsAllMatchingSelected(false);
        setRowActionMenuAnchor(null);
        setRowActionMenuId(null);
        setBulkActionMenuAnchor(null);
        setDeletePreviewOpen(false);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(false);
        setIsDeleteSubmitting(false);
        setPendingDeleteIds([]);
        setPendingDeleteSelectAll(false);
        setPendingDeleteScope(null);
        setPendingDeleteMode('single');
    }, [client, locationSearch, slug]);

    useLayoutEffect(() => {
        const nextSearchParams = new URLSearchParams(locationSearch);
        const nextQuery = nextSearchParams.get('q') ?? '';
        const nextSort = nextSearchParams.get('sort') ?? '';
        const nextPage = parsePageParam(nextSearchParams.get('page'));
        const nextFilters = extractFilterParams(nextSearchParams);
        setAppliedQuery(nextQuery);
        setSortValue(nextSort);
        setCurrentPage(nextPage);
        setPageInput(String(nextPage));
        setAppliedFilters(nextFilters);
    }, [locationSearch]);

    const clearSelection = useCallback(() => {
        setSelectedIds([]);
        setIsAllMatchingSelected(false);
    }, []);

    const loadItems = useCallback(async () => {
        const activeRequestId = requestIdRef.current + 1;
        requestIdRef.current = activeRequestId;
        setError(null);

        const requestParams = {
            q: appliedQuery || undefined,
            sort: sortValue || undefined,
            limit: pageSizeRef.current,
            offset: (currentPage - 1) * pageSizeRef.current,
            ...appliedFilters,
        };
        const requestKey = buildListCacheKey(slug, requestParams);

        const cachedResponse = getClientCacheBucket(client).listResponseCache.get(requestKey) ?? null;
        if (cachedResponse) {
            setData(cachedResponse);
            if (!isAllMatchingSelected) {
                setSelectedIds([]);
            }
            setIsLoading(false);
            return;
        }

        if (dataRef.current === null) {
            setData(null);
        }
        setIsLoading(true);

        try {
            const response = await requestListItems(client, slug, requestParams, requestKey);
            if (activeRequestId !== requestIdRef.current) {
                return;
            }

            pageSizeRef.current = response.meta.page_size;
            setData(response);
            if (!isAllMatchingSelected) {
                setSelectedIds([]);
            }
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('model_load_error'));
        } finally {
            if (activeRequestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [appliedFilters, appliedQuery, client, currentPage, isAllMatchingSelected, slug, sortValue, t]);

    useEffect(() => {
        void loadItems();
    }, [loadItems]);

    const refresh = useCallback(async () => {
        invalidateModelCache(client, slug);
        await loadItems();
    }, [client, loadItems, slug]);

    const replaceLocation = useCallback((nextQuery: string, nextSort: string, nextPage: number, nextFilters: Record<string, string>) => {
        router.replace(buildUrlWithParams(pathname, nextQuery, nextSort, nextPage, nextFilters));
    }, [pathname, router]);

    const handleSearchCommit = useCallback((nextQuery: string) => {
        if (nextQuery === appliedQuery) {
            return;
        }
        clearSelection();
        setAppliedQuery(nextQuery);
        setCurrentPage(1);
        setPageInput('1');
        replaceLocation(nextQuery, sortValue, 1, appliedFilters);
    }, [appliedFilters, appliedQuery, clearSelection, replaceLocation, sortValue]);

    const handlePageChange = useCallback((nextPage: number) => {
        const safePage = Math.min(Math.max(nextPage, 1), totalPages);
        setCurrentPage(safePage);
        setPageInput(String(safePage));
        replaceLocation(appliedQuery, sortValue, safePage, appliedFilters);
    }, [appliedFilters, appliedQuery, replaceLocation, sortValue, totalPages]);

    const handlePageInputCommit = useCallback(() => {
        const parsedPage = parsePageParam(pageInput);
        handlePageChange(parsedPage);
    }, [handlePageChange, pageInput]);

    const toggleSort = useCallback((fieldName: string) => {
        const nextSortFields = sortFields.filter((item) => item !== fieldName && item !== `-${fieldName}`);
        const currentSort = sortFields.find((item) => item === fieldName || item === `-${fieldName}`);

        if (currentSort === undefined) {
            nextSortFields.unshift(fieldName);
        } else if (currentSort === fieldName) {
            nextSortFields.unshift(`-${fieldName}`);
        } else {
            nextSortFields.unshift(fieldName);
        }

        const nextSortValue = nextSortFields.join(',');
        setSortValue(nextSortValue);
        setCurrentPage(1);
        setPageInput('1');
        replaceLocation(appliedQuery, nextSortValue, 1, appliedFilters);
    }, [appliedFilters, appliedQuery, replaceLocation, sortFields]);

    const handleFilterChange = useCallback((filterSlug: string, value: string) => {
        const nextFilters = {
            ...appliedFilters,
            [filterSlug]: value,
        };
        if (!value) {
            delete nextFilters[filterSlug];
        }
        clearSelection();
        setAppliedFilters(nextFilters);
        setCurrentPage(1);
        setPageInput('1');
        replaceLocation(appliedQuery, sortValue, 1, nextFilters);
    }, [appliedFilters, appliedQuery, clearSelection, replaceLocation, sortValue]);

    const handleResetFilters = useCallback(() => {
        if (Object.keys(appliedFilters).length === 0) {
            return;
        }
        clearSelection();
        setAppliedFilters({});
        setCurrentPage(1);
        setPageInput('1');
        replaceLocation(appliedQuery, sortValue, 1, {});
    }, [appliedFilters, appliedQuery, clearSelection, replaceLocation, sortValue]);

    const openSingleDeletePreview = useCallback(async (rowId: string | number) => {
        setPendingDeleteIds([rowId]);
        setPendingDeleteSelectAll(false);
        setPendingDeleteScope(null);
        setPendingDeleteMode('single');
        setDeletePreviewOpen(true);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(true);
        try {
            const preview = await client.getDeletePreview(slug, rowId);
            setDeletePreview(preview);
        } catch (reason: unknown) {
            setDeletePreviewError(reason instanceof Error ? reason.message : t('delete_preview_error'));
        } finally {
            setIsDeletePreviewLoading(false);
        }
    }, [client, slug, t]);

    const openBulkDeletePreview = useCallback(async () => {
        if (!hasSelection) {
            return;
        }
        setPendingDeleteIds(isAllMatchingSelected ? [] : selectedIds);
        setPendingDeleteSelectAll(isAllMatchingSelected);
        setPendingDeleteScope(isAllMatchingSelected ? selectionScope : null);
        setPendingDeleteMode('bulk');
        setDeletePreviewOpen(true);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(true);
        try {
            const preview = await client.getBulkDeletePreview(
                slug,
                isAllMatchingSelected ? [] : selectedIds,
                isAllMatchingSelected ? {selectAll: true, selectionScope} : undefined,
            );
            setDeletePreview(preview);
        } catch (reason: unknown) {
            setDeletePreviewError(reason instanceof Error ? reason.message : t('delete_preview_error'));
        } finally {
            setIsDeletePreviewLoading(false);
            setBulkActionMenuAnchor(null);
        }
    }, [client, hasSelection, isAllMatchingSelected, selectedIds, selectionScope, slug, t]);

    const handleConfirmDelete = useCallback(async () => {
        if (pendingDeleteMode === 'single' && pendingDeleteIds.length === 0) {
            return;
        }
        if (pendingDeleteMode === 'bulk' && pendingDeleteIds.length === 0 && !pendingDeleteSelectAll) {
            return;
        }

        setIsDeleteSubmitting(true);
        setError(null);
        try {
            if (pendingDeleteMode === 'single') {
                await client.deleteItem(slug, pendingDeleteIds[0]);
                message.success(t('object_deleted_success'));
            } else {
                const response = await client.bulkDelete(
                    slug,
                    pendingDeleteIds,
                    pendingDeleteSelectAll && pendingDeleteScope
                        ? {selectAll: true, selectionScope: pendingDeleteScope}
                        : undefined,
                );
                message.success(t('delete_success', {count: response.deleted}));
            }
            setDeletePreviewOpen(false);
            setDeletePreview(null);
            setDeletePreviewError(null);
            setPendingDeleteIds([]);
            setPendingDeleteSelectAll(false);
            setPendingDeleteScope(null);
            clearSelection();
            await refresh();
        } catch (reason: unknown) {
            const nextError = reason instanceof Error ? reason.message : t('object_delete_error');
            setDeletePreviewError(nextError);
            message.error(nextError);
        } finally {
            setIsDeleteSubmitting(false);
        }
    }, [clearSelection, client, message, pendingDeleteIds, pendingDeleteMode, pendingDeleteScope, pendingDeleteSelectAll, refresh, slug, t]);

    const handleRunNamedBulkAction = useCallback(async (actionSlug: string) => {
        if (!actionSlug || !hasSelection) {
            return;
        }

        if (actionSlug === 'delete') {
            await openBulkDeletePreview();
            return;
        }

        try {
            const response = await client.runBulkAction(
                slug,
                actionSlug,
                isAllMatchingSelected ? [] : selectedIds,
                undefined,
                isAllMatchingSelected ? {selectAll: true, selectionScope} : undefined,
            );
            setBulkActionMenuAnchor(null);
            clearSelection();
            await refresh();
            const actionLabel = bulkActions.find((item) => item.slug === actionSlug)?.label ?? actionSlug;
            message.success(t('action_success', {action: actionLabel, count: response.processed}));
        } catch (reason: unknown) {
            const nextError = reason instanceof Error ? reason.message : t('object_action_error');
            setError(nextError);
            message.error(nextError);
        }
    }, [bulkActions, clearSelection, client, hasSelection, isAllMatchingSelected, message, openBulkDeletePreview, refresh, selectedIds, selectionScope, slug, t]);

    const handleRowDelete = useCallback(async (rowId: string | number) => {
        setRowActionMenuAnchor(null);
        setRowActionMenuId(null);
        await openSingleDeletePreview(rowId);
    }, [openSingleDeletePreview]);

    const handleToggleSelection = useCallback((rowId: string | number, checked: boolean) => {
        if (isAllMatchingSelected) {
            if (checked) {
                return;
            }
            setIsAllMatchingSelected(false);
            if (!meta) {
                setSelectedIds([]);
                return;
            }
            setSelectedIds(
                rows
                    .map((row) => row[meta.pk_field] as string | number)
                    .filter((item) => String(item) !== String(rowId)),
            );
            return;
        }
        setSelectedIds((current) => {
            const rowKey = String(rowId);
            if (checked) {
                if (current.some((item) => String(item) === rowKey)) {
                    return current;
                }
                return [...current, rowId];
            }
            return current.filter((item) => String(item) !== rowKey);
        });
    }, [isAllMatchingSelected, meta, rows]);

    const handleToggleAllVisible = useCallback((checked: boolean) => {
        if (!meta) {
            return;
        }

        if (checked) {
            setIsAllMatchingSelected(false);
            setSelectedIds(rows.map((row) => row[meta.pk_field] as string | number));
            return;
        }

        clearSelection();
    }, [clearSelection, meta, rows]);

    const handleSelectAllMatching = useCallback(() => {
        if (!hasSelection || total === 0) {
            return;
        }
        setSelectedIds([]);
        setIsAllMatchingSelected(true);
    }, [hasSelection, total]);

    const clearBulkDeleteState = useCallback(() => {
        setPendingDeleteIds([]);
        setPendingDeleteSelectAll(false);
        setPendingDeleteScope(null);
    }, []);

    const handleClearDeletePreview = useCallback(() => {
        setDeletePreviewOpen(false);
        setDeletePreview(null);
        setDeletePreviewError(null);
        clearBulkDeleteState();
    }, [clearBulkDeleteState]);

    const handleOpenRowMenu = useCallback((event: { currentTarget: HTMLElement }, rowId: string | number) => {
        setRowActionMenuAnchor(event.currentTarget as HTMLElement);
        setRowActionMenuId(rowId);
    }, []);

    const handleCloseRowMenu = useCallback(() => {
        setRowActionMenuAnchor(null);
        setRowActionMenuId(null);
    }, []);

    const handleCloseBulkActionMenu = useCallback(() => {
        setBulkActionMenuAnchor(null);
    }, []);

    return {
        allVisibleSelected,
        appliedFilters,
        appliedQuery,
        bulkActionMenuAnchor,
        bulkActions,
        clearBulkDeleteState,
        createOpen,
        currentPage,
        data,
        deletePreview,
        deletePreviewError,
        deletePreviewOpen,
        error,
        fieldMap,
        filtersOpen,
        handleClearDeletePreview,
        handleCloseBulkActionMenu,
        handleCloseRowMenu,
        handleConfirmDelete,
        handleFilterChange,
        handleOpenRowMenu,
        handlePageChange,
        handlePageInputCommit,
        handleResetFilters,
        handleRowDelete,
        handleRunNamedBulkAction,
        handleSearchCommit,
        handleSelectAllMatching,
        handleToggleAllVisible,
        handleToggleSelection,
        hasListFilters,
        hasSelection,
        hasVisibleSelection,
        isAllMatchingSelected,
        isDeletePreviewLoading,
        isDeleteSubmitting,
        isLoading,
        listFields,
        listFilters,
        meta,
        pageInput,
        pendingDeleteIds,
        pendingDeleteMode,
        refresh,
        rowActionMenuAnchor,
        rowActionMenuId,
        rows,
        selectionCount,
        selectedIdSet,
        selectedIds,
        setBulkActionMenuAnchor,
        setCreateOpen,
        setDeletePreview,
        setDeletePreviewError,
        setDeletePreviewOpen,
        setFiltersOpen,
        setPageInput,
        sortValue,
        sortFields,
        toggleSort,
        total,
        totalPages,
    };
}


function requestListItems(client: AdminClient, slug: string, params: AdminListRequestParams, requestKey: string) {
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
            bucket.inFlightListRequests.delete(requestKey);
        });

    bucket.inFlightListRequests.set(requestKey, request);
    return request;
}

function parsePageParam(value: string | null): number {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
        return 1;
    }
    return Math.floor(parsedValue);
}

function extractFilterParams(params: URLSearchParams): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
        if (key === 'q' || key === 'sort' || key === 'page') {
            continue;
        }
        if (value) {
            result[key] = value;
        }
    }
    return result;
}
