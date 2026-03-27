'use client';

import type {ReactNode} from 'react';
import {Alert, Paper, Skeleton, Stack, Typography} from '@mui/material';

const MAIN_HEADER_PADDING = 2.5;
const MAIN_HEADER_TITLE_HEIGHT = 42;
const MAIN_HEADER_SUBTITLE_HEIGHT = 24;

type MainHeaderProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    error?: string | null;
};

/**
 * Основной заголовок правой панели админки.
 *
 * Это именованный компонент, чтобы в DevTools было видно не анонимный `Paper`,
 * а понятный `MainHeader`.
 */
export function MainHeader({title, subtitle, error}: MainHeaderProps) {
    return (
        <Paper
            sx={{
                p: MAIN_HEADER_PADDING,
                borderRadius: '10px',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 3,
            }}
        >
            <Typography variant="h4" sx={{fontWeight: 800}}>
                {title}
            </Typography>
            {subtitle ? (
                <Typography color="text.secondary">
                    {subtitle}
                </Typography>
            ) : null}
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
                p: MAIN_HEADER_PADDING,
                borderRadius: '10px',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 3,
            }}
        >
            <Stack spacing={0}>
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
