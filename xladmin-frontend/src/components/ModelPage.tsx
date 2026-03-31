'use client';

import type {MouseEvent} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    InputBase,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableSortLabel,
    Tooltip,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {
    buildListCacheKey,
    getClientCacheBucket,
    getModelCacheVersion,
    invalidateModelCache,
    setCachedListResponse,
} from '../cache';
import type {XLAdminClient} from '../client';
import {useAdminDocumentTitle} from '../hooks/useAdminDocumentTitle';
import {useAdminLocale, useAdminTranslation} from '../i18n';
import type {XLAdminRouter} from '../router';
import {buildUrlWithParams, XLAdminRouterProvider, useXLAdminLocation, useXLAdminRouter} from '../router';
import type {AdminDeletePreviewResponse, AdminFieldMeta, AdminListResponse} from '../types';
import {getListFieldWidthPx} from '../utils/adminFields';
import {DeletePreviewDialog} from './DeletePreviewDialog';
import {FormDialog} from './FormDialog';
import {MainHeader} from './layout/MainHeader';
import {ListFiltersSidebar} from './model-page/ListFiltersBar';
import {ListRow} from './model-page/ListRow';
import {SearchField} from './model-page/SearchField';
import {ModelPageSkeleton, ModelTableSkeleton} from './model-page/Skeletons';

type AdminModelPageProps = {
    client: XLAdminClient;
    basePath: string;
    slug: string;
    router?: XLAdminRouter;
};

export type ModelPageProps = AdminModelPageProps;

type AdminListRequestParams = {
    limit?: number;
    offset?: number;
    q?: string;
    sort?: string;
    [key: string]: unknown;
};

const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const CHECKBOX_COLUMN_WIDTH = 56;
const ACTIONS_COLUMN_WIDTH = 56;

