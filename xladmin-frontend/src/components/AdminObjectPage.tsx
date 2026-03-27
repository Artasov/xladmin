'use client';

import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {usePathname, useRouter} from 'next/navigation.js';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {XLAdminClient} from '../client';
import type {AdminDetailResponse, AdminFieldMeta} from '../types';
import {buildAdminPayload, formatAdminValue} from '../utils/adminFields';
import {AdminFieldEditor} from './AdminFieldEditor';
import {MainHeader, MainHeaderSkeleton} from './layout/MainHeader';

type AdminObjectPageProps = {
    client: XLAdminClient;
    slug: string;
    id: string;
};

const detailResponseCache = new Map<string, AdminDetailResponse>();
const inFlightDetailRequests = new Map<string, Promise<AdminDetailResponse>>();

export function AdminObjectPage({client, slug, id}: AdminObjectPageProps) {
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
                if (!isMounted) {
                    return;
                }
                setData(response);
                setValues(response.item);
                setInitialValues(response.item);
            })
            .catch((reason: unknown) => {
                if (!isMounted) {
                    return;
                }
                setError(reason instanceof Error ? reason.message : 'Не удалось загрузить объект.');
            })
            .finally(() => {
                if (inFlightDetailRequests.get(cacheKey) === request) {
                    inFlightDetailRequests.delete(cacheKey);
                }
                if (!isMounted) {
                    return;
                }
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [cacheKey, client, id, slug]);

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

    const handleSave = async () => {
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
            setError(reason instanceof Error ? reason.message : 'Не удалось сохранить объект.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setError(null);
        try {
            await client.deleteItem(slug, id);
            detailResponseCache.delete(cacheKey);
            router.push(pathname.split('/').slice(0, -1).join('/'));
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Не удалось удалить объект.');
            setIsDeleting(false);
            setDeleteConfirmOpen(false);
        }
    };

    const handleRunObjectAction = async (actionSlug: string) => {
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
            setError(reason instanceof Error ? reason.message : 'Не удалось выполнить действие.');
        } finally {
            setActiveActionSlug(null);
        }
    };

    if (isLoading && !data) {
        return <AdminObjectPageSkeleton />;
    }

    if (error && !data) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (!data || !meta) {
        return <AdminObjectPageSkeleton />;
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
                <MainHeader
                    title={String(data.item._display ?? `${meta.title} #${id}`)}
                    subtitle={meta.slug}
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
                        <Box sx={{height: '100%', overflow: 'auto', p: 2.5}}>
                            <Stack spacing={1.5}>
                                {detailFields.map((fieldName) => {
                                    const field = fieldMap.get(fieldName);
                                    if (!field) {
                                        return null;
                                    }

                                    if (editableFieldNames.has(fieldName)) {
                                        return (
                                            <AdminObjectField
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
                                        <ReadonlyAdminObjectField
                                            key={field.name}
                                            field={field}
                                            value={formatAdminValue(values[field.name])}
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
                                Действия
                            </Typography>
                            {isDirty ? (
                                <Button variant="contained" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            ) : null}
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => setDeleteConfirmOpen(true)}
                                disabled={isDeleting}
                            >
                                Удалить
                            </Button>
                            {objectActions.map((action) => (
                                <Button
                                    key={action.slug}
                                    variant="outlined"
                                    onClick={() => void handleRunObjectAction(action.slug)}
                                    disabled={activeActionSlug !== null}
                                >
                                    {activeActionSlug === action.slug ? 'Выполнение...' : action.label}
                                </Button>
                            ))}
                        </Stack>
                    </Paper>
                </Stack>
            </Stack>

            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Удалить объект?</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary">
                        Это действие нельзя отменить.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={() => void handleDelete()} disabled={isDeleting}>
                        {isDeleting ? 'Удаление...' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
}

function AdminObjectPageSkeleton() {
    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeaderSkeleton titleWidth={420} subtitleWidth="32%" />

            <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5} sx={{flex: 1, minHeight: 0, alignItems: 'stretch'}}>
                <Paper sx={{borderRadius: '10px', flex: 1, minHeight: 0, overflow: 'hidden'}}>
                    <Box sx={{height: '100%', overflow: 'auto', p: 2.5}}>
                        <Stack spacing={1.5}>
                            {Array.from({length: 9}).map((_, index) => (
                                <Skeleton key={index} variant="rounded" width="100%" height={56} />
                            ))}
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
                    }}
                >
                    <Stack spacing={1}>
                        <Skeleton variant="text" width={90} height={28} />
                        <Skeleton variant="rounded" width="100%" height={40} />
                        <Skeleton variant="rounded" width="100%" height={40} />
                    </Stack>
                </Paper>
            </Stack>
        </Stack>
    );
}

type AdminObjectFieldProps = {
    field: AdminFieldMeta;
    value: unknown;
    slug: string;
    client: XLAdminClient;
    onFieldChange: (fieldName: string, nextValue: unknown) => void;
};

const AdminObjectField = memo(function AdminObjectField({
    field,
    value,
    slug,
    client,
    onFieldChange,
}: AdminObjectFieldProps) {
    const handleChange = useCallback((nextValue: unknown) => {
        onFieldChange(field.name, nextValue);
    }, [field.name, onFieldChange]);

    return (
        <AdminFieldEditor
            field={field}
            value={value}
            slug={slug}
            client={client}
            onChange={handleChange}
        />
    );
});

type ReadonlyAdminObjectFieldProps = {
    field: AdminFieldMeta;
    value: string;
};

const ReadonlyAdminObjectField = memo(function ReadonlyAdminObjectField({
    field,
    value,
}: ReadonlyAdminObjectFieldProps) {
    return (
        <TextField
            label={field.label}
            value={value}
            size="small"
            fullWidth
            disabled
            helperText={field.help_text ?? undefined}
        />
    );
});
