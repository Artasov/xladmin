'use client';

import {useEffect, useRef, useState} from 'react';
import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {AdminClient} from '../client';
import {useAdminTranslation} from '../i18n';
import type {AdminFormFieldMeta, AdminLocale} from '../types';
import {buildAdminFormInitialValues, buildAdminPayload} from '../utils/adminFields';
import {getMuiPickersLocaleText} from '../utils/pickersLocale';
import {FieldEditor} from './FieldEditor';
import {useAdminMessage} from './layout/AdminMessageContext';

type ActionFormDialogProps = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title: string;
    submitLabel?: string;
    slug: string;
    locale: AdminLocale;
    fields: AdminFormFieldMeta[];
    client: AdminClient;
    choiceScope: (
        | {kind: 'bulk-action'; actionSlug: string}
        | {kind: 'object-action'; actionSlug: string; itemId: string | number}
    );
    initialValues?: Record<string, unknown>;
    onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export function ActionFormDialog({
                                     open,
                                     onClose,
                                     onSuccess,
                                     title,
                                     submitLabel,
                                     slug,
                                     locale,
                                     fields,
                                     client,
                                     choiceScope,
                                     initialValues,
                                     onSubmit,
                                 }: ActionFormDialogProps) {
    const t = useAdminTranslation();
    const message = useAdminMessage();
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openPickerFieldName, setOpenPickerFieldName] = useState<string | null>(null);
    const pendingPickerFrameRef = useRef<number | null>(null);

    useEffect(() => {
        setValues(buildAdminFormInitialValues(fields, initialValues));
        setError(null);
        setIsSubmitting(false);
        setOpenPickerFieldName(null);
    }, [fields, initialValues, open]);

    useEffect(() => {
        return () => {
            if (pendingPickerFrameRef.current !== null) {
                window.cancelAnimationFrame(pendingPickerFrameRef.current);
                pendingPickerFrameRef.current = null;
            }
        };
    }, []);

    const requestPickerOpen = (fieldName: string) => {
        if (openPickerFieldName === fieldName) {
            return;
        }
        if (pendingPickerFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingPickerFrameRef.current);
            pendingPickerFrameRef.current = null;
        }
        if (openPickerFieldName !== null) {
            setOpenPickerFieldName(null);
            pendingPickerFrameRef.current = window.requestAnimationFrame(() => {
                setOpenPickerFieldName(fieldName);
                pendingPickerFrameRef.current = null;
            });
            return;
        }
        setOpenPickerFieldName(fieldName);
    };

    const requestPickerClose = (fieldName: string) => {
        if (pendingPickerFrameRef.current !== null && openPickerFieldName === fieldName) {
            window.cancelAnimationFrame(pendingPickerFrameRef.current);
            pendingPickerFrameRef.current = null;
        }
        setOpenPickerFieldName((current) => (current === fieldName ? null : current));
    };

    const handleSubmit = async () => {
        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit(buildAdminPayload(values, fields));
            onSuccess();
            onClose();
        } catch (reason: unknown) {
            const nextError = reason instanceof Error ? reason.message : t('object_action_error');
            setError(nextError);
            message.error(nextError);
        } finally {
            setIsSubmitting(false);
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
                <LocalizationProvider
                    dateAdapter={AdapterDayjs}
                    adapterLocale={locale}
                    localeText={getMuiPickersLocaleText(locale)}
                >
                    <Box sx={{display: 'grid', gap: 2, pt: 1}}>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        {fields.map((field) => (
                            <FieldEditor
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                slug={slug}
                                client={client}
                                choiceScope={choiceScope}
                                isPickerOpen={openPickerFieldName === field.name}
                                hasAnotherPickerOpen={openPickerFieldName !== null && openPickerFieldName !== field.name}
                                onChange={(nextValue) => {
                                    setValues((current) => ({...current, [field.name]: nextValue}));
                                }}
                                onRequestPickerOpen={() => requestPickerOpen(field.name)}
                                onRequestPickerClose={() => requestPickerClose(field.name)}
                            />
                        ))}
                    </Box>
                </LocalizationProvider>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSubmitting}>{t('cancel')}</Button>
                <Button variant="contained" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                    {isSubmitting ? t('saving') : (submitLabel ?? t('save'))}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
