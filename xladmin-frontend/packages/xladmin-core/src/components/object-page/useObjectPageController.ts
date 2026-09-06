'use client';

import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
    buildDetailCacheKey,
    getClientCacheBucket,
    getModelCacheVersion,
    invalidateModelCache,
    setCachedDetailResponse,
} from '../../cache';
import type {AdminClient} from '@xladmin-core/client';
import type {AdminTranslationKey} from '@xladmin-core/i18n';
import type {AdminRouter} from '@xladmin-core/router';
import type {AdminDeletePreviewResponse, AdminDetailResponse} from '@xladmin-core/types';
import {buildAdminPayload} from '../../utils/adminFields';
import {isDeepEqual} from '../../utils/isDeepEqual';
import {useAdminMessage} from '../layout/AdminMessageContext';
import {mergeObjectActionValues} from './actionResult';

type UseObjectPageControllerOptions = {
    client: AdminClient;
    slug: string;
    id: string;
    listPath: string;
    router: AdminRouter;
    t: (key: AdminTranslationKey, params?: Record<string, string | number>) => string;
};

export function useObjectPageController({
                                            client,
                                            slug,
                                            id,
                                            listPath,
                                            router,
                                            t,
                                        }: UseObjectPageControllerOptions) {
    const message = useAdminMessage();
    const lifetime = useMemo(() => ({client, id, slug, active: false, canWrite: false, busy: false, deleted: false, formVersion: 0, previewVersion: 0, previewReady: false}), [client, id, slug]);
    const translation = useRef(t);
    useLayoutEffect(() => { translation.current = t; }, [t]);
    useLayoutEffect(() => {
        lifetime.active = true;
        return () => { lifetime.active = false; };
    }, [lifetime]);
    const cacheKey = buildDetailCacheKey(slug, id);
    const [dataOwner, setDataOwner] = useState(lifetime);
    const [data, setData] = useState<AdminDetailResponse | null>(() => getClientCacheBucket(client).detailResponseCache.get(cacheKey) ?? null);
    const [values, setValues] = useState<Record<string, unknown>>(() => getClientCacheBucket(client).detailResponseCache.get(cacheKey)?.item ?? {});
    const [initialValues, setInitialValues] = useState<Record<string, unknown>>(() => getClientCacheBucket(client).detailResponseCache.get(cacheKey)?.item ?? {});
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(data === null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeActionSlug, setActiveActionSlug] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletePreview, setDeletePreview] = useState<AdminDeletePreviewResponse | null>(null);
    const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false);
    const [deletePreviewError, setDeletePreviewError] = useState<string | null>(null);
    const [actionsAnchorEl, setActionsAnchorEl] = useState<HTMLElement | null>(null);
    const [objectActionFormSlug, setObjectActionFormSlug] = useState<string | null>(null);
    const [objectActionFormOpen, setObjectActionFormOpen] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const formVersion = lifetime.formVersion;
    const previewVersion = lifetime.previewVersion;

    useLayoutEffect(() => {
        let isMounted = true;
        const bucket = getClientCacheBucket(client);
        const cachedResponse = bucket.detailResponseCache.get(cacheKey);

        setDataOwner(lifetime);
        setData(cachedResponse ?? null);
        setValues(cachedResponse?.item ?? {});
        setInitialValues(cachedResponse?.item ?? {});
        setError(null);
        setIsSaving(false);
        setIsDeleting(false);
        setDeleted(false);
        setActiveActionSlug(null);
        setObjectActionFormSlug(null);
        setObjectActionFormOpen(false);
        setDeleteConfirmOpen(false);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(false);
        setActionsAnchorEl(null);

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

        const request = bucket.inFlightDetailRequests.get(cacheKey) ?? client.getItem(slug, id);
        bucket.inFlightDetailRequests.set(cacheKey, request);
        const cacheVersion = getModelCacheVersion(client, slug);

        request
            .then((response) => {
                if (getModelCacheVersion(client, slug) === cacheVersion) {
                    setCachedDetailResponse(client, cacheKey, response);
                }
                if (!isMounted) return;
                setData(response);
                setValues(response.item);
                setInitialValues(response.item);
            })
            .catch((reason: unknown) => {
                if (!isMounted) return;
                setError(reason instanceof Error ? reason.message : translation.current('object_load_error'));
            })
            .finally(() => {
                if (bucket.inFlightDetailRequests.get(cacheKey) === request) {
                    bucket.inFlightDetailRequests.delete(cacheKey);
                }
                if (!isMounted) return;
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [cacheKey, client, id, slug, lifetime]);

    const meta = dataOwner === lifetime ? data?.meta ?? null : null;
    const canWrite = !deleted && meta?.slug === slug && meta.read_only === false;
    useLayoutEffect(() => { lifetime.canWrite = canWrite; }, [canWrite, lifetime]);
    const isMutating = isSaving || isDeleting || activeActionSlug !== null;
    const detailFields = meta?.detail_fields ?? [];
    const objectActions = useMemo(() => canWrite ? meta.object_actions : [], [canWrite, meta]);
    const fieldMap = useMemo(
        () => new Map((meta?.fields ?? []).map((field) => [field.name, field])),
        [meta?.fields],
    );
    const editableFields = useMemo(
        () => canWrite ? meta.fields.filter((field) => !field.read_only && meta.update_fields.includes(field.name)) : [],
        [canWrite, meta],
    );
    const editableFieldNames = useMemo(
        () => new Set(editableFields.map((field) => field.name)),
        [editableFields],
    );
    const objectTitle = useMemo(
        () => String(data?.item._display ?? (meta ? `${meta.title} #${id}` : id)),
        [data, id, meta],
    );
    const isActionsMenuOpen = canWrite && actionsAnchorEl !== null;
    const activeObjectAction = useMemo(
        () => objectActions.find((item) => item.slug === objectActionFormSlug) ?? null,
        [objectActionFormSlug, objectActions],
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
        () => !isDeepEqual(currentPayload, initialPayload),
        [currentPayload, initialPayload],
    );

    const applyActionItem = useCallback((item: Record<string, unknown>) => {
        if (!meta) return;
        const response = {meta, item};
        setCachedDetailResponse(client, cacheKey, response);
        setData(response);
        setValues((current) => mergeObjectActionValues(current, initialValues, item, editableFieldNames));
        setInitialValues(item);
    }, [cacheKey, client, editableFieldNames, initialValues, meta]);

    const handleFieldChange = useCallback((fieldName: string, nextValue: unknown) => {
        if (!lifetime.active || !lifetime.canWrite || lifetime.busy || lifetime.deleted || !editableFieldNames.has(fieldName)) return;
        setValues((current) => {
            if (Object.is(current[fieldName], nextValue)) {
                return current;
            }
            return {...current, [fieldName]: nextValue};
        });
    }, [editableFieldNames, lifetime]);

    const handleSave = useCallback(async () => {
        if (!lifetime.active || !lifetime.canWrite || lifetime.busy || lifetime.deleted || !meta || !isDirty) {
            return;
        }

        lifetime.busy = true;
        lifetime.previewReady = false;
        lifetime.previewVersion += 1;
        setIsSaving(true);
        setError(null);
        try {
            const response = await client.patchItem(slug, id, currentPayload);
            invalidateModelCache(client, slug);
            if (!lifetime.active) return;
            const detail = {meta, item: response.item};
            setCachedDetailResponse(client, cacheKey, detail);
            setData(detail);
            setValues(response.item);
            setInitialValues(response.item);
            message.success(t('object_saved_success'));
        } catch (reason: unknown) {
            if (!lifetime.active) return;
            const nextError = reason instanceof Error ? reason.message : t('object_save_error');
            setError(nextError);
            message.error(nextError);
        } finally {
            lifetime.busy = false;
            if (lifetime.active) setIsSaving(false);
        }
    }, [cacheKey, client, currentPayload, id, isDirty, lifetime, message, meta, slug, t]);

    const handleDelete = useCallback(async () => {
        if (!lifetime.active || !lifetime.canWrite || lifetime.busy || lifetime.deleted || !deleteConfirmOpen || !lifetime.previewReady || previewVersion !== lifetime.previewVersion || isDeletePreviewLoading || deletePreviewError || !deletePreview?.can_delete) return;
        lifetime.busy = true;
        lifetime.previewReady = false;
        setIsDeleting(true);
        setError(null);
        try {
            await client.deleteItem(slug, id);
            invalidateModelCache(client, slug);
            if (!lifetime.active) return;
            lifetime.deleted = true;
            lifetime.canWrite = false;
            setDeleted(true);
            setDeleteConfirmOpen(false);
            message.success(t('object_deleted_success'));
            router.push(listPath);
        } catch (reason: unknown) {
            if (!lifetime.active) return;
            const nextError = reason instanceof Error ? reason.message : t('object_delete_error');
            setError(nextError);
            message.error(nextError);
            setDeleteConfirmOpen(false);
        } finally {
            lifetime.busy = false;
            if (lifetime.active) setIsDeleting(false);
        }
    }, [client, id, lifetime, listPath, message, router, slug, t, deleteConfirmOpen, deletePreview, deletePreviewError, isDeletePreviewLoading, previewVersion]);

    const handleNavigateBack = useCallback(() => {
        if (!lifetime.active) return;
        router.push(listPath);
    }, [lifetime, listPath, router]);

    const handleRunObjectAction = useCallback(async (actionSlug: string) => {
        if (!lifetime.active || !lifetime.canWrite || lifetime.busy || lifetime.deleted) return;
        const action = objectActions.find((item) => item.slug === actionSlug);
        if (!action) return;
        if ((action?.form?.length ?? 0) > 0) {
            setActionsAnchorEl(null);
            lifetime.formVersion += 1;
            setObjectActionFormSlug(actionSlug);
            setObjectActionFormOpen(true);
            return;
        }
        lifetime.busy = true;
        lifetime.previewReady = false;
        lifetime.previewVersion += 1;
        setActiveActionSlug(actionSlug);
        setError(null);
        try {
            const response = await client.runObjectAction(slug, id, actionSlug);
            invalidateModelCache(client, slug);
            if (!lifetime.active) return;
            applyActionItem(response.item);
            message.success(t('action_success', {action: action.label, count: 1}));
        } catch (reason: unknown) {
            if (!lifetime.active) return;
            const nextError = reason instanceof Error ? reason.message : t('object_action_error');
            setError(nextError);
            message.error(nextError);
        } finally {
            lifetime.busy = false;
            if (lifetime.active) setActiveActionSlug(null);
        }
    }, [applyActionItem, client, id, lifetime, message, objectActions, slug, t]);

    const handleSubmitObjectActionForm = useCallback(async (payload: Record<string, unknown>) => {
        if (!lifetime.active || !lifetime.canWrite || lifetime.busy || lifetime.deleted || !objectActionFormOpen || formVersion !== lifetime.formVersion || !activeObjectAction?.form?.length) {
            return;
        }

        lifetime.busy = true;
        lifetime.previewReady = false;
        lifetime.previewVersion += 1;
        const actionSlug = activeObjectAction.slug;
        setActiveActionSlug(actionSlug);
        setError(null);
        try {
            const response = await client.runObjectAction(slug, id, actionSlug, payload);
            invalidateModelCache(client, slug);
            if (!lifetime.active) return;
            // Closing a dialog does not undo the server action. Refresh the card,
            // preserving its draft, but retire the closed opening's UI callbacks.
            applyActionItem(response.item);
            if (formVersion !== lifetime.formVersion) return;
            message.success(t('action_success', {action: activeObjectAction.label, count: 1}));
            lifetime.formVersion += 1;
            setObjectActionFormOpen(false);
        } catch (reason: unknown) {
            if (lifetime.active && formVersion === lifetime.formVersion) throw reason;
        } finally {
            lifetime.busy = false;
            if (lifetime.active) setActiveActionSlug(null);
        }
    }, [applyActionItem, client, id, lifetime, message, activeObjectAction, objectActionFormOpen, formVersion, slug, t]);

    const handleCloseObjectActionForm = useCallback(() => {
        if (!lifetime.active || formVersion !== lifetime.formVersion) return;
        lifetime.formVersion += 1;
        setObjectActionFormOpen(false);
    }, [formVersion, lifetime]);

    const handleCloseDeletePreview = useCallback(() => {
        if (!lifetime.active || lifetime.busy || previewVersion !== lifetime.previewVersion) return;
        lifetime.previewVersion += 1;
        lifetime.previewReady = false;
        setDeleteConfirmOpen(false);
        setIsDeletePreviewLoading(false);
        setDeletePreviewError(null);
    }, [lifetime, previewVersion]);

    const handleOpenDeletePreview = useCallback(async () => {
        if (!lifetime.active || !lifetime.canWrite || lifetime.busy || lifetime.deleted) return;
        const version = ++lifetime.previewVersion;
        lifetime.previewReady = false;
        setActionsAnchorEl(null);
        setDeleteConfirmOpen(true);
        setDeletePreview(null);
        setDeletePreviewError(null);
        setIsDeletePreviewLoading(true);
        try {
            const preview = await client.getDeletePreview(slug, id);
            if (!lifetime.active || version !== lifetime.previewVersion) return;
            lifetime.previewReady = preview.can_delete;
            setDeletePreview(preview);
        } catch (reason: unknown) {
            if (!lifetime.active || version !== lifetime.previewVersion) return;
            setDeletePreviewError(reason instanceof Error ? reason.message : t('delete_preview_error'));
        } finally {
            if (lifetime.active && version === lifetime.previewVersion) setIsDeletePreviewLoading(false);
        }
    }, [client, id, lifetime, slug, t]);

    return {
        canWrite,
        actionsAnchorEl,
        activeActionSlug,
        activeObjectAction,
        data: dataOwner === lifetime ? data : null,
        deleteConfirmOpen,
        deletePreview,
        deletePreviewError,
        detailFields,
        editableFieldNames,
        error,
        fieldMap,
        handleDelete,
        handleCloseDeletePreview,
        handleFieldChange,
        handleNavigateBack,
        handleOpenDeletePreview,
        handleRunObjectAction,
        handleSave,
        handleCloseObjectActionForm,
        handleSubmitObjectActionForm,
        initialValues,
        isActionsMenuOpen,
        isDeletePreviewLoading,
        isDeleting,
        isDirty,
        isLoading,
        isSaving,
        isMutating,
        objectActionFormOpen,
        meta,
        objectActions,
        objectTitle,
        setActionsAnchorEl,
        values,
    };
}
