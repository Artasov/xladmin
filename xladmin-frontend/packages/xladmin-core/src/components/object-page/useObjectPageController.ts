'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {
    buildDetailCacheKey,
    getClientCacheBucket,
    getModelCacheVersion,
    invalidateModelCache,
    setCachedDetailResponse,
} from '../../cache';
import type {XLAdminClient} from '../../client';
import type {AdminTranslationKey} from '../../i18n';
import type {XLAdminRouter} from '../../router';
import type {AdminDeletePreviewResponse, AdminDetailResponse} from '../../types';
import {buildAdminPayload} from '../../utils/adminFields';
import {isDeepEqual} from '../../utils/isDeepEqual';

type UseObjectPageControllerOptions = {
    client: XLAdminClient;
    slug: string;
    id: string;
    listPath: string;
    router: XLAdminRouter;
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
    const cacheKey = buildDetailCacheKey(slug, id);
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

    useEffect(() => {
        let isMounted = true;
        const bucket = getClientCacheBucket(client);
        const cachedResponse = bucket.detailResponseCache.get(cacheKey);

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
                setError(reason instanceof Error ? reason.message : t('object_load_error'));
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
    const objectTitle = useMemo(
        () => String(data?.item._display ?? (meta ? `${meta.title} #${id}` : id)),
        [data, id, meta],
    );
    const isActionsMenuOpen = actionsAnchorEl !== null;
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
            invalidateModelCache(client, slug);
            setCachedDetailResponse(client, cacheKey, nextDetail);
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
            invalidateModelCache(client, slug);
            router.push(listPath);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('object_delete_error'));
            setIsDeleting(false);
            setDeleteConfirmOpen(false);
        }
    }, [client, id, listPath, router, slug, t]);

    const handleNavigateBack = useCallback(() => {
        router.push(listPath);
    }, [listPath, router]);

    const handleRunObjectAction = useCallback(async (actionSlug: string) => {
        setActiveActionSlug(actionSlug);
        setError(null);
        try {
            const response = await client.runObjectAction(slug, id, actionSlug);
            const nextDetail = data ? {...data, item: response.item} : null;
            if (nextDetail) {
                invalidateModelCache(client, slug);
                setCachedDetailResponse(client, cacheKey, nextDetail);
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
        setActionsAnchorEl(null);
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

    return {
        actionsAnchorEl,
        activeActionSlug,
        data,
        deleteConfirmOpen,
        deletePreview,
        deletePreviewError,
        detailFields,
        editableFieldNames,
        error,
        fieldMap,
        handleDelete,
        handleFieldChange,
        handleNavigateBack,
        handleOpenDeletePreview,
        handleRunObjectAction,
        handleSave,
        initialValues,
        isActionsMenuOpen,
        isDeletePreviewLoading,
        isDeleting,
        isDirty,
        isLoading,
        isSaving,
        meta,
        objectActions,
        objectTitle,
        setActionsAnchorEl,
        setDeleteConfirmOpen,
        setDeletePreview,
        setDeletePreviewError,
        values,
    };
}
