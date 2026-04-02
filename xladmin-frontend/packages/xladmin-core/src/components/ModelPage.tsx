'use client';

import type {ReactNode} from 'react';
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
import type {XLAdminClient} from '../client';
import {useAdminDocumentTitle} from '../hooks/useAdminDocumentTitle';
import {useAdminLocale, useAdminTranslation} from '../i18n';
import type {XLAdminRouter} from '../router';
import {XLAdminRouterProvider, useXLAdminLocation, useXLAdminRouter} from '../router';
import type {AdminFieldMeta} from '../types';
import {getListFieldWidthPx} from '../utils/adminFields';
import {DeletePreviewDialog} from './DeletePreviewDialog';
import {FormDialog} from './FormDialog';
import {MainHeader} from './layout/MainHeader';
import {ListFiltersSidebar} from './model-page/ListFiltersBar';
import {ListRow} from './model-page/ListRow';
import {SearchField} from './model-page/SearchField';
import {useModelPageController} from './model-page/useModelPageController';
import {ModelPageSkeleton, ModelTableSkeleton} from './model-page/Skeletons';

type AdminModelPageProps = {
    client: XLAdminClient;
    basePath: string;
    slug: string;
    router?: XLAdminRouter;
    renderBeforePagination?: (context: ModelPageToolbarContext) => ReactNode;
};

export type ModelPageProps = AdminModelPageProps;
export type ModelPageToolbarContext = {
    client: XLAdminClient;
    slug: string;
    meta: {
        slug: string;
        title: string;
    };
    selectedIds: Array<string | number>;
    isAllMatchingSelected: boolean;
    selectionCount: number;
    total: number;
    appliedQuery: string;
    sortValue: string;
    appliedFilters: Record<string, string>;
    refresh: () => Promise<void>;
};

const SEARCH_DEBOUNCE_MS = 300;
const CHECKBOX_COLUMN_WIDTH = 56;
const ACTIONS_COLUMN_WIDTH = 56;

