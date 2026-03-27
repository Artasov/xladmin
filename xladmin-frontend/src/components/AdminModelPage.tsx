'use client';

import {usePathname, useSearchParams} from 'next/navigation.js';
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    IconButton,
    LinearProgress,
    Menu,
    MenuItem,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableSortLabel,
    TextField,
    Typography,
} from '@mui/material';
import type {XLAdminClient} from '../client';
import type {AdminFieldMeta, AdminListResponse} from '../types';
import {formatAdminValue} from '../utils/adminFields';
import {AdminFormDialog} from './AdminFormDialog';
import {AdminNavLink} from './AdminNavLink';
import {MainHeader, MainHeaderSkeleton} from './layout/MainHeader';

type AdminModelPageProps = {
    client: XLAdminClient;
    basePath: string;
    slug: string;
};

type AdminModelRowProps = {
    row: Record<string, unknown>;
    pkField: string;
    listFields: string[];
    basePath: string;
    slug: string;
    isSelected: boolean;
    onToggleSelection: (rowId: string | number, checked: boolean) => void;
    onOpenMenu: (event: React.MouseEvent<HTMLElement>, rowId: string | number) => void;
};

type AdminListRequestParams = {
    limit?: number;
    offset?: number;
    q?: string;
    sort?: string;
};

const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const inFlightListRequests = new Map<string, Promise<AdminListResponse>>();
const listResponseCache = new Map<string, AdminListResponse>();

