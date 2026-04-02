'use client';

import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {Box, Paper, Stack, Typography} from '@mui/material';
import {alpha, type Theme, useTheme} from '@mui/material/styles';

type AdminMessageKind = 'success' | 'error' | 'info';

type AdminMessageOptions = {
    duration?: number;
};

type AdminMessageApi = {
    show: (kind: AdminMessageKind, text: string, options?: AdminMessageOptions) => number;
    success: (text: string, options?: AdminMessageOptions) => number;
    error: (text: string, options?: AdminMessageOptions) => number;
    info: (text: string, options?: AdminMessageOptions) => number;
    dismiss: (id: number) => void;
    clear: () => void;
};

type AdminMessageItem = {
    id: number;
    kind: AdminMessageKind;
    text: string;
    leaving: boolean;
};

const DEFAULT_DURATION_MS = 3000;
const EXIT_DURATION_MS = 220;

const defaultAdminMessageApi: AdminMessageApi = {
    show: () => -1,
    success: () => -1,
    error: () => -1,
    info: () => -1,
    dismiss: () => {
    },
    clear: () => {
    },
};

const AdminMessageContext = createContext<AdminMessageApi>(defaultAdminMessageApi);

export function AdminMessageProvider({children}: { children: ReactNode }) {
    const [items, setItems] = useState<AdminMessageItem[]>([]);
    const idRef = useRef(0);
    const dismissTimersRef = useRef(new Map<number, number>());
    const removeTimersRef = useRef(new Map<number, number>());

    const dismiss = useCallback((id: number) => {
        const dismissTimerId = dismissTimersRef.current.get(id);
        if (dismissTimerId !== undefined) {
            window.clearTimeout(dismissTimerId);
            dismissTimersRef.current.delete(id);
        }

        setItems((current) => current.map((item) => (
            item.id === id ? {...item, leaving: true} : item
        )));

        const previousRemoveTimerId = removeTimersRef.current.get(id);
        if (previousRemoveTimerId !== undefined) {
            window.clearTimeout(previousRemoveTimerId);
        }
        const removeTimerId = window.setTimeout(() => {
            setItems((current) => current.filter((item) => item.id !== id));
            removeTimersRef.current.delete(id);
        }, EXIT_DURATION_MS);
        removeTimersRef.current.set(id, removeTimerId);
    }, []);

    const show = useCallback((kind: AdminMessageKind, text: string, options?: AdminMessageOptions) => {
        if (!text.trim()) {
            return -1;
        }

        idRef.current += 1;
        const id = idRef.current;
        setItems((current) => [...current, {id, kind, text, leaving: false}]);

        const duration = options?.duration ?? DEFAULT_DURATION_MS;
        const dismissTimerId = window.setTimeout(() => dismiss(id), duration);
        dismissTimersRef.current.set(id, dismissTimerId);
        return id;
    }, [dismiss]);

    const clear = useCallback(() => {
        for (const timerId of dismissTimersRef.current.values()) {
            window.clearTimeout(timerId);
        }
        for (const timerId of removeTimersRef.current.values()) {
            window.clearTimeout(timerId);
        }
        dismissTimersRef.current.clear();
        removeTimersRef.current.clear();
        setItems([]);
    }, []);

    useEffect(() => clear, [clear]);

    const value = useMemo<AdminMessageApi>(() => ({
        show,
        success: (text, options) => show('success', text, options),
        error: (text, options) => show('error', text, options),
        info: (text, options) => show('info', text, options),
        dismiss,
        clear,
    }), [clear, dismiss, show]);

    return (
        <AdminMessageContext.Provider value={value}>
            {children}
            <AdminMessageViewport items={items} onDismiss={dismiss}/>
        </AdminMessageContext.Provider>
    );
}

export function useAdminMessage() {
    return useContext(AdminMessageContext);
}

function AdminMessageViewport({
                                  items,
                                  onDismiss,
                              }: {
    items: AdminMessageItem[];
    onDismiss: (id: number) => void;
}) {
    return (
        <Box
            aria-live="polite"
            sx={{
                position: 'fixed',
                top: {xs: 12, sm: 16},
                right: {xs: 12, sm: 16},
                zIndex: (theme) => theme.zIndex.snackbar,
                width: {xs: 'calc(100vw - 24px)', sm: 360},
                maxWidth: '100%',
                pointerEvents: 'none',
            }}
        >
            <Stack spacing={1}>
                {items.map((item) => (
                    <AdminMessageBubble key={item.id} item={item} onDismiss={onDismiss}/>
                ))}
            </Stack>
        </Box>
    );
}

function AdminMessageBubble({
                                item,
                                onDismiss,
                            }: {
    item: AdminMessageItem;
    onDismiss: (id: number) => void;
}) {
    const theme = useTheme();
    const appearance = getBubbleAppearance(theme, item.kind);
    const Icon = appearance.icon;

    return (
        <Paper
            elevation={0}
            onClick={() => onDismiss(item.id)}
            role="button"
            sx={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                borderRadius: '14px',
                px: 1.5,
                py: 1.25,
                border: `1px solid ${appearance.borderColor}`,
                backgroundColor: appearance.backgroundColor,
                boxShadow: `0 14px 32px ${alpha('#000000', 0.22)}`,
                transform: item.leaving ? 'translateX(24px) scale(0.98)' : 'translateX(0) scale(1)',
                opacity: item.leaving ? 0 : 1,
                transition: 'transform 220ms ease, opacity 220ms ease',
                animation: item.leaving ? 'none' : 'adminMessageEnter 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                '@keyframes adminMessageEnter': {
                    '0%': {
                        opacity: 0,
                        transform: 'translateX(32px) scale(0.96)',
                    },
                    '100%': {
                        opacity: 1,
                        transform: 'translateX(0) scale(1)',
                    },
                },
            }}
        >
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        mt: 0.125,
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: appearance.iconColor,
                        backgroundColor: appearance.iconBackgroundColor,
                    }}
                >
                    <Icon sx={{fontSize: 17}}/>
                </Box>
                <Typography
                    sx={{
                        fontSize: 14,
                        lineHeight: 1.45,
                        fontWeight: 500,
                        color: 'text.primary',
                        wordBreak: 'break-word',
                    }}
                >
                    {item.text}
                </Typography>
            </Stack>
        </Paper>
    );
}

function getBubbleAppearance(theme: Theme, kind: AdminMessageKind) {
    if (kind === 'success') {
        return {
            icon: CheckCircleOutlineIcon,
            borderColor: alpha(theme.palette.success.main, 0.35),
            backgroundColor: alpha(theme.palette.success.main, 0.12),
            iconColor: theme.palette.success.light,
            iconBackgroundColor: alpha(theme.palette.success.main, 0.16),
        };
    }
    if (kind === 'error') {
        return {
            icon: ErrorOutlineIcon,
            borderColor: alpha(theme.palette.error.main, 0.35),
            backgroundColor: alpha(theme.palette.error.main, 0.12),
            iconColor: theme.palette.error.light,
            iconBackgroundColor: alpha(theme.palette.error.main, 0.16),
        };
    }
    return {
        icon: InfoOutlinedIcon,
        borderColor: alpha(theme.palette.info.main, 0.35),
        backgroundColor: alpha(theme.palette.info.main, 0.12),
        iconColor: theme.palette.info.light,
        iconBackgroundColor: alpha(theme.palette.info.main, 0.16),
    };
}
