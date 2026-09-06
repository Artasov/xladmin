'use client';

import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {AdminClient} from '../../client';
import type {AdminEditableFieldMeta} from '../../types';
import {buildAdminFormInitialValues, buildAdminPayload} from '../../utils/adminFields';
import {useAdminMessage} from '../layout/AdminMessageContext';

type FormSessionOptions = {
    client: AdminClient;
    identity: string;
    open: boolean;
    fields: AdminEditableFieldMeta[];
    initialValues?: Record<string, unknown>;
    errorFallback: string;
    onClose: () => void;
};

/** Owns one opening of a form, independently of metadata reference refreshes. */
export function useAdminFormSession({client, identity, open, fields, initialValues, errorFallback, onClose}: FormSessionOptions) {
    const message = useAdminMessage();
    const scope = useMemo(() => ({
        client,
        identity,
        open,
        active: false,
        busy: false,
        picker: null as string | null,
        pendingPicker: null as {id: number; field: string} | null,
    }), [client, identity, open]);
    const initialized = useRef<typeof scope | null>(null);
    const [values, setValues] = useState(() => buildAdminFormInitialValues(fields, initialValues));
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editorVersion, setEditorVersion] = useState(0);
    const [openPickerFieldName, setOpenPickerFieldName] = useState<string | null>(null);

    useLayoutEffect(() => {
        scope.active = scope.open;
        return () => {
            scope.active = false;
            if (scope.pendingPicker) window.cancelAnimationFrame(scope.pendingPicker.id);
            scope.pendingPicker = null;
        };
    }, [scope]);

    useLayoutEffect(() => {
        if (initialized.current === scope) return;
        // Reset editor-local state (invalid JSON, relation search) only on a new opening.
        if (open && initialized.current !== null) setEditorVersion((current) => current + 1);
        initialized.current = scope;
        // Keep the previous values visible during the dialog's exit animation.
        if (open) setValues(buildAdminFormInitialValues(fields, initialValues));
        setError(null);
        setIsSubmitting(false);
        setOpenPickerFieldName(null);
    }, [scope, open, fields, initialValues]);

    const close = () => {
        if (!scope.active) return;
        scope.active = false;
        if (scope.pendingPicker) window.cancelAnimationFrame(scope.pendingPicker.id);
        scope.pendingPicker = null;
        scope.picker = null;
        setOpenPickerFieldName(null);
        onClose();
    };

    const changeField = (name: string, value: unknown) => {
        if (!scope.active || scope.busy) return;
        setValues((current) => ({...current, [name]: value}));
    };

    const requestPickerOpen = (name: string) => {
        if (!scope.active || scope.busy || scope.picker === name) return;
        if (scope.pendingPicker) window.cancelAnimationFrame(scope.pendingPicker.id);
        scope.pendingPicker = null;
        if (scope.picker !== null) {
            scope.picker = null;
            setOpenPickerFieldName(null);
            const id = window.requestAnimationFrame(() => {
                scope.pendingPicker = null;
                if (!scope.active || scope.busy) return;
                scope.picker = name;
                setOpenPickerFieldName(name);
            });
            scope.pendingPicker = {id, field: name};
            return;
        }
        scope.picker = name;
        setOpenPickerFieldName(name);
    };

    const requestPickerClose = (name: string) => {
        if (!scope.active) return;
        if (scope.pendingPicker?.field === name) {
            window.cancelAnimationFrame(scope.pendingPicker.id);
            scope.pendingPicker = null;
        }
        if (scope.picker !== name) return;
        scope.picker = null;
        setOpenPickerFieldName(null);
    };

    const submit = async (operation: (payload: Record<string, unknown>) => Promise<unknown>, onSuccess: () => void) => {
        // A synchronous lock also blocks duplicate invocations before React renders.
        if (!scope.active || scope.busy) return;
        scope.busy = true;
        setIsSubmitting(true);
        setError(null);
        if (scope.pendingPicker) window.cancelAnimationFrame(scope.pendingPicker.id);
        scope.pendingPicker = null;
        scope.picker = null;
        setOpenPickerFieldName(null);
        try {
            await operation(buildAdminPayload(values, fields));
            if (!scope.active) return;
            onSuccess();
            if (scope.active) close();
        } catch (reason: unknown) {
            if (!scope.active) return;
            const nextError = reason instanceof Error ? reason.message : errorFallback;
            setError(nextError);
            message.error(nextError);
        } finally {
            scope.busy = false;
            if (scope.active) setIsSubmitting(false);
        }
    };

    return {values, error, isSubmitting, editorVersion, openPickerFieldName, changeField, requestPickerOpen, requestPickerClose, submit, close};
}