export function ModelPage({client, basePath, slug, router}: ModelPageProps) {
    const locale = useAdminLocale();
    const t = useAdminTranslation();
    const resolvedRouter = useXLAdminRouter(router);
    const location = useXLAdminLocation(resolvedRouter);
    const pathname = location.pathname;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
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
    const [pendingDeleteMode, setPendingDeleteMode] = useState<'single' | 'bulk'>('single');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const requestIdRef = useRef(0);
    const dataRef = useRef<AdminListResponse | null>(initialCachedResponse);
    const pageSizeRef = useRef<number>(initialCachedResponse?.meta.page_size ?? DEFAULT_PAGE_SIZE);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
    const selectedIdSet = useMemo(() => new Set(selectedIds.map((item) => String(item))), [selectedIds]);
    const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIdSet.has(String(row[meta?.pk_field ?? 'id'])));
    const hasVisibleSelection = rows.some((row) => selectedIdSet.has(String(row[meta?.pk_field ?? 'id'])));

    useAdminDocumentTitle(t('admin_title'), meta?.title ?? slug);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    useEffect(() => {
        const nextQuery = searchParams.get('q') ?? '';
        const nextSort = searchParams.get('sort') ?? '';
        const nextPage = parsePageParam(searchParams.get('page'));
        const nextFilters = extractFilterParams(searchParams);
        setAppliedQuery(nextQuery);
        setSortValue(nextSort);
        setCurrentPage(nextPage);
        setPageInput(String(nextPage));
        setAppliedFilters(nextFilters);
    }, [searchParams]);

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
            setSelectedIds([]);
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
            setSelectedIds([]);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('model_load_error'));
        } finally {
            if (activeRequestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [appliedFilters, appliedQuery, client, currentPage, slug, sortValue, t]);

    useEffect(() => {
        void loadItems();
    }, [loadItems]);

    const refresh = useCallback(async () => {
        invalidateModelCache(client, slug);
        await loadItems();
    }, [client, loadItems, slug]);

    const handleSearchCommit = useCallback((nextQuery: string) => {
        if (nextQuery === appliedQuery) {
            return;
        }
        setAppliedQuery(nextQuery);
        setCurrentPage(1);
        setPageInput('1');
        resolvedRouter.replace(buildUrlWithParams(pathname, nextQuery, sortValue, 1, appliedFilters));
    }, [appliedFilters, appliedQuery, pathname, resolvedRouter, sortValue]);

    const handlePageChange = useCallback((nextPage: number) => {
        const safePage = Math.min(Math.max(nextPage, 1), totalPages);
        setCurrentPage(safePage);
        setPageInput(String(safePage));
        resolvedRouter.replace(buildUrlWithParams(pathname, appliedQuery, sortValue, safePage, appliedFilters));
    }, [appliedFilters, appliedQuery, pathname, resolvedRouter, sortValue, totalPages]);

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
        resolvedRouter.replace(buildUrlWithParams(pathname, appliedQuery, nextSortValue, 1, appliedFilters));
    }, [appliedFilters, appliedQuery, pathname, resolvedRouter, sortFields]);

    const handleFilterChange = useCallback((filterSlug: string, value: string) => {
        const nextFilters = {
            ...appliedFilters,
            [filterSlug]: value,
        };
        if (!value) {
            delete nextFilters[filterSlug];
        }
        setAppliedFilters(nextFilters);
        setCurrentPage(1);
        setPageInput('1');
        resolvedRouter.replace(buildUrlWithParams(pathname, appliedQuery, sortValue, 1, nextFilters));
    }, [appliedFilters, appliedQuery, pathname, resolvedRouter, sortValue]);

    const handleResetFilters = useCallback(() => {
        if (Object.keys(appliedFilters).length === 0) {
            return;
        }
        setAppliedFilters({});
        setCurrentPage(1);
        setPageInput('1');
        resolvedRouter.replace(buildUrlWithParams(pathname, appliedQuery, sortValue, 1, {}));
    }, [appliedFilters, appliedQuery, pathname, resolvedRouter, sortValue]);

    const openSingleDeletePreview = useCallback(async (rowId: string | number) => {
        setPendingDeleteIds([rowId]);
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
        if (selectedIds.length === 0) {
            return;
        }
        setPendingDeleteIds(selectedIds);
        setPendingDeleteMode('bulk');
        setDeletePreviewOpen(true);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(true);
        try {
            const preview = await client.getBulkDeletePreview(slug, selectedIds);
            setDeletePreview(preview);
        } catch (reason: unknown) {
            setDeletePreviewError(reason instanceof Error ? reason.message : t('delete_preview_error'));
        } finally {
            setIsDeletePreviewLoading(false);
            setBulkActionMenuAnchor(null);
        }
    }, [client, selectedIds, slug, t]);

    const handleConfirmDelete = useCallback(async () => {
        if (pendingDeleteIds.length === 0) {
            return;
        }

        setIsDeleteSubmitting(true);
        setError(null);
        try {
            if (pendingDeleteMode === 'single') {
                await client.deleteItem(slug, pendingDeleteIds[0]);
            } else {
                await client.bulkDelete(slug, pendingDeleteIds);
            }
            setDeletePreviewOpen(false);
            setDeletePreview(null);
            setDeletePreviewError(null);
            setPendingDeleteIds([]);
            await refresh();
        } catch (reason: unknown) {
            setDeletePreviewError(reason instanceof Error ? reason.message : t('object_delete_error'));
        } finally {
            setIsDeleteSubmitting(false);
        }
    }, [client, pendingDeleteIds, pendingDeleteMode, refresh, slug, t]);

    const handleRunNamedBulkAction = useCallback(async (actionSlug: string) => {
        if (!actionSlug || selectedIds.length === 0) {
            return;
        }

        if (actionSlug === 'delete') {
            await openBulkDeletePreview();
            return;
        }

        try {
            await client.runBulkAction(slug, actionSlug, selectedIds);
            setBulkActionMenuAnchor(null);
            await refresh();
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('object_action_error'));
        }
    }, [client, openBulkDeletePreview, refresh, selectedIds, slug, t]);

    const handleRowDelete = useCallback(async (rowId: string | number) => {
        setRowActionMenuAnchor(null);
        setRowActionMenuId(null);
        await openSingleDeletePreview(rowId);
    }, [openSingleDeletePreview]);

    const handleToggleSelection = useCallback((rowId: string | number, checked: boolean) => {
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
    }, []);

    const handleToggleAllVisible = useCallback((checked: boolean) => {
        if (!meta) {
            return;
        }

        if (checked) {
            setSelectedIds(rows.map((row) => row[meta.pk_field] as string | number));
            return;
        }

        setSelectedIds([]);
    }, [meta, rows]);

    const handleOpenRowMenu = useCallback((event: MouseEvent<HTMLElement>, rowId: string | number) => {
        setRowActionMenuAnchor(event.currentTarget);
        setRowActionMenuId(rowId);
    }, []);

    if (!isLoading && error && !data) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (!data || !meta) {
        return <ModelPageSkeleton/>;
    }

    return (
        <XLAdminRouterProvider router={resolvedRouter}>
            <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
                <MainHeader
                title={meta.title}
                actions={(
                    <Tooltip title={t('create')}>
                        <IconButton
                            aria-label={t('create')}
                            onClick={() => setCreateOpen(true)}
                            sx={{
                                width: 30,
                                height: 30,
                                p: 0.5,
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                '&:hover': {
                                    backgroundColor: 'primary.dark',
                                },
                            }}
                        >
                            <AddIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                )}
                subtitle={`${meta.slug} · ${t('objects_count', {count: total})}`}
                details={meta.description ? (
                    <Typography color="text.secondary" sx={{fontSize: 14, lineHeight: 1.45}}>
                        {meta.description}
                    </Typography>
                ) : undefined}
            />

            <Paper
                sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    flexShrink: 0,
                }}
            >
                <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5} alignItems={{lg: 'center'}}>
                    <Stack direction={{xs: 'column', xl: 'row'}} spacing={1.5} sx={{flex: 1, minWidth: 0}}>
                        <SearchField
                            value={appliedQuery}
                            onCommit={handleSearchCommit}
                            debounceMs={SEARCH_DEBOUNCE_MS}
                            placeholder={t('search')}
                        />
                    </Stack>

                    {selectedIds.length > 0 ? (
                        <Stack direction="row" spacing={1} sx={{flex: {lg: 1}, minWidth: 0}}>
                            <Button
                                variant="outlined"
                                endIcon={<ExpandMoreIcon/>}
                                onClick={(event) => setBulkActionMenuAnchor(event.currentTarget)}
                            >
                                {t('actions')}
                            </Button>
                            <Typography color="text.secondary" sx={{alignSelf: 'center'}}>
                                {t('selected_count', {count: selectedIds.length})}
                            </Typography>
                        </Stack>
                    ) : null}

                    <Stack direction="row" spacing={1} alignItems="center" sx={{marginLeft: 'auto'}}>
                        {isMobile && hasListFilters ? (
                            <Tooltip title={t('filters')}>
                                <IconButton
                                    size="small"
                                    aria-label={t('filters')}
                                    onClick={() => setFiltersOpen(true)}
                                >
                                    <FilterListIcon fontSize="small"/>
                                </IconButton>
                            </Tooltip>
                        ) : null}
                        <IconButton
                            size="small"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                            sx={{mr: '-5px'}}
                        >
                            <ChevronLeftIcon fontSize="small"/>
                        </IconButton>
                        <InputBase
                            value={pageInput}
                            onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, '') || '1')}
                            onBlur={handlePageInputCommit}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    handlePageInputCommit();
                                }
                            }}
                            inputProps={{inputMode: 'numeric'}}
                            sx={{
                                width: `${Math.max(String(totalPages).length, String(currentPage).length, 1)}ch`,
                                minWidth: '1ch',
                                mr: 0.5,
                                fontSize: '1rem',
                                lineHeight: '1rem',
                                fontWeight: 400,
                                color: 'text.primary',
                                '& input': {
                                    padding: 0,
                                    textAlign: 'right',
                                    fontSize: '1rem',
                                    lineHeight: '1rem',
                                    fontWeight: 400,
                                },
                            }}
                        />
                        <Typography color="text.secondary"
                                    sx={{minWidth: 'auto', fontSize: '1rem', lineHeight: '1rem'}}>
                            / {totalPages}
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            sx={{ml: '-5px'}}
                        >
                            <ChevronRightIcon fontSize="small"/>
                        </IconButton>
                    </Stack>
                </Stack>
            </Paper>

            <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5} sx={{flex: 1, minHeight: 0}}>
                <Paper
                    sx={{
                        borderRadius: '10px',
                        flex: 1,
                        minWidth: 0,
                        minHeight: 0,
                        overflow: 'hidden',
                    }}
                >
                    {isLoading ? (
                        <ModelTableSkeleton/>
                    ) : (
                        <Box sx={{height: '100%', overflow: 'auto'}}>
                            <Table stickyHeader size="small" sx={{tableLayout: 'fixed'}}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell
                                            padding="none"
                                            sx={{
                                                backgroundColor: '#171719',
                                                width: CHECKBOX_COLUMN_WIDTH,
                                                minWidth: CHECKBOX_COLUMN_WIDTH,
                                                maxWidth: CHECKBOX_COLUMN_WIDTH,
                                                boxSizing: 'border-box',
                                                textAlign: 'center',
                                                px: 1,
                                            }}
                                        >
                                            <Checkbox
                                                checked={allVisibleSelected}
                                                indeterminate={!allVisibleSelected && hasVisibleSelection}
                                                onChange={(_, checked) => handleToggleAllVisible(checked)}
                                            />
                                        </TableCell>
                                        {listFields.map((fieldName) => {
                                            const field = fieldMap.get(fieldName);
                                            const sortDirection = resolveSortDirection(sortFields, fieldName);
                                            const isSortable = resolveFieldSortable(field);

                                            return (
                                                <TableCell
                                                    key={fieldName}
                                                    sortDirection={sortDirection ?? false}
                                                    sx={{
                                                        backgroundColor: '#171719',
                                                        cursor: isSortable ? 'pointer' : 'default',
                                                        userSelect: 'none',
                                                        width: getListFieldWidthPx(field),
                                                        minWidth: getListFieldWidthPx(field),
                                                        maxWidth: getListFieldWidthPx(field),
                                                    }}
                                                    onClick={isSortable ? () => toggleSort(fieldName) : undefined}
                                                >
                                                    {isSortable ? (
                                                        <TableSortLabel
                                                            active={Boolean(sortDirection)}
                                                            direction={sortDirection ?? 'asc'}
                                                            hideSortIcon={false}
                                                            sx={{
                                                                color: 'rgba(255, 255, 255, 0.96)',
                                                                '&.Mui-active': {color: 'rgba(255, 255, 255, 0.96)'},
                                                                '& .MuiTableSortLabel-icon': {color: 'rgba(255, 255, 255, 0.72) !important'},
                                                                '&:hover': {color: '#ffffff'},
                                                            }}
                                                        >
                                                            {field?.label ?? fieldName}
                                                        </TableSortLabel>
                                                    ) : (
                                                        <Typography component="span" sx={{
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                            color: 'rgba(255, 255, 255, 0.96)'
                                                        }}>
                                                            {field?.label ?? fieldName}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell
                                            align="right"
                                            sx={{
                                                backgroundColor: '#171719',
                                                width: ACTIONS_COLUMN_WIDTH,
                                                minWidth: ACTIONS_COLUMN_WIDTH,
                                                maxWidth: ACTIONS_COLUMN_WIDTH,
                                            }}
                                        />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row) => {
                                        const rowId = row[meta.pk_field] as string | number;
                                        return (
                                            <ListRow
                                                key={String(rowId)}
                                                row={row}
                                                pkField={meta.pk_field}
                                                listFields={listFields}
                                                basePath={basePath}
                                                slug={slug}
                                                locale={locale}
                                                fieldMap={fieldMap}
                                                isSelected={selectedIdSet.has(String(rowId))}
                                                onToggleSelection={handleToggleSelection}
                                                onOpenMenu={handleOpenRowMenu}
                                            />
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                </Paper>

                {!isMobile && hasListFilters ? (
                    <ListFiltersSidebar
                        client={client}
                        slug={slug}
                        filters={listFilters}
                        values={appliedFilters}
                        onChange={handleFilterChange}
                        onReset={handleResetFilters}
                        debounceMs={SEARCH_DEBOUNCE_MS}
                    />
                ) : null}
            </Stack>

            <Menu
                anchorEl={bulkActionMenuAnchor}
                open={Boolean(bulkActionMenuAnchor)}
                onClose={() => setBulkActionMenuAnchor(null)}
            >
                {bulkActions.map((action) => (
                    <MenuItem key={action.slug} onClick={() => void handleRunNamedBulkAction(action.slug)}>
                        {action.label}
                    </MenuItem>
                ))}
            </Menu>

            <Menu
                anchorEl={rowActionMenuAnchor}
                open={Boolean(rowActionMenuAnchor)}
                onClose={() => {
                    setRowActionMenuAnchor(null);
                    setRowActionMenuId(null);
                }}
            >
                <MenuItem
                    onClick={() => {
                        if (rowActionMenuId !== null) {
                            void handleRowDelete(rowActionMenuId);
                        }
                    }}
                >
                    {t('delete')}
                </MenuItem>
            </Menu>

            <FormDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={() => void refresh()}
                title={`${t('create')}: ${meta.title}`}
                slug={slug}
                mode="create"
                meta={meta}
                client={client}
            />

            <Dialog
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                fullWidth
                maxWidth="xs"
                slotProps={{
                    paper: {
                        sx: {
                            m: {xs: 1, sm: 2},
                            width: {xs: 'calc(100% - 16px)', sm: undefined},
                            maxWidth: {xs: 'calc(100% - 16px)', sm: 444},
                            maxHeight: {
                                xs: 'calc(100% - 16px)',
                                sm: 'calc(100% - 32px)',
                            },
                        },
                    },
                }}
            >
                <DialogTitle>{t('filters')}</DialogTitle>
                <DialogContent sx={{px: 2, pb: 2}}>
                    {hasListFilters ? (
                        <ListFiltersSidebar
                            client={client}
                            slug={slug}
                            filters={listFilters}
                            values={appliedFilters}
                            onChange={handleFilterChange}
                            onReset={handleResetFilters}
                            debounceMs={SEARCH_DEBOUNCE_MS}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

                <DeletePreviewDialog
                    open={deletePreviewOpen}
                    title={pendingDeleteMode === 'single' ? t('delete_object_title') : t('delete_bulk_title')}
                    preview={deletePreview}
                    error={deletePreviewError}
                    isLoading={isDeletePreviewLoading}
                    isSubmitting={isDeleteSubmitting}
                    onClose={() => {
                        if (isDeleteSubmitting) {
                            return;
                        }
                        setDeletePreviewOpen(false);
                        setDeletePreview(null);
                        setDeletePreviewError(null);
                        setPendingDeleteIds([]);
                    }}
                    onConfirm={() => void handleConfirmDelete()}
                />
            </Stack>
        </XLAdminRouterProvider>
    );
}

function resolveSortDirection(sortFields: string[], fieldName: string): 'asc' | 'desc' | null {
    if (sortFields.includes(`-${fieldName}`)) return 'desc';
    if (sortFields.includes(fieldName)) return 'asc';
    return null;
}

function resolveFieldSortable(field: AdminFieldMeta | undefined): boolean {
    if (!field) {
        return false;
    }

    return (
        field.is_sortable &&
        !field.is_relation_many &&
        field.input_kind !== 'relation-multiple' &&
        !field.is_virtual
    );
}

function requestListItems(client: XLAdminClient, slug: string, params: AdminListRequestParams, requestKey: string) {
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