export function ModelPage({client, basePath, slug, router, renderBeforePagination}: ModelPageProps) {
    const locale = useAdminLocale();
    const t = useAdminTranslation();
    const selectAllLabel = locale === 'ru' ? 'Выбрать все' : 'Select All';
    const resolvedRouter = useXLAdminRouter(router);
    const location = useXLAdminLocation(resolvedRouter);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const controller = useModelPageController({
        client,
        slug,
        pathname: location.pathname,
        locationSearch: location.search,
        router: resolvedRouter,
        t,
    });

    useAdminDocumentTitle(t('admin_title'), controller.meta?.title ?? slug);

    if (!controller.isLoading && controller.error && !controller.data) {
        return <Alert severity="error">{controller.error}</Alert>;
    }

    if (!controller.data || !controller.meta) {
        return <ModelPageSkeleton/>;
    }

    const meta = controller.meta;
    const beforePagination = renderBeforePagination?.({
        client,
        slug,
        meta: {
            slug: meta.slug,
            title: meta.title,
        },
        selectedIds: controller.selectedIds,
        isAllMatchingSelected: controller.isAllMatchingSelected,
        selectionCount: controller.selectionCount,
        total: controller.total,
        appliedQuery: controller.appliedQuery,
        sortValue: controller.sortValue,
        appliedFilters: controller.appliedFilters,
        refresh: controller.refresh,
    });

    return (
        <XLAdminRouterProvider router={resolvedRouter}>
            <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
                <MainHeader
                    title={controller.meta.title}
                    actions={(
                        <Tooltip title={t('create')}>
                            <IconButton
                                aria-label={t('create')}
                                onClick={() => controller.setCreateOpen(true)}
                                sx={{
                                    width: 29,
                                    height: 29,
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
                    subtitle={`${controller.meta.slug} | ${t('objects_count', {count: controller.total})}`}
                    details={controller.meta.description ? (
                        <Typography color="text.secondary" sx={{fontSize: 14, lineHeight: 1.45}}>
                            {controller.meta.description}
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
                        <Stack
                            direction={{xs: 'column', xl: 'row'}}
                            spacing={1.5}
                            alignItems={{xl: 'center'}}
                            sx={{flex: 1, minWidth: 0}}
                        >
                            <SearchField
                                value={controller.appliedQuery}
                                onCommit={controller.handleSearchCommit}
                                debounceMs={SEARCH_DEBOUNCE_MS}
                                placeholder={t('search')}
                            />
                            {controller.hasSelection ? (
                                <Stack direction="row" spacing={1} alignItems="center" sx={{minWidth: 0, flexWrap: 'wrap'}}>
                                    <Button
                                        variant="outlined"
                                        endIcon={<ExpandMoreIcon/>}
                                        onClick={(event) => controller.setBulkActionMenuAnchor(event.currentTarget)}
                                    >
                                        {t('actions')}
                                    </Button>
                                    {!controller.isAllMatchingSelected && controller.selectionCount < controller.total ? (
                                        <Button
                                            variant="text"
                                            onClick={controller.handleSelectAllMatching}
                                            sx={{px: 0.5, minWidth: 'auto'}}
                                        >
                                            {selectAllLabel}
                                        </Button>
                                    ) : null}
                                    <Typography color="text.secondary" sx={{alignSelf: 'center', whiteSpace: 'nowrap'}}>
                                        {t('selected_count', {count: controller.selectionCount})} / {controller.total}
                                    </Typography>
                                </Stack>
                            ) : null}
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" sx={{marginLeft: 'auto'}}>
                            {beforePagination ? (
                                <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
                                    {beforePagination}
                                </Box>
                            ) : null}
                            {isMobile && controller.hasListFilters ? (
                                <Tooltip title={t('filters')}>
                                    <IconButton
                                        size="small"
                                        aria-label={t('filters')}
                                        onClick={() => controller.setFiltersOpen(true)}
                                    >
                                        <FilterListIcon fontSize="small"/>
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                            <IconButton
                                size="small"
                                onClick={() => controller.handlePageChange(controller.currentPage - 1)}
                                disabled={controller.currentPage <= 1}
                                sx={{mr: '-5px'}}
                            >
                                <ChevronLeftIcon fontSize="small"/>
                            </IconButton>
                            <InputBase
                                value={controller.pageInput}
                                onChange={(event) => controller.setPageInput(event.target.value.replace(/[^\d]/g, '') || '1')}
                                onBlur={controller.handlePageInputCommit}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        controller.handlePageInputCommit();
                                    }
                                }}
                                inputProps={{inputMode: 'numeric'}}
                                sx={{
                                    width: `${Math.max(String(controller.totalPages).length, String(controller.currentPage).length, 1)}ch`,
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
                                / {controller.totalPages}
                            </Typography>
                            <IconButton
                                size="small"
                                onClick={() => controller.handlePageChange(controller.currentPage + 1)}
                                disabled={controller.currentPage >= controller.totalPages}
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
                        {controller.isLoading ? (
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
                                                    checked={controller.allVisibleSelected}
                                                    indeterminate={!controller.allVisibleSelected && controller.hasVisibleSelection}
                                                    onChange={(_, checked) => controller.handleToggleAllVisible(checked)}
                                                />
                                            </TableCell>
                                            {controller.listFields.map((fieldName) => {
                                                const field = controller.fieldMap.get(fieldName);
                                                const sortDirection = resolveSortDirection(controller.sortFields, fieldName);
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
                                                        onClick={isSortable ? () => controller.toggleSort(fieldName) : undefined}
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
                                                                color: 'rgba(255, 255, 255, 0.96)',
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
                                        {controller.rows.map((row) => {
                                            const rowId = row[meta.pk_field] as string | number;
                                            return (
                                                <ListRow
                                                    key={String(rowId)}
                                                    row={row}
                                                    pkField={meta.pk_field}
                                                    listFields={controller.listFields}
                                                    basePath={basePath}
                                                    slug={slug}
                                                    locale={locale}
                                                    fieldMap={controller.fieldMap}
                                                    isSelected={controller.selectedIdSet.has(String(rowId))}
                                                    onToggleSelection={controller.handleToggleSelection}
                                                    onOpenMenu={controller.handleOpenRowMenu}
                                                />
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </Paper>

                    {!isMobile && controller.hasListFilters ? (
                        <ListFiltersSidebar
                            client={client}
                            slug={slug}
                            filters={controller.listFilters}
                            values={controller.appliedFilters}
                            onChange={controller.handleFilterChange}
                            onReset={controller.handleResetFilters}
                            debounceMs={SEARCH_DEBOUNCE_MS}
                        />
                    ) : null}
                </Stack>

                <Menu
                    anchorEl={controller.bulkActionMenuAnchor}
                    open={Boolean(controller.bulkActionMenuAnchor)}
                    onClose={controller.handleCloseBulkActionMenu}
                >
                    {controller.bulkActions.map((action) => (
                        <MenuItem key={action.slug}
                                  onClick={() => void controller.handleRunNamedBulkAction(action.slug)}>
                            {action.label}
                        </MenuItem>
                    ))}
                </Menu>

                <Menu
                    anchorEl={controller.rowActionMenuAnchor}
                    open={Boolean(controller.rowActionMenuAnchor)}
                    onClose={controller.handleCloseRowMenu}
                >
                    <MenuItem
                        onClick={() => {
                            if (controller.rowActionMenuId !== null) {
                                void controller.handleRowDelete(controller.rowActionMenuId);
                            }
                        }}
                    >
                        {t('delete')}
                    </MenuItem>
                </Menu>

                <FormDialog
                    open={controller.createOpen}
                    onClose={() => controller.setCreateOpen(false)}
                    onSuccess={() => void controller.refresh()}
                    title={`${t('create')}: ${meta.title}`}
                    slug={slug}
                    mode="create"
                    meta={meta}
                    client={client}
                />

                <Dialog
                    open={controller.filtersOpen}
                    onClose={() => controller.setFiltersOpen(false)}
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
                        {controller.hasListFilters ? (
                            <ListFiltersSidebar
                                client={client}
                                slug={slug}
                                filters={controller.listFilters}
                                values={controller.appliedFilters}
                                onChange={controller.handleFilterChange}
                                onReset={controller.handleResetFilters}
                                debounceMs={SEARCH_DEBOUNCE_MS}
                            />
                        ) : null}
                    </DialogContent>
                </Dialog>

                <DeletePreviewDialog
                    open={controller.deletePreviewOpen}
                    title={controller.pendingDeleteMode === 'single' ? t('delete_object_title') : t('delete_bulk_title')}
                    preview={controller.deletePreview}
                    error={controller.deletePreviewError}
                    isLoading={controller.isDeletePreviewLoading}
                    isSubmitting={controller.isDeleteSubmitting}
                    onClose={() => {
                        if (controller.isDeleteSubmitting) {
                            return;
                        }
                        controller.handleClearDeletePreview();
                    }}
                    onConfirm={() => void controller.handleConfirmDelete()}
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
