'use client';

import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography
} from '@mui/material';
import {useAdminTranslation} from '../i18n';
import type {AdminDeletePreviewNode, AdminDeletePreviewResponse} from '../types';

type DeletePreviewDialogProps = {
    open: boolean;
    title: string;
    preview: AdminDeletePreviewResponse | null;
    error: string | null;
    isLoading: boolean;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

export function DeletePreviewDialog({
                                        open,
                                        title,
                                        preview,
                                        error,
                                        isLoading,
                                        isSubmitting,
                                        onClose,
                                        onConfirm,
                                    }: DeletePreviewDialogProps) {
    const t = useAdminTranslation();

    return (
        <Dialog
            open={open}
            onClose={isSubmitting ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            slotProps={{
                paper: {
                    sx: {
                        m: {xs: 1, sm: 2, md: 3},
                        width: {xs: 'calc(100% - 16px)', sm: undefined},
                        maxWidth: {xs: 'calc(100% - 16px)', sm: 600},
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
            <DialogContent dividers>
                {isLoading ? (
                    <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{minHeight: 180}}>
                        <CircularProgress size={28} thickness={4.2} color="inherit"/>
                        <Typography color="text.secondary">{t('delete_preview_loading')}</Typography>
                    </Stack>
                ) : null}

                {!isLoading && error ? <Alert severity="error">{error}</Alert> : null}

                {!isLoading && !error && preview ? (
                    <Stack spacing={1.5}>
                        <Typography color="text.secondary">
                            {preview.can_delete ? t('delete_preview_hint') : t('delete_preview_blocked_hint')}
                        </Typography>
                        {!preview.can_delete ? (
                            <Alert severity="warning">{t('delete_preview_blocked_hint')}</Alert>
                        ) : null}
                        <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_roots', {count: preview.summary.roots})}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_delete', {count: preview.summary.delete})}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_protect', {count: preview.summary.protect})}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_set_null', {count: preview.summary.set_null})}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_total', {count: preview.summary.total})}
                            </Typography>
                        </Stack>
                        {preview.summary.delete === 0 && preview.summary.protect === 0 && preview.summary.set_null === 0 ? (
                            <Typography variant="body2" color="text.secondary">{t('delete_preview_empty')}</Typography>
                        ) : null}
                        {preview.roots.length > 0 ? (
                            <Stack spacing={1}>
                                {preview.roots.map((rootNode, index) => (
                                    <DeletePreviewNode key={`${rootNode.model_slug ?? 'model'}:${rootNode.id}:${index}`}
                                                       node={rootNode} depth={0}/>
                                ))}
                            </Stack>
                        ) : (
                            <Typography variant="body2"
                                        color="text.secondary">{t('delete_preview_no_selection')}</Typography>
                        )}
                    </Stack>
                ) : null}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSubmitting}>{t('cancel')}</Button>
                <Button
                    color="error"
                    variant="contained"
                    onClick={onConfirm}
                    disabled={isSubmitting || isLoading || Boolean(error) || (preview !== null && !preview.can_delete)}
                >
                    {isSubmitting ? t('deleting') : t('delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

type DeletePreviewNodeProps = {
    node: AdminDeletePreviewNode;
    depth: number;
};

function DeletePreviewNode({node, depth}: DeletePreviewNodeProps) {
    const t = useAdminTranslation();

    return (
        <Box
            sx={{
                pl: depth === 0 ? 0 : 1.5,
                ml: depth === 0 ? 0 : 0.5,
                borderLeft: depth === 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
            }}
        >
            <Stack spacing={0.25}>
                <Typography sx={{fontWeight: 600}}>{node.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {node.model_title}
                    {node.relation_name ? ` • ${node.relation_name}` : ''}
                    {` • ${getEffectLabel(node.effect, t)}`}
                </Typography>
            </Stack>
            {node.children.length > 0 ? (
                <Stack spacing={0.75} sx={{mt: 1}}>
                    {node.children.map((childNode, index) => (
                        <DeletePreviewNode
                            key={`${childNode.model_slug ?? 'model'}:${childNode.id}:${index}`}
                            node={childNode}
                            depth={depth + 1}
                        />
                    ))}
                </Stack>
            ) : null}
        </Box>
    );
}

function getEffectLabel(effect: AdminDeletePreviewNode['effect'], t: ReturnType<typeof useAdminTranslation>) {
    if (effect === 'protect') {
        return t('delete_effect_protect');
    }
    if (effect === 'set-null') {
        return t('delete_effect_set_null');
    }
    return t('delete_effect_delete');
}