export function AdminModelPage({client, basePath, slug}: AdminModelPageProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') ?? '';
    const initialSort = searchParams.get('sort') ?? '';
    const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [data, setData] = useState<AdminListResponse | null>(() => (
        findCachedInitialListResponse(slug, initialQuery || undefined, initialSort || undefined)
    ));
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(data === null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [rowActionMenuAnchor, setRowActionMenuAnchor] = useState<HTMLElement | null>(null);
    const [rowActionMenuId, setRowActionMenuId] = useState<string | number | null>(null);
    const [bulkActionMenuAnchor, setBulkActionMenuAnchor] = useState<HTMLElement | null>(null);
    const [queryInput, setQueryInput] = useState(initialQuery);
    const [appliedQuery, setAppliedQuery] = useState(initialQuery);
    const [sortValue, setSortValue] = useState(initialSort);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const dataRef = useRef<AdminListResponse | null>(data);
    const requestIdRef = useRef(0);
    const appendOffsetsRef = useRef<Set<number>>(new Set());
    const isAppendingRef = useRef(false);

    const sortFields = useMemo(() => sortValue.split(',').filter(Boolean), [sortValue]);
    const meta = data?.meta ?? null;
    const rows = data?.items ?? [];
    const total = data?.pagination.total ?? 0;
    const pageSize = meta?.page_size ?? DEFAULT_PAGE_SIZE;
    const fieldMap = useMemo(
        () => new Map((meta?.fields ?? []).map((field) => [field.name, field])),
        [meta?.fields],
    );
    const listFields = meta?.list_fields ?? [];
    const bulkActions = meta?.bulk_actions ?? [];
    const selectedIdSet = useMemo(
        () => new Set(selectedIds.map((item) => String(item))),
        [selectedIds],
    );

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            setAppliedQuery(queryInput);
            replaceUrlParams(pathname, queryInput, sortValue);
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [pathname, queryInput, sortValue]);

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const nextQuery = params.get('q') ?? '';
            const nextSort = params.get('sort') ?? '';
            setQueryInput(nextQuery);
            setAppliedQuery(nextQuery);
            setSortValue(nextSort);
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const loadItems = useCallback(async (append: boolean) => {
        const currentData = dataRef.current;
        const offset = append ? (currentData?.items.length ?? 0) : 0;
        const activeRequestId = append ? requestIdRef.current : requestIdRef.current + 1;
        const requestParams = {
            q: appliedQuery || undefined,
            sort: sortValue || undefined,
            limit: pageSize,
            offset,
        };

        if (append) {
            if (isAppendingRef.current || appendOffsetsRef.current.has(offset)) {
                return;
            }
            isAppendingRef.current = true;
            appendOffsetsRef.current.add(offset);
            setIsLoadingMore(true);
        } else {
            requestIdRef.current = activeRequestId;
            appendOffsetsRef.current.clear();
            setError(null);

            const cachedResponse = offset === 0
                ? findCachedInitialListResponse(slug, requestParams.q, requestParams.sort)
                : listResponseCache.get(buildListRequestKey(slug, requestParams));
            if (cachedResponse) {
                setData(cachedResponse);
                setIsLoading(false);
                setSelectedIds([]);
                return;
            }

            setIsLoading(true);
        }

        try {
            const response = await requestListItems(client, slug, requestParams);
            if (activeRequestId !== requestIdRef.current) {
                return;
            }

            setData((previousData) => {
                if (!append || !previousData) {
                    return response;
                }
                return mergeListResponse(previousData, response);
            });

            if (!append) {
                setSelectedIds([]);
            }
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Не удалось загрузить модель.');
        } finally {
            if (append) {
                isAppendingRef.current = false;
                setIsLoadingMore(false);
            } else {
                setIsLoading(false);
            }
        }
    }, [appliedQuery, client, pageSize, slug, sortValue]);

    useEffect(() => {
        void loadItems(false);
    }, [loadItems]);

    const refresh = useCallback(async () => {
        await loadItems(false);
    }, [loadItems]);

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
        replaceUrlParams(pathname, queryInput, nextSortValue);
    }, [pathname, queryInput, sortFields]);

    const handleRunNamedBulkAction = useCallback(async (actionSlug: string) => {
        if (!actionSlug || selectedIds.length === 0) {
            return;
        }

        if (actionSlug === 'delete') {
            await client.bulkDelete(slug, selectedIds);
        } else {
            await client.runBulkAction(slug, actionSlug, selectedIds);
        }

        setBulkActionMenuAnchor(null);
        await refresh();
    }, [client, refresh, selectedIds, slug]);

    const handleRowDelete = useCallback(async (rowId: string | number) => {
        await client.deleteItem(slug, rowId);
        setRowActionMenuAnchor(null);
        setRowActionMenuId(null);
        await refresh();
    }, [client, refresh, slug]);

    const handleTableScroll = useCallback(async () => {
        const element = scrollContainerRef.current;
        if (!element || isLoading || isLoadingMore || rows.length >= total) {
            return;
        }

        const remainingPixels = element.scrollHeight - element.scrollTop - element.clientHeight;
        if (remainingPixels > 200) {
            return;
        }

        await loadItems(true);
    }, [isLoading, isLoadingMore, loadItems, rows.length, total]);

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

    const handleOpenRowMenu = useCallback((event: React.MouseEvent<HTMLElement>, rowId: string | number) => {
        setRowActionMenuAnchor(event.currentTarget);
        setRowActionMenuId(rowId);
    }, []);

    if (isLoading && !data) {
        return <AdminModelPageSkeleton />;
    }

    if (!isLoading && error && !data) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (!data || !meta) {
        return <AdminModelPageSkeleton />;
    }

    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeader
                title={meta.title}
                subtitle={`${meta.slug} · ${total} объектов`}
            />

            <Paper
                sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    flexShrink: 0,
                }}
            >
                <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5} alignItems={{lg: 'center'}}>
                    <TextField
                        size="small"
                        placeholder="Поиск"
                        value={queryInput}
                        onChange={(event) => setQueryInput(event.target.value)}
                        sx={{minWidth: {xs: '100%', lg: 360}}}
                    />

                    {selectedIds.length > 0 ? (
                        <Stack direction="row" spacing={1} sx={{flex: 1, minWidth: 0}}>
                            <Button
                                variant="outlined"
                                endIcon={<ExpandMoreIcon />}
                                onClick={(event) => setBulkActionMenuAnchor(event.currentTarget)}
                            >
                                Действия
                            </Button>
                            <Typography color="text.secondary" sx={{alignSelf: 'center'}}>
                                Выбрано: {selectedIds.length}
                            </Typography>
                        </Stack>
                    ) : null}

                    <Box sx={{marginLeft: 'auto'}}>
                        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>
                            Создать
                        </Button>
                    </Box>
                </Stack>
            </Paper>

            <Paper
                sx={{
                    borderRadius: '10px',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                }}
            >
                <Box
                    ref={scrollContainerRef}
                    onScroll={() => void handleTableScroll()}
                    sx={{
                        height: '100%',
                        overflow: 'auto',
                    }}
                >
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox" />
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
                                                        '&.Mui-active': {
                                                            color: 'rgba(255, 255, 255, 0.96)',
                                                        },
                                                        '& .MuiTableSortLabel-icon': {
                                                            color: 'rgba(255, 255, 255, 0.72) !important',
                                                        },
                                                        '&:hover': {
                                                            color: '#ffffff',
                                                        },
                                                    }}
                                                >
                                                    {field?.label ?? fieldName}
                                                </TableSortLabel>
                                            ) : (
                                                <Typography component="span" sx={{fontSize: 14, fontWeight: 700, color: 'rgba(255, 255, 255, 0.96)'}}>
                                                    {field?.label ?? fieldName}
                                                </Typography>
                                            )}
                                        </TableCell>
                                    );
                                })}
                                <TableCell align="right" sx={{backgroundColor: '#171719', width: 56}} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => {
                                const rowId = row[meta.pk_field] as string | number;
                                return (
                                    <AdminModelRow
                                        key={String(rowId)}
                                        row={row}
                                        pkField={meta.pk_field}
                                        listFields={listFields}
                                        basePath={basePath}
                                        slug={slug}
                                        isSelected={selectedIdSet.has(String(rowId))}
                                        onToggleSelection={handleToggleSelection}
                                        onOpenMenu={handleOpenRowMenu}
                                    />
                                );
                            })}
                        </TableBody>
                    </Table>
                    {isLoadingMore ? <LinearProgress /> : null}
                </Box>
            </Paper>

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
                    Удалить
                </MenuItem>
            </Menu>

            <AdminFormDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={() => void refresh()}
                title={`Создать: ${meta.title}`}
                slug={slug}
                mode="create"
                meta={meta}
                client={client}
            />
        </Stack>
    );
}

