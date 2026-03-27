'use client';

import type {ReactNode} from 'react';
import {Alert, Paper, Skeleton, Stack, Typography} from '@mui/material';

const MAIN_HEADER_PADDING_X = 2.5;
const MAIN_HEADER_PADDING_T = 1.2;
const MAIN_HEADER_PADDING_B = 1.8;
const MAIN_HEADER_TITLE_HEIGHT = 34;
const MAIN_HEADER_SUBTITLE_HEIGHT = 16;

type MainHeaderProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    error?: string | null;
};

/**
 * Основной заголовок правой панели админки.
 *
 * Это именованный компонент, чтобы в DevTools был виден не анонимный `Paper`,
 * а понятный `MainHeader`.
 */
export function MainHeader({title, subtitle, error}: MainHeaderProps) {
    return (
        <Paper
            sx={{
                px: MAIN_HEADER_PADDING_X,
                pt: MAIN_HEADER_PADDING_T,
                pb: MAIN_HEADER_PADDING_B,
                borderRadius: '10px',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 3,
            }}
        >
            <Stack spacing={0.8}>
                <Typography variant="h4" sx={{fontWeight: 800, lineHeight: '2.125rem'}}>
                    {title}
                </Typography>
                {subtitle ? (
                    <Typography color="text.secondary" sx={{lineHeight: '1rem'}}>
                        {subtitle}
                    </Typography>
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
                px: MAIN_HEADER_PADDING_X,
                pt: MAIN_HEADER_PADDING_T,
                pb: MAIN_HEADER_PADDING_B,
                borderRadius: '10px',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 3,
            }}
        >
            <Stack spacing={0.8}>
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
