'use client';

import {useEffect, useMemo, useState} from 'react';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {XLAdminClient} from '../client';
import {useAdminTranslation} from '../i18n';
import type {AdminModelMeta} from '../types';
import {buildAdminPayload} from '../utils/adminFields';
import {FieldEditor} from './FieldEditor';

type AdminFormDialogProps = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title: string;
    slug: string;
    mode: 'create' | 'patch';
    meta: AdminModelMeta;
    client: XLAdminClient;
    initialValues?: Record<string, unknown>;
    itemId?: string | number;
};

export type FormDialogProps = AdminFormDialogProps;

export function FormDialog({
    open,
    onClose,
    onSuccess,
    title,
    slug,
    mode,
    meta,
    client,
    initialValues,
    itemId,
}: FormDialogProps) {
    const t = useAdminTranslation();
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const editableFieldNames = useMemo(
        () => (mode === 'create' ? meta.create_fields : meta.update_fields),
        [meta.create_fields, meta.update_fields, mode],
    );
    const editableFields = useMemo(
        () => meta.fields.filter((field) => editableFieldNames.includes(field.name)),
        [editableFieldNames, meta.fields],
    );

    useEffect(() => {
        setValues(initialValues ?? {});
        setError(null);
        setIsSaving(false);
    }, [initialValues, open]);

    const handleSave = async () => {
        if (isSaving) {
            return;
        }

        setIsSaving(true);
        setError(null);
        const payload = buildAdminPayload(values, editableFields);
        try {
            if (mode === 'create') {
                await client.createItem(slug, payload);
            } else if (itemId !== undefined) {
                await client.patchItem(slug, itemId, payload);
            }
            onSuccess();
            onClose();
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : t('object_save_error'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            slotProps={{
                paper: {
                    sx: {
                        m: {xs: 1, sm: 2, md: 3},
                        width: {xs: 'calc(100% - 16px)', sm: undefined},
                        maxWidth: {xs: 'calc(100% - 16px)', md: 900},
                        maxHeight: {
                            xs: 'calc(100% - 16px)',
                            sm: 'calc(100% - 32px)',
                            md: 'calc(100% - 48px)',
                        },
                    },
                },
            }}
        >
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={meta.locale}>
                    <Box sx={{display: 'grid', gap: 2, pt: 1}}>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        {editableFields.map((field) => (
                            <FieldEditor
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                slug={slug}
                                client={client}
                                onChange={(nextValue) => {
                                    setValues((current) => ({...current, [field.name]: nextValue}));
                                }}
                            />
                        ))}
                    </Box>
                </LocalizationProvider>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>{t('cancel')}</Button>
                <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving}>
                    {isSaving ? t('saving') : t('save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
