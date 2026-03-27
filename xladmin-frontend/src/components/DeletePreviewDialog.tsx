'use client';

import {Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography} from '@mui/material';
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
        <Dialog open={open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{minHeight: 180}}>
                        <CircularProgress size={28} thickness={4.2} color="inherit" />
                        <Typography color="text.secondary">{t('delete_preview_loading')}</Typography>
                    </Stack>
                ) : null}

                {!isLoading && error ? <Alert severity="error">{error}</Alert> : null}

                {!isLoading && !error && preview ? (
                    <Stack spacing={1.5}>
                        <Typography color="text.secondary">{t('delete_preview_hint')}</Typography>
                        <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_roots', {count: preview.summary.roots})}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_related', {count: preview.summary.related})}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('delete_preview_total', {count: preview.summary.total})}
                            </Typography>
                        </Stack>
                        {preview.summary.related === 0 ? (
                            <Typography variant="body2" color="text.secondary">{t('delete_preview_empty')}</Typography>
                        ) : null}
                        {preview.roots.length > 0 ? (
                            <Stack spacing={1}>
                                {preview.roots.map((rootNode, index) => (
                                    <DeletePreviewNode key={`${rootNode.model_slug ?? 'model'}:${rootNode.id}:${index}`} node={rootNode} depth={0} />
                                ))}
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">{t('delete_preview_no_selection')}</Typography>
                        )}
                    </Stack>
                ) : null}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSubmitting}>{t('cancel')}</Button>
                <Button color="error" variant="contained" onClick={onConfirm} disabled={isSubmitting || isLoading || Boolean(error)}>
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
                    {node.model_title}{node.relation_name ? ` • ${node.relation_name}` : ''}
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
