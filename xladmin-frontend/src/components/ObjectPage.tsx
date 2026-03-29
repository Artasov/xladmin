'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {usePathname, useRouter} from 'next/navigation.js';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
    Alert,
    Box,
    Button,
    IconButton,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/en.js';
import 'dayjs/locale/ru.js';
import type {XLAdminClient} from '../client';
import {useAdminLocale, useAdminTranslation} from '../i18n';
import type {AdminDeletePreviewResponse, AdminDetailResponse} from '../types';
import {buildAdminPayload, formatAdminValue, resolveAdminMediaUrl} from '../utils/adminFields';
import {DeletePreviewDialog} from './DeletePreviewDialog';
import {MainHeader} from './layout/MainHeader';
import {ObjectField} from './object-page/ObjectField';
import {ObjectPageSkeleton} from './object-page/ObjectPageSkeleton';
import {ReadonlyObjectField} from './object-page/ReadonlyObjectField';

type AdminObjectPageProps = {
    client: XLAdminClient;
    slug: string;
    id: string;
};

export type ObjectPageProps = AdminObjectPageProps;

const detailResponseCache = new Map<string, AdminDetailResponse>();
const inFlightDetailRequests = new Map<string, Promise<AdminDetailResponse>>();

export function ObjectPage({client, slug, id}: ObjectPageProps) {
    const locale = useAdminLocale();
    const t = useAdminTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const cacheKey = `${slug}:${id}`;
    const [data, setData] = useState<AdminDetailResponse | null>(() => detailResponseCache.get(cacheKey) ?? null);
    const [values, setValues] = useState<Record<string, unknown>>(() => detailResponseCache.get(cacheKey)?.item ?? {});
    const [initialValues, setInitialValues] = useState<Record<string, unknown>>(() => detailResponseCache.get(cacheKey)?.item ?? {});
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(data === null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeActionSlug, setActiveActionSlug] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletePreview, setDeletePreview] = useState<AdminDeletePreviewResponse | null>(null);
    const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false);
    const [deletePreviewError, setDeletePreviewError] = useState<string | null>(null);
    const listPath = useMemo(() => pathname.split('/').slice(0, -1).join('/'), [pathname]);
    const adminRootPath = useMemo(() => listPath.split('/').slice(0, -1).join('/'), [listPath]);

    useEffect(() => {
        let isMounted = true;
        const cachedResponse = detailResponseCache.get(cacheKey);

        if (cachedResponse) {
            setData(cachedResponse);
            setValues(cachedResponse.item);
            setInitialValues(cachedResponse.item);
            setIsLoading(false);
            return () => {
                isMounted = false;
            };
        }

        setIsLoading(true);
        setError(null);

        const request = inFlightDetailRequests.get(cacheKey) ?? client.getItem(slug, id);
        inFlightDetailRequests.set(cacheKey, request);

        request
            .then((response) => {
                detailResponseCache.set(cacheKey, response);
                if (!isMounted) return;
                setData(response);
                setValues(response.item);
                setInitialValues(response.item);
            })
            .catch((reason: unknown) => {
                if (!isMounted) return;
                setError(reason instanceof Error ? reason.message : t('object_load_error'));
            })
            .finally(() => {
                if (inFlightDetailRequests.get(cacheKey) === request) {
                    inFlightDetailRequests.delete(cacheKey);
                }
                if (!isMounted) return;
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [cacheKey, client, id, slug, t]);

    const meta = data?.meta ?? null;
    const detailFields = meta?.detail_fields ?? [];
    const objectActions = meta?.object_actions ?? [];
    const fieldMap = useMemo(
        () => new Map((meta?.fields ?? []).map((field) => [field.name, field])),
        [meta?.fields],
    );
    const editableFields = useMemo(
        () => (meta?.fields ?? []).filter((field) => meta?.update_fields.includes(field.name)),
        [meta?.fields, meta?.update_fields],
    );
    const editableFieldNames = useMemo(
        () => new Set(editableFields.map((field) => field.name)),
        [editableFields],
    );
    const currentPayload = useMemo(
        () => buildAdminPayload(values, editableFields),
        [editableFields, values],
    );
    const initialPayload = useMemo(
        () => buildAdminPayload(initialValues, editableFields),
        [editableFields, initialValues],
    );
    const isDirty = useMemo(
        () => JSON.stringify(currentPayload) !== JSON.stringify(initialPayload),
        [currentPayload, initialPayload],
    );

    const handleFieldChange = useCallback((fieldName: string, nextValue: unknown) => {
        setValues((current) => {
            if (Object.is(current[fieldName], nextValue)) {
                return current;
            }
            return {...current, [fieldName]: nextValue};
        });
    }, []);

    const handleSave = useCallback(async () => {
        if (!meta || !isDirty) {
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const response = await client.patchItem(slug, id, currentPayload);
            const nextDetail = {meta, item: response.item};
            detailResponseCache.set(cacheKey, nextDetail);
            setData(nextDetail);
            setValues(response.item);
            setInitialValues(response.item);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('object_save_error'));
        } finally {
            setIsSaving(false);
        }
    }, [cacheKey, client, currentPayload, id, isDirty, meta, slug, t]);

    const handleDelete = useCallback(async () => {
        setIsDeleting(true);
        setError(null);
        try {
            await client.deleteItem(slug, id);
            detailResponseCache.delete(cacheKey);
            router.push(listPath);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('object_delete_error'));
            setIsDeleting(false);
            setDeleteConfirmOpen(false);
        }
    }, [cacheKey, client, id, listPath, router, slug, t]);

    const handleNavigateBack = useCallback(() => {
        if (typeof window !== 'undefined' && document.referrer) {
            try {
                const referrerUrl = new URL(document.referrer);
                if (referrerUrl.origin === window.location.origin && referrerUrl.pathname.startsWith(adminRootPath)) {
                    router.back();
                    return;
                }
            } catch {
                // noop
            }
        }

        router.push(listPath);
    }, [adminRootPath, listPath, router]);

    const handleRunObjectAction = useCallback(async (actionSlug: string) => {
        setActiveActionSlug(actionSlug);
        setError(null);
        try {
            const response = await client.runObjectAction(slug, id, actionSlug);
            const nextDetail = data ? {...data, item: response.item} : null;
            if (nextDetail) {
                detailResponseCache.set(cacheKey, nextDetail);
            }
            setData(nextDetail);
            setValues(response.item);
            setInitialValues(response.item);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('object_action_error'));
        } finally {
            setActiveActionSlug(null);
        }
    }, [cacheKey, client, data, id, slug, t]);

    const handleOpenDeletePreview = useCallback(async () => {
        setDeleteConfirmOpen(true);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(true);
        try {
            const preview = await client.getDeletePreview(slug, id);
            setDeletePreview(preview);
        } catch (reason: unknown) {
            setDeletePreviewError(reason instanceof Error ? reason.message : t('delete_preview_error'));
        } finally {
            setIsDeletePreviewLoading(false);
        }
    }, [client, id, slug, t]);

    if (isLoading && !data) {
        return <ObjectPageSkeleton />;
    }

    if (error && !data) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (!data || !meta) {
        return <ObjectPageSkeleton />;
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
            <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
                <MainHeader
                    title={String(data.item._display ?? `${meta.title} #${id}`)}
                    subtitle={meta.slug}
                    beforeTitle={(
                        <IconButton
                            aria-label={t('back')}
                            onClick={handleNavigateBack}
                            size="small"
                            sx={{ml: -0.5}}
                        >
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                    )}
                    details={meta.description ? (
                        <Typography color="text.secondary" sx={{fontSize: 14, lineHeight: 1.45}}>
                            {meta.description}
                        </Typography>
                    ) : undefined}
                    error={error}
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
                                {detailFields.map((fieldName) => {
                                    const field = fieldMap.get(fieldName);
                                    if (!field) {
                                        return null;
                                    }

                                    if (editableFieldNames.has(fieldName)) {
                                        return (
                                            <ObjectField
                                                key={field.name}
                                                field={field}
                                                value={values[field.name]}
                                                slug={slug}
                                                client={client}
                                                onFieldChange={handleFieldChange}
                                            />
                                        );
                                    }

                                    return (
                                        <ReadonlyObjectField
                                            key={field.name}
                                            field={field}
                                            value={formatAdminValue(values[field.name], {locale, field, pretty: true})}
                                            imageUrl={field.display_kind === 'image'
                                                ? resolveAdminMediaUrl(values[field.name], field)
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
                        }}
                    >
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                                {t('actions')}
                            </Typography>
                            {isDirty ? (
                                <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving}>
                                    {isSaving ? t('saving') : t('save')}
                                </Button>
                            ) : null}
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => void handleOpenDeletePreview()}
                                disabled={isDeleting}
                            >
                                {t('delete')}
                            </Button>
                            {objectActions.map((action) => (
                                <Button
                                    key={action.slug}
                                    variant="outlined"
                                    onClick={() => void handleRunObjectAction(action.slug)}
                                    disabled={activeActionSlug !== null}
                                >
                                    {activeActionSlug === action.slug ? t('executing') : action.label}
                                </Button>
                            ))}
                        </Stack>
                    </Paper>
                </Stack>
            </Stack>

            <DeletePreviewDialog
                open={deleteConfirmOpen}
                title={t('delete_object_title')}
                preview={deletePreview}
                error={deletePreviewError}
                isLoading={isDeletePreviewLoading}
                isSubmitting={isDeleting}
                onClose={() => {
                    if (isDeleting) {
                        return;
                    }
                    setDeleteConfirmOpen(false);
                    setDeletePreview(null);
                    setDeletePreviewError(null);
                }}
                onConfirm={() => void handleDelete()}
            />
        </LocalizationProvider>
    );
}
