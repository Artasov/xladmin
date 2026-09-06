'use client';

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
    buildListCacheKey,
    getClientCacheBucket,
    invalidateModelCache,
} from '../../cache';
import type {AdminClient} from '@xladmin-core/client';
import type {AdminTranslationKey} from '@xladmin-core/i18n';
import type {AdminRouter} from '@xladmin-core/router';
import {buildUrlWithParams} from '@xladmin-core/router';
import type {AdminDeletePreviewResponse, AdminListResponse} from '@xladmin-core/types';
import {useAdminMessage} from '../layout/AdminMessageContext';
import {requestListItems} from './listRequests';

const DEFAULT_PAGE_SIZE = 50;

type UseModelPageControllerOptions = {
    client: AdminClient;
    slug: string;
    pathname: string;
    locationSearch: string;
    router: AdminRouter;
    t: (key: AdminTranslationKey, params?: Record<string, string | number>) => string;
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
    const lifetime = useMemo(() => ({
        client, slug, active: false, canWrite: false, busy: false,
        previewVersion: 0, formVersion: 0, selectionVersion: 0,
    }), [client, slug]);
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
    const [bulkActionFormSlug, setBulkActionFormSlug] = useState<string | null>(null);
    const [bulkActionFormOpen, setBulkActionFormOpen] = useState(false);
    const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
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
    const previousScopeRef = useRef(lifetime);
    const refreshRef = useRef<(() => Promise<void>) | null>(null);

    const sortFields = useMemo(() => sortValue.split(',').filter(Boolean), [sortValue]);
    const meta = data?.meta ?? null;
    const canWrite = meta?.slug === slug && meta.read_only === false;
    const rows = useMemo(() => data?.items ?? [], [data?.items]);
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
    const bulkActions = useMemo(() => canWrite ? meta.bulk_actions : [], [canWrite, meta]);
    const selectionScope = useMemo(
        () => ({
            q: appliedQuery || undefined,
            filters: {...appliedFilters},
        }),
        [appliedFilters, appliedQuery],
    );
    const selectionKey = buildListCacheKey(slug, {q: appliedQuery, ...appliedFilters});
    const previousSelectionKey = useRef(selectionKey);
    const selectionLifetime = useMemo(() => ({selectedIds, isAllMatchingSelected, selectionKey, active: false}), [selectedIds, isAllMatchingSelected, selectionKey]);
    const previewLifetime = useMemo(() => ({lifetime, pendingDeleteIds, deletePreviewOpen, active: false}), [lifetime, pendingDeleteIds, deletePreviewOpen]);
    const formLifetime = useMemo(() => ({lifetime, bulkActionFormSlug, bulkActionFormOpen, active: false}), [lifetime, bulkActionFormSlug, bulkActionFormOpen]);
    useLayoutEffect(() => {
        selectionLifetime.active = true;
        return () => {selectionLifetime.active = false;};
    }, [selectionLifetime]);
    useLayoutEffect(() => {
        formLifetime.active = bulkActionFormOpen;
        return () => {formLifetime.active = false;};
    }, [formLifetime, bulkActionFormOpen]);
    useLayoutEffect(() => {
        previewLifetime.active = deletePreviewOpen;
        return () => {previewLifetime.active = false;};
    }, [previewLifetime, deletePreviewOpen]);
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

    useLayoutEffect(() => {
        lifetime.active = true;
        lifetime.canWrite = canWrite;
        return () => {lifetime.active = false;};
    }, [lifetime, canWrite]);

    useLayoutEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    useLayoutEffect(() => {
        if (previousScopeRef.current === lifetime) {
            return;
        }

        previousScopeRef.current = lifetime;
        requestIdRef.current += 1;
        setCreateOpen(false);
        setBulkActionFormOpen(false);
        setIsBulkSubmitting(false);
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
        setBulkActionFormSlug(null);
        setDeletePreviewOpen(false);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(false);
        setIsDeleteSubmitting(false);
        setPendingDeleteIds([]);
        setPendingDeleteSelectAll(false);
        setPendingDeleteScope(null);
        setPendingDeleteMode('single');
    }, [client, lifetime, locationSearch, slug]);

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
        if (!lifetime.active) return;
        lifetime.selectionVersion += 1;
        setSelectedIds([]);
        setIsAllMatchingSelected(false);
    }, [lifetime]);

    useLayoutEffect(() => {
        if (previousSelectionKey.current === selectionKey) return;
        previousSelectionKey.current = selectionKey;
        clearSelection();
        lifetime.formVersion += 1;
        lifetime.previewVersion += 1;
        setBulkActionFormOpen(false);
        setDeletePreviewOpen(false);
        setDeletePreview(null);
        setIsDeletePreviewLoading(false);
        setPendingDeleteIds([]);
        setPendingDeleteSelectAll(false);
        setPendingDeleteScope(null);
    }, [clearSelection, lifetime, selectionKey]);

    const loadItems = useCallback(async () => {
        if (!lifetime.active) return;
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
            setIsLoading(false);
            return;
        }

        if (dataRef.current === null) {
            setData(null);
        }
        setIsLoading(true);

        try {
            const response = await requestListItems(client, slug, requestParams, requestKey);
            if (!lifetime.active || activeRequestId !== requestIdRef.current) {
                return;
            }

            pageSizeRef.current = response.meta.page_size;
            setData(response);
        } catch (reason: unknown) {
            if (!lifetime.active || activeRequestId !== requestIdRef.current) return;
            setError(reason instanceof Error ? reason.message : t('model_load_error'));
        } finally {
            if (lifetime.active && activeRequestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [appliedFilters, appliedQuery, client, currentPage, lifetime, slug, sortValue, t]);

    useEffect(() => {
        void loadItems();
    }, [loadItems]);

    const refresh = useCallback(async () => {
        if (!lifetime.active) return;
        invalidateModelCache(client, slug);
        await loadItems();
    }, [client, lifetime, loadItems, slug]);

    useLayoutEffect(() => {refreshRef.current = refresh;}, [refresh]);

    // Retire pending reads before effects start loading a different page/query.
    useLayoutEffect(() => {requestIdRef.current += 1;}, [lifetime, appliedFilters, appliedQuery, currentPage, sortValue]);

    const replaceLocation = useCallback((nextQuery: string, nextSort: string, nextPage: number, nextFilters: Record<string, string>) => {
        if (!lifetime.active) return;
        router.replace(buildUrlWithParams(pathname, nextQuery, nextSort, nextPage, nextFilters));
    }, [lifetime, pathname, router]);

    const handleSearchCommit = useCallback((nextQuery: string) => {
        if (!lifetime.active) return;
        if (nextQuery === appliedQuery) {
            return;
        }
        clearSelection();
        setAppliedQuery(nextQuery);
        setCurrentPage(1);
        setPageInput('1');
        replaceLocation(nextQuery, sortValue, 1, appliedFilters);
    }, [appliedFilters, appliedQuery, clearSelection, replaceLocation, sortValue, lifetime]);

    const handlePageChange = useCallback((nextPage: number) => {
        if (!lifetime.active) return;
        const safePage = Math.min(Math.max(nextPage, 1), totalPages);
        setCurrentPage(safePage);
        setPageInput(String(safePage));
        replaceLocation(appliedQuery, sortValue, safePage, appliedFilters);
    }, [appliedFilters, appliedQuery, replaceLocation, sortValue, totalPages, lifetime]);

    const handlePageInputCommit = useCallback(() => {
        if (!lifetime.active) return;
        const parsedPage = parsePageParam(pageInput);
        handlePageChange(parsedPage);
    }, [handlePageChange, pageInput, lifetime]);

    const toggleSort = useCallback((fieldName: string) => {
        if (!lifetime.active) return;
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
    }, [appliedFilters, appliedQuery, replaceLocation, sortFields, lifetime]);

    const handleFilterChange = useCallback((filterSlug: string, value: string) => {
        if (!lifetime.active) return;
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
    }, [appliedFilters, appliedQuery, clearSelection, replaceLocation, sortValue, lifetime]);

    const handleResetFilters = useCallback(() => {
        if (!lifetime.active) return;
        if (Object.keys(appliedFilters).length === 0) {
            return;
        }
        clearSelection();
        setAppliedFilters({});
        setCurrentPage(1);
        setPageInput('1');
        replaceLocation(appliedQuery, sortValue, 1, {});
    }, [appliedFilters, appliedQuery, clearSelection, replaceLocation, sortValue, lifetime]);

    const openSingleDeletePreview = useCallback(async (rowId: string | number) => {
        if (!lifetime.active || !lifetime.canWrite) return;
        if (lifetime.busy) return;
        previewLifetime.active = false;
        const previewVersion = ++lifetime.previewVersion;
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
            if (!lifetime.active || !lifetime.canWrite || previewVersion !== lifetime.previewVersion) return;
            setDeletePreview(preview);
        } catch (reason: unknown) {
            if (!lifetime.active || previewVersion !== lifetime.previewVersion) return;
            setDeletePreviewError(reason instanceof Error ? reason.message : t('delete_preview_error'));
        } finally {
            if (lifetime.active && previewVersion === lifetime.previewVersion) setIsDeletePreviewLoading(false);
        }
    }, [client, slug, t, lifetime, previewLifetime]);

    const openBulkDeletePreview = useCallback(async () => {
        if (!lifetime.active || !lifetime.canWrite || !selectionLifetime.active || !hasSelection) {
            return;
        }
        if (lifetime.busy) return;
        previewLifetime.active = false;
        const previewVersion = ++lifetime.previewVersion;
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
            if (!lifetime.active || !lifetime.canWrite || previewVersion !== lifetime.previewVersion) return;
            setDeletePreview(preview);
        } catch (reason: unknown) {
            if (!lifetime.active || previewVersion !== lifetime.previewVersion) return;
            setDeletePreviewError(reason instanceof Error ? reason.message : t('delete_preview_error'));
        } finally {
            if (lifetime.active && previewVersion === lifetime.previewVersion) setIsDeletePreviewLoading(false);
            if (lifetime.active && previewVersion === lifetime.previewVersion) setBulkActionMenuAnchor(null);
        }
    }, [client, hasSelection, isAllMatchingSelected, selectedIds, selectionScope, slug, t, lifetime, selectionLifetime, previewLifetime]);

    const handleConfirmDelete = useCallback(async () => {
        if (!lifetime.active || !lifetime.canWrite) return;
        if (pendingDeleteMode === 'single' && pendingDeleteIds.length === 0) {
            return;
        }
        if (pendingDeleteMode === 'bulk' && pendingDeleteIds.length === 0 && !pendingDeleteSelectAll) {
            return;
        }

        if (!previewLifetime.active || lifetime.busy || !deletePreviewOpen || isDeletePreviewLoading || !deletePreview?.can_delete || deletePreviewError) return;
        lifetime.busy = true;
        const previewVersion = lifetime.previewVersion;
        const selectionVersion = lifetime.selectionVersion;
        setIsDeleteSubmitting(true);
        setError(null);
        try {
            let successMessage: string;
            if (pendingDeleteMode === 'single') {
                await client.deleteItem(slug, pendingDeleteIds[0]);
                successMessage = t('object_deleted_success');
            } else {
                const response = await client.bulkDelete(
                    slug,
                    pendingDeleteIds,
                    pendingDeleteSelectAll && pendingDeleteScope
                        ? {selectAll: true, selectionScope: pendingDeleteScope}
                        : undefined,
                );
                successMessage = t('delete_success', {count: response.deleted});
            }
            invalidateModelCache(client, slug);
            if (!lifetime.active) return;
            await refreshRef.current?.();
            if (!lifetime.active || previewVersion !== lifetime.previewVersion) return;
            message.success(successMessage);
            setDeletePreviewOpen(false);
            setDeletePreview(null);
            setDeletePreviewError(null);
            setPendingDeleteIds([]);
            setPendingDeleteSelectAll(false);
            setPendingDeleteScope(null);
            if (selectionVersion === lifetime.selectionVersion) clearSelection();
        } catch (reason: unknown) {
            if (!lifetime.active || previewVersion !== lifetime.previewVersion) return;
            const nextError = reason instanceof Error ? reason.message : t('object_delete_error');
            setDeletePreviewError(nextError);
            message.error(nextError);
        } finally {
            lifetime.busy = false;
            if (lifetime.active) setIsDeleteSubmitting(false);
        }
    }, [clearSelection, client, message, pendingDeleteIds, pendingDeleteMode, pendingDeleteScope, pendingDeleteSelectAll, slug, t, lifetime, deletePreviewOpen, isDeletePreviewLoading, deletePreview, deletePreviewError, previewLifetime]);

    const handleRunNamedBulkAction = useCallback(async (actionSlug: string) => {
        if (!lifetime.active || !lifetime.canWrite || !selectionLifetime.active || lifetime.busy || !actionSlug || !hasSelection) {
            return;
        }

        if (actionSlug === 'delete') {
            await openBulkDeletePreview();
            return;
        }

        const action = bulkActions.find((item) => item.slug === actionSlug);
        if ((action?.form?.length ?? 0) > 0) {
            setBulkActionMenuAnchor(null);
            lifetime.formVersion += 1;
            setBulkActionFormSlug(actionSlug);
            setBulkActionFormOpen(true);
            return;
        }

        if (!action) return;
        lifetime.busy = true;
        const selectionVersion = lifetime.selectionVersion;
        setIsBulkSubmitting(true);
        try {
            const response = await client.runBulkAction(
                slug,
                actionSlug,
                isAllMatchingSelected ? [] : selectedIds,
                undefined,
                isAllMatchingSelected ? {selectAll: true, selectionScope} : undefined,
            );
            invalidateModelCache(client, slug);
            if (!lifetime.active) return;
            setBulkActionMenuAnchor(null);
            await refreshRef.current?.();
            if (!lifetime.active) return;
            if (selectionVersion === lifetime.selectionVersion) clearSelection();
            const actionLabel = bulkActions.find((item) => item.slug === actionSlug)?.label ?? actionSlug;
            message.success(t('action_success', {action: actionLabel, count: response.processed}));
        } catch (reason: unknown) {
            if (!lifetime.active) return;
            const nextError = reason instanceof Error ? reason.message : t('object_action_error');
            setError(nextError);
            message.error(nextError);
        } finally {
            lifetime.busy = false;
            if (lifetime.active) setIsBulkSubmitting(false);
        }
    }, [bulkActions, clearSelection, client, hasSelection, isAllMatchingSelected, message, openBulkDeletePreview, selectedIds, selectionScope, slug, t, lifetime, selectionLifetime]);

    const handleSubmitBulkActionForm = useCallback(async (payload: Record<string, unknown>) => {
        if (!lifetime.active || !lifetime.canWrite || !selectionLifetime.active || !formLifetime.active || lifetime.busy || !bulkActionFormOpen || !bulkActionFormSlug || !hasSelection) {
            return;
        }

        lifetime.busy = true;
        const formVersion = lifetime.formVersion;
        const selectionVersion = lifetime.selectionVersion;
        setIsBulkSubmitting(true);
        try {
            const response = await client.runBulkAction(
                slug, bulkActionFormSlug, isAllMatchingSelected ? [] : selectedIds, payload,
                isAllMatchingSelected ? {selectAll: true, selectionScope} : undefined,
            );
            invalidateModelCache(client, slug);
            if (!lifetime.active) return;
            await refreshRef.current?.();
            if (!lifetime.active || formVersion !== lifetime.formVersion) return;
            setBulkActionFormOpen(false);
            if (selectionVersion === lifetime.selectionVersion) clearSelection();
            const actionLabel = bulkActions.find((item) => item.slug === bulkActionFormSlug)?.label ?? bulkActionFormSlug;
            message.success(t('action_success', {action: actionLabel, count: response.processed}));
        } catch (reason: unknown) {
            if (lifetime.active && formVersion === lifetime.formVersion) throw reason;
        } finally {
            lifetime.busy = false;
            if (lifetime.active) setIsBulkSubmitting(false);
        }
    }, [bulkActionFormSlug, bulkActions, clearSelection, client, hasSelection, isAllMatchingSelected, message, selectedIds, selectionScope, slug, t, lifetime, bulkActionFormOpen, selectionLifetime, formLifetime]);

    const handleCloseBulkActionForm = useCallback(() => {
        if (!lifetime.active) return;
        lifetime.formVersion += 1;
        formLifetime.active = false;
        setBulkActionFormOpen(false);
    }, [formLifetime, lifetime]);

    const activeBulkAction = useMemo(
        () => bulkActions.find((item) => item.slug === bulkActionFormSlug) ?? null,
        [bulkActionFormSlug, bulkActions],
    );

    const handleRowDelete = useCallback(async (rowId: string | number) => {
        if (!lifetime.active) return;
        setRowActionMenuAnchor(null);
        setRowActionMenuId(null);
        await openSingleDeletePreview(rowId);
    }, [openSingleDeletePreview, lifetime]);

    const handleToggleSelection = useCallback((rowId: string | number, checked: boolean) => {
        if (!lifetime.active) return;
        lifetime.selectionVersion += 1;
        lifetime.formVersion += 1;
        setBulkActionFormOpen(false);
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
    }, [isAllMatchingSelected, meta, rows, lifetime]);

    const handleToggleAllVisible = useCallback((checked: boolean) => {
        if (!lifetime.active) return;
        lifetime.selectionVersion += 1;
        lifetime.formVersion += 1;
        setBulkActionFormOpen(false);
        if (!meta) {
            return;
        }

        if (checked) {
            setIsAllMatchingSelected(false);
            setSelectedIds(rows.map((row) => row[meta.pk_field] as string | number));
            return;
        }

        clearSelection();
    }, [clearSelection, meta, rows, lifetime]);

    const handleSelectAllMatching = useCallback(() => {
        if (!lifetime.active) return;
        lifetime.selectionVersion += 1;
        lifetime.formVersion += 1;
        setBulkActionFormOpen(false);
        if (!hasSelection || total === 0) {
            return;
        }
        setSelectedIds([]);
        setIsAllMatchingSelected(true);
    }, [hasSelection, total, lifetime]);

    const clearBulkDeleteState = useCallback(() => {
        if (!lifetime.active) return;
        setPendingDeleteIds([]);
        setPendingDeleteSelectAll(false);
        setPendingDeleteScope(null);
    }, [lifetime]);

    const handleClearDeletePreview = useCallback(() => {
        if (!lifetime.active || lifetime.busy) return;
        lifetime.previewVersion += 1;
        previewLifetime.active = false;
        setIsDeletePreviewLoading(false);
        setDeletePreviewOpen(false);
        setDeletePreview(null);
        setDeletePreviewError(null);
        clearBulkDeleteState();
    }, [clearBulkDeleteState, lifetime, previewLifetime]);

    const handleOpenRowMenu = useCallback((event: { currentTarget: HTMLElement }, rowId: string | number) => {
        if (!lifetime.active || !lifetime.canWrite) return;
        setRowActionMenuAnchor(event.currentTarget as HTMLElement);
        setRowActionMenuId(rowId);
    }, [lifetime]);

    const handleCloseRowMenu = useCallback(() => {
        if (!lifetime.active) return;
        setRowActionMenuAnchor(null);
        setRowActionMenuId(null);
    }, [lifetime]);

    const handleCloseBulkActionMenu = useCallback(() => {
        if (!lifetime.active) return;
        setBulkActionMenuAnchor(null);
    }, [lifetime]);

    return {
        canWrite,
        bulkActionFormOpen,
        isBulkSubmitting,
        allVisibleSelected,
        appliedFilters,
        appliedQuery,
        bulkActionMenuAnchor,
        bulkActions,
        activeBulkAction,
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
        handleCloseBulkActionForm,
        handleCloseRowMenu,
        handleConfirmDelete,
        handleFilterChange,
        handleOpenRowMenu,
        handlePageChange,
        handlePageInputCommit,
        handleResetFilters,
        handleRowDelete,
        handleRunNamedBulkAction,
        handleSubmitBulkActionForm,
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
