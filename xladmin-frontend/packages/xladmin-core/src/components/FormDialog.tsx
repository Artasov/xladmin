'use client';

import {useMemo} from 'react';
import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {AdminClient} from '../client';
import {useAdminTranslation} from '../i18n';
import type {AdminEditableFieldMeta, AdminModelMeta} from '../types';
import {useAdminFormSession} from './form-dialog/useAdminFormSession';
import {getMuiPickersLocaleText} from '../utils/pickersLocale';
import {FieldEditor} from './FieldEditor';
import {useAdminMessage} from './layout/AdminMessageContext';

type AdminFormDialogProps = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title: string;
    slug: string;
    mode: 'create' | 'patch';
    meta: AdminModelMeta;
    client: AdminClient;
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
    const message = useAdminMessage();
    const editableFields = useMemo(
        (): AdminEditableFieldMeta[] => {
            if (meta.read_only) return [];
            if (mode === 'create' && meta.create_form && meta.create_form.length > 0) {
                return meta.create_form;
            }
            const editableFieldNames = mode === 'create' ? meta.create_fields : meta.update_fields;
            return meta.fields.filter((field) => editableFieldNames.includes(field.name));
        },
        [meta.read_only, meta.create_fields, meta.create_form, meta.fields, meta.update_fields, mode],
    );
    const canSubmit = open && !meta.read_only && (mode === 'create' || itemId !== undefined);
    const {values, error, isSubmitting: isSaving, editorVersion, openPickerFieldName, changeField, requestPickerOpen, requestPickerClose, submit, close} = useAdminFormSession({
        client, identity: JSON.stringify([slug, mode, itemId]), open: open && !meta.read_only,
        fields: editableFields, initialValues, errorFallback: t('object_save_error'), onClose,
    });
    const handleSave = () => {
        if (!canSubmit) return;
        return submit(
            (payload) => mode === 'create'
                ? client.createItem(slug, payload)
                : client.patchItem(slug, itemId!, payload),
            () => {
                message.success(t(mode === 'create' ? 'object_created_success' : 'object_saved_success'));
                onSuccess();
            },
        );
    };

    return (
        <Dialog
            open={open && !meta.read_only}
            onClose={close}
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
                <LocalizationProvider
                    dateAdapter={AdapterDayjs}
                    adapterLocale={meta.locale}
                    localeText={getMuiPickersLocaleText(meta.locale)}
                >
                    <Box key={editorVersion} sx={{display: 'grid', gap: 2, pt: 1}}>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        {editableFields.map((field) => (
                            <FieldEditor
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                slug={slug}
                                client={client}
                                readOnly={isSaving}
                                isPickerOpen={openPickerFieldName === field.name}
                                hasAnotherPickerOpen={openPickerFieldName !== null && openPickerFieldName !== field.name}
                                onChange={(nextValue) => changeField(field.name, nextValue)}
                                onRequestPickerOpen={() => requestPickerOpen(field.name)}
                                onRequestPickerClose={() => requestPickerClose(field.name)}
                            />
                        ))}
                    </Box>
                </LocalizationProvider>
            </DialogContent>
            <DialogActions>
                <Button onClick={close} disabled={isSaving}>{t('cancel')}</Button>
                <Button variant="contained" onClick={() => void handleSave()} disabled={isSaving || !canSubmit}>
                    {isSaving ? t('saving') : t('save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
