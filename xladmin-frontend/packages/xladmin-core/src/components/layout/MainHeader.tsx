'use client';

import type {ReactNode} from 'react';
import {useState} from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import {Box} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {Alert, Collapse, IconButton, Paper, Skeleton, Stack, Typography} from '@mui/material';
import {useAdminTranslation} from '@xladmin-core/i18n';
import {useShellContext} from './ShellContext';

const MAIN_HEADER_PADDING_X = 2.5;
const MAIN_HEADER_PADDING_T = 1.35;
const MAIN_HEADER_PADDING_B = 1.8;
const MAIN_HEADER_TITLE_HEIGHT = 34;
const MAIN_HEADER_SUBTITLE_HEIGHT = 16;

type MainHeaderProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    details?: ReactNode;
    error?: string | null;
    beforeTitle?: ReactNode;
    beforeSubtitle?: ReactNode;
    actions?: ReactNode;
};

/**
 * Основной заголовок правой панели админки.
 *
 * Это именованный компонент, чтобы в DevTools был виден не анонимный `Paper`,
 * а понятный `MainHeader`.
 */
export function MainHeader({title, subtitle, details, error, beforeTitle, beforeSubtitle, actions}: MainHeaderProps) {
    const t = useAdminTranslation();
    const {isMobile, openMobileSidebar} = useShellContext();
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    return (
        <Paper
            sx={{
                px: {xs: 1.5, sm: MAIN_HEADER_PADDING_X},
                pt: {xs: 1.1, sm: MAIN_HEADER_PADDING_T},
                pb: {xs: 1.4, sm: MAIN_HEADER_PADDING_B},
                borderRadius: '10px',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 3,
            }}
        >
            <Stack spacing={0.5}>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between"
                       sx={{minWidth: 0}}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{minWidth: 0, flex: 1}}>
                        {isMobile ? (
                            <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
                                <IconButton
                                    aria-label={t('menu')}
                                    onClick={openMobileSidebar}
                                    size="small"
                                    sx={{ml: -0.5}}
                                >
                                    <MenuIcon fontSize="small"/>
                                </IconButton>
                            </Box>
                        ) : null}
                        {beforeTitle ? (
                            <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
                                {beforeTitle}
                            </Box>
                        ) : null}
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 600,
                                lineHeight: '2.125rem',
                                minWidth: 0,
                            }}
                        >
                            {title}
                        </Typography>
                    </Stack>
                    {actions ? (
                        <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
                            {actions}
                        </Box>
                    ) : null}
                </Stack>
                {subtitle && !details ? (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{minWidth: 0}}>
                        {beforeSubtitle ? (
                            <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
                                {beforeSubtitle}
                            </Box>
                        ) : null}
                        <Typography color="text.secondary" sx={{lineHeight: '1rem', minWidth: 0}}>
                            {subtitle}
                        </Typography>
                    </Stack>
                ) : null}
                {details ? (
                    <Stack spacing={0.5}>
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between"
                               sx={{minWidth: 0}}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{minWidth: 0, flex: 1}}>
                                {beforeSubtitle ? (
                                    <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
                                        {beforeSubtitle}
                                    </Box>
                                ) : null}
                                <Typography color="text.secondary" sx={{lineHeight: '1rem', minWidth: 0}}>
                                    {subtitle}
                                </Typography>
                            </Stack>
                            <IconButton
                                aria-label={isDetailsOpen ? t('hide_details') : t('show_details')}
                                onClick={() => setIsDetailsOpen((current) => !current)}
                                size="small"
                                sx={{mr: -0.5}}
                            >
                                <ExpandMoreIcon
                                    fontSize="small"
                                    sx={{
                                        transform: isDetailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                    }}
                                />
                            </IconButton>
                        </Stack>
                        <Collapse in={isDetailsOpen}>
                            <Box sx={{pt: 0.5}}>
                                {details}
                            </Box>
                        </Collapse>
                    </Stack>
                ) : null}
            </Stack>
            {error ? <Alert severity="error" sx={{mt: 2}}>{error}</Alert> : null}
        </Paper>
    );
}

type MainHeaderSkeletonProps = {
    titleWidth?: number | string;
    subtitleWidth?: number | string;
};

export function MainHeaderSkeleton({
                                       titleWidth = 240,
                                       subtitleWidth = '40%',
                                   }: MainHeaderSkeletonProps) {
    return (
        <Paper
            sx={{
                px: {xs: 1.5, sm: MAIN_HEADER_PADDING_X},
                pt: {xs: 1.4, sm: MAIN_HEADER_PADDING_B},
                pb: {xs: 1.4, sm: MAIN_HEADER_PADDING_B},
                borderRadius: '10px',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 3,
            }}
        >
            <Stack spacing={1.0}>
                <Skeleton
                    variant="rounded"
                    width={titleWidth}
                    height={MAIN_HEADER_TITLE_HEIGHT}
                    sx={{transform: 'none'}}
                />
                <Skeleton
                    variant="rounded"
                    width={subtitleWidth}
                    height={MAIN_HEADER_SUBTITLE_HEIGHT}
                    sx={{transform: 'none'}}
                />
            </Stack>
        </Paper>
    );
}
