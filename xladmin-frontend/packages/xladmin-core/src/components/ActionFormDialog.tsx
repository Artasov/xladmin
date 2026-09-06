'use client';

import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import type {AdminClient} from '../client';
import {useAdminTranslation} from '../i18n';
import type {AdminFormFieldMeta, AdminLocale} from '../types';
import {useAdminFormSession} from './form-dialog/useAdminFormSession';
import {getMuiPickersLocaleText} from '../utils/pickersLocale';
import {FieldEditor} from './FieldEditor';

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
    const {values, error, isSubmitting, editorVersion, openPickerFieldName, changeField, requestPickerOpen, requestPickerClose, submit, close} = useAdminFormSession({
        client,
        identity: JSON.stringify([slug, choiceScope.kind, choiceScope.actionSlug, choiceScope.kind === 'object-action' ? choiceScope.itemId : null]),
        open, fields, initialValues, errorFallback: t('object_action_error'), onClose,
    });
    const handleSubmit = () => submit(onSubmit, onSuccess);

    return (
        <Dialog
            open={open}
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
                    adapterLocale={locale}
                    localeText={getMuiPickersLocaleText(locale)}
                >
                    <Box key={editorVersion} sx={{display: 'grid', gap: 2, pt: 1}}>
                        {error ? <Alert severity="error">{error}</Alert> : null}
                        {fields.map((field) => (
                            <FieldEditor
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                slug={slug}
                                client={client}
                                readOnly={isSubmitting}
                                choiceScope={choiceScope}
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
                <Button onClick={close} disabled={isSubmitting}>{t('cancel')}</Button>
                <Button variant="contained" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                    {isSubmitting ? t('saving') : (submitLabel ?? t('save'))}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
