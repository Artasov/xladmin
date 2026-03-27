'use client';

import type {ReactNode} from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {Accordion, AccordionDetails, AccordionSummary, Alert, Paper, Skeleton, Stack, Typography} from '@mui/material';

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
};

/**
 * Основной заголовок правой панели админки.
 *
 * Это именованный компонент, чтобы в DevTools был виден не анонимный `Paper`,
 * а понятный `MainHeader`.
 */
export function MainHeader({title, subtitle, details, error}: MainHeaderProps) {
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
            <Stack spacing={0.5}>
                <Typography variant="h5" sx={{fontWeight: 600, lineHeight: '2.125rem'}}>
                    {title}
                </Typography>
                {subtitle && !details ? (
                    <Typography color="text.secondary" sx={{lineHeight: '1rem'}}>
                        {subtitle}
                    </Typography>
                ) : null}
                {details ? (
                    <Accordion
                        disableGutters
                        elevation={0}
                        sx={{
                            backgroundColor: 'transparent',
                            '&::before': {
                                display: 'none',
                            },
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon fontSize="small"/>}
                            sx={{
                                minHeight: '32px',
                                px: 0,
                                '& .MuiAccordionSummary-content': {
                                    my: 0,
                                },
                            }}
                        >
                            <Typography color="text.secondary" sx={{lineHeight: '1rem'}}>
                                {subtitle}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{px: 0, pt: 0.5, pb: 0}}>
                            {details}
                        </AccordionDetails>
                    </Accordion>
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
                pt: MAIN_HEADER_PADDING_B,
                pb: MAIN_HEADER_PADDING_B,
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
