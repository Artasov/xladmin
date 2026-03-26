'use client';

import {useEffect, useMemo, useState} from 'react';
import {
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
import type {AdminModelMeta} from '../types';
import {buildAdminPayload} from '../utils/adminFields';
import {AdminFieldEditor} from './AdminFieldEditor';

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

export function AdminFormDialog({
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
}: AdminFormDialogProps) {
    const [values, setValues] = useState<Record<string, unknown>>({});
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
    }, [initialValues, open]);

    const handleSave = async () => {
        const payload = buildAdminPayload(values, editableFields);
        if (mode === 'create') {
            await client.createItem(slug, payload);
        } else if (itemId !== undefined) {
            await client.patchItem(slug, itemId, payload);
        }
        onSuccess();
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box sx={{display: 'grid', gap: 2, pt: 1}}>
                        {editableFields.map((field) => (
                            <AdminFieldEditor
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
                <Button onClick={onClose}>Отмена</Button>
                <Button variant="contained" onClick={handleSave}>Сохранить</Button>
            </DialogActions>
        </Dialog>
    );
}