const AdminModelRow = memo(function AdminModelRow({
    row,
    pkField,
    listFields,
    basePath,
    slug,
    isSelected,
    onToggleSelection,
    onOpenMenu,
}: AdminModelRowProps) {
    const rowId = row[pkField] as string | number;

    return (
        <TableRow
            hover
            sx={{
                transition: 'background-color 180ms ease',
                '& > .MuiTableCell-root': {
                    transition: 'background-color 180ms ease, border-color 180ms ease',
                },
                '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.032)',
                },
            }}
        >
            <TableCell padding="checkbox">
                <Checkbox
                    checked={isSelected}
                    onChange={(_, checked) => onToggleSelection(rowId, checked)}
                />
            </TableCell>
            {listFields.map((fieldName, index) => {
                const fieldValue = formatAdminValue(row[fieldName]);
                if (index === 0) {
                    return (
                        <TableCell key={fieldName}>
                            <AdminNavLink
                                href={`${basePath}/${slug}/${rowId}`}
                                style={{
                                    textDecoration: 'none',
                                    transition: 'color 160ms ease, opacity 160ms ease',
                                }}
                            >
                                {fieldValue}
                            </AdminNavLink>
                        </TableCell>
                    );
                }
                return <TableCell key={fieldName}>{fieldValue}</TableCell>;
            })}
            <TableCell align="right">
                <IconButton size="small" onClick={(event) => onOpenMenu(event, rowId)}>
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            </TableCell>
        </TableRow>
    );
});

