'use client';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
    Alert,
    Box,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {useTheme} from '@mui/material/styles';
import 'dayjs/locale/en.js';
import 'dayjs/locale/ru.js';
import type {XLAdminClient} from '../client';
import {useAdminDocumentTitle} from '../hooks/useAdminDocumentTitle';
import {useAdminLocale, useAdminTranslation} from '../i18n';
import type {XLAdminRouter} from '../router';
import {XLAdminRouterProvider, useXLAdminLocation, useXLAdminRouter} from '../router';
import {formatAdminValue, resolveAdminMediaUrl} from '../utils/adminFields';
import {DeletePreviewDialog} from './DeletePreviewDialog';
import {MainHeader} from './layout/MainHeader';
import {ObjectField} from './object-page/ObjectField';
import {ObjectPageSkeleton} from './object-page/ObjectPageSkeleton';
import {ReadonlyObjectField} from './object-page/ReadonlyObjectField';
import {useObjectPageController} from './object-page/useObjectPageController';

type AdminObjectPageProps = {
    client: XLAdminClient;
    slug: string;
    id: string;
    router?: XLAdminRouter;
};

export type ObjectPageProps = AdminObjectPageProps;

export function ObjectPage({client, slug, id, router}: ObjectPageProps) {
    const locale = useAdminLocale();
    const t = useAdminTranslation();
    const resolvedRouter = useXLAdminRouter(router);
    const location = useXLAdminLocation(resolvedRouter);
    const pathname = location.pathname;
    const theme = useTheme();
    const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
    const listPath = pathname.split('/').slice(0, -1).join('/');
    const controller = useObjectPageController({
        client,
        slug,
        id,
        listPath,
        router: resolvedRouter,
        t,
    });

    useAdminDocumentTitle(t('admin_title'), controller.meta?.title ?? slug, controller.objectTitle);

    if (controller.isLoading && !controller.data) {
        return <ObjectPageSkeleton />;
    }

    if (controller.error && !controller.data) {
        return <Alert severity="error">{controller.error}</Alert>;
    }

    if (!controller.data || !controller.meta) {
        return <ObjectPageSkeleton />;
    }

    return (
        <XLAdminRouterProvider router={resolvedRouter}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
                <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
                    <MainHeader
                        title={controller.objectTitle}
                        subtitle={controller.meta.slug}
                        beforeSubtitle={(
                            <IconButton
                                aria-label={t('back')}
                                onClick={controller.handleNavigateBack}
                                size="small"
                                sx={{ml: -0.5}}
                            >
                                <ArrowBackIcon fontSize="small" />
                            </IconButton>
                        )}
                        actions={isPhone ? (
                            <IconButton
                                aria-label={t('actions')}
                                onClick={(event) => controller.setActionsAnchorEl(event.currentTarget)}
                                size="small"
                                sx={{mr: -0.5}}
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        ) : undefined}
                        details={controller.meta.description ? (
                            <Typography color="text.secondary" sx={{fontSize: 14, lineHeight: 1.45}}>
                                {controller.meta.description}
                            </Typography>
                        ) : undefined}
                        error={controller.error}
                    />

                    <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5} sx={{flex: 1, minHeight: 0, alignItems: 'stretch'}}>
                        <Paper
                            sx={{
                                borderRadius: '10px',
                                flex: 1,
                                minHeight: 0,
                                overflow: 'hidden',
                            }}
                        >
                            <Box component="form" autoComplete="off" sx={{height: '100%', overflow: 'auto', p: 2.5}}>
                                <Stack spacing={1.5}>
                                    {controller.detailFields.map((fieldName) => {
                                        const field = controller.fieldMap.get(fieldName);
                                        if (!field) {
                                            return null;
                                        }

                                        if (controller.editableFieldNames.has(fieldName)) {
                                            return (
                                                <ObjectField
                                                    key={field.name}
                                                    field={field}
                                                    value={controller.values[field.name]}
                                                    slug={slug}
                                                    client={client}
                                                    onFieldChange={controller.handleFieldChange}
                                                />
                                            );
                                        }

                                        return (
                                            <ReadonlyObjectField
                                                key={field.name}
                                                field={field}
                                                value={formatAdminValue(controller.values[field.name], {locale, field, pretty: true})}
                                                imageUrl={field.display_kind === 'image'
                                                    ? resolveAdminMediaUrl(controller.values[field.name], field)
                                                    : null}
                                            />
                                        );
                                    })}
                                </Stack>
                            </Box>
                        </Paper>

                        <Paper
                            sx={{
                                width: {xs: '100%', lg: 280},
                                flexShrink: 0,
                                borderRadius: '10px',
                                p: 1.5,
                                alignSelf: 'flex-start',
                                position: {lg: 'sticky'},
                                top: {lg: 0},
                                display: isPhone ? 'none' : undefined,
                            }}
                        >
                            <Stack spacing={1}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    {t('actions')}
                                </Typography>
                                {controller.isDirty ? (
                                    <Button variant="contained" onClick={() => void controller.handleSave()} disabled={controller.isSaving}>
                                        {controller.isSaving ? t('saving') : t('save')}
                                    </Button>
                                ) : null}
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={() => void controller.handleOpenDeletePreview()}
                                    disabled={controller.isDeleting}
                                >
                                    {t('delete')}
                                </Button>
                                {controller.objectActions.map((action) => (
                                    <Button
                                        key={action.slug}
                                        variant="outlined"
                                        onClick={() => void controller.handleRunObjectAction(action.slug)}
                                        disabled={controller.activeActionSlug !== null}
                                    >
                                        {controller.activeActionSlug === action.slug ? t('executing') : action.label}
                                    </Button>
                                ))}
                            </Stack>
                        </Paper>
                    </Stack>
                </Stack>

                <Menu
                    anchorEl={controller.actionsAnchorEl}
                    open={controller.isActionsMenuOpen}
                    onClose={() => controller.setActionsAnchorEl(null)}
                    slotProps={{
                        paper: {
                            sx: {
                                minWidth: 220,
                            },
                        },
                    }}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                    transformOrigin={{vertical: 'top', horizontal: 'right'}}
                >
                    {controller.isDirty ? (
                        <MenuItem
                            onClick={() => {
                                controller.setActionsAnchorEl(null);
                                void controller.handleSave();
                            }}
                            disabled={controller.isSaving}
                        >
                            {controller.isSaving ? t('saving') : t('save')}
                        </MenuItem>
                    ) : null}
                    <MenuItem
                        onClick={() => void controller.handleOpenDeletePreview()}
                        disabled={controller.isDeleting}
                        sx={{color: 'error.main'}}
                    >
                        {t('delete')}
                    </MenuItem>
                    {controller.objectActions.map((action) => (
                        <MenuItem
                            key={action.slug}
                            onClick={() => {
                                controller.setActionsAnchorEl(null);
                                void controller.handleRunObjectAction(action.slug);
                            }}
                            disabled={controller.activeActionSlug !== null}
                        >
                            {controller.activeActionSlug === action.slug ? t('executing') : action.label}
                        </MenuItem>
                    ))}
                </Menu>

                <DeletePreviewDialog
                    open={controller.deleteConfirmOpen}
                    title={t('delete_object_title')}
                    preview={controller.deletePreview}
                    error={controller.deletePreviewError}
                    isLoading={controller.isDeletePreviewLoading}
                    isSubmitting={controller.isDeleting}
                    onClose={() => {
                        if (controller.isDeleting) {
                            return;
                        }
                        controller.setDeleteConfirmOpen(false);
                        controller.setDeletePreview(null);
                        controller.setDeletePreviewError(null);
                    }}
                    onConfirm={() => void controller.handleDelete()}
                />
            </LocalizationProvider>
        </XLAdminRouterProvider>
    );
}