function AdminModelPageSkeleton() {
    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeaderSkeleton titleWidth={240} subtitleWidth="38%" />

            <Paper sx={{p: 1.5, borderRadius: '10px', flexShrink: 0}}>
                <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5} alignItems={{lg: 'center'}}>
                    <Skeleton variant="rounded" width={360} height={40} />
                    <Box sx={{marginLeft: 'auto'}}>
                        <Skeleton variant="rounded" width={128} height={40} />
                    </Box>
                </Stack>
            </Paper>

            <Paper sx={{borderRadius: '10px', flex: 1, minHeight: 0, overflow: 'hidden'}}>
                <Box sx={{height: '100%', overflow: 'auto', p: 1.5}}>
                    <Stack spacing={1}>
                        <Skeleton variant="rounded" width="100%" height={42} />
                        {Array.from({length: 10}).map((_, index) => (
                            <Skeleton key={index} variant="rounded" width="100%" height={48} />
                        ))}
                    </Stack>
                </Box>
            </Paper>
        </Stack>
    );
}

function mergeListResponse(
    previousData: AdminListResponse,
    nextData: AdminListResponse,
): AdminListResponse {
    const pkField = nextData.meta.pk_field;
    const itemsById = new Map<string, Record<string, unknown>>();
    for (const item of [...previousData.items, ...nextData.items]) {
        itemsById.set(String(item[pkField]), item);
    }
    return {
        ...nextData,
        items: [...itemsById.values()],
    };
}

function resolveSortDirection(sortFields: string[], fieldName: string): 'asc' | 'desc' | null {
    if (sortFields.includes(`-${fieldName}`)) {
        return 'desc';
    }
    if (sortFields.includes(fieldName)) {
        return 'asc';
    }
    return null;
}

function resolveFieldSortable(field: AdminFieldMeta | undefined): boolean {
    if (!field) {
        return false;
    }
    if (field.is_sortable === true) {
        return true;
    }
    if (field.is_sortable === false) {
        return false;
    }
    if (field.is_relation_many || field.input_kind === 'relation-multiple') {
        return false;
    }
    if (field.is_virtual) {
        return false;
    }
    return true;
}

function replaceUrlParams(pathname: string | null, query: string, sort: string): void {
    const params = new URLSearchParams(window.location.search);
    if (query) {
        params.set('q', query);
    } else {
        params.delete('q');
    }
    if (sort) {
        params.set('sort', sort);
    } else {
        params.delete('sort');
    }
    const nextPath = pathname ?? window.location.pathname;
    const nextUrl = params.toString() ? `${nextPath}?${params.toString()}` : nextPath;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function requestListItems(
    client: XLAdminClient,
    slug: string,
    params: AdminListRequestParams,
) {
    const requestKey = buildListRequestKey(slug, params);
    const cachedResponse = listResponseCache.get(requestKey);
    if (cachedResponse) {
        return Promise.resolve(cachedResponse);
    }

    const existingRequest = inFlightListRequests.get(requestKey);
    if (existingRequest) {
        return existingRequest;
    }

    const request = client.getItems(slug, params)
        .then((response) => {
            listResponseCache.set(requestKey, response);
            return response;
        })
        .finally(() => {
            inFlightListRequests.delete(requestKey);
        });

    inFlightListRequests.set(requestKey, request);
    return request;
}

function buildListRequestKey(slug: string, params: AdminListRequestParams): string {
    return JSON.stringify({
        slug,
        q: params.q ?? null,
        sort: params.sort ?? null,
        limit: params.limit ?? DEFAULT_PAGE_SIZE,
        offset: params.offset ?? 0,
    });
}

function findCachedInitialListResponse(
    slug: string,
    query?: string,
    sort?: string,
): AdminListResponse | null {
    for (const [cacheKey, response] of listResponseCache.entries()) {
        const parsedKey = JSON.parse(cacheKey) as {
            slug: string;
            q: string | null;
            sort: string | null;
            offset: number;
        };

        if (
            parsedKey.slug === slug
            && (parsedKey.q ?? undefined) === query
            && (parsedKey.sort ?? undefined) === sort
            && parsedKey.offset === 0
        ) {
            return response;
        }
    }

    return null;
}
