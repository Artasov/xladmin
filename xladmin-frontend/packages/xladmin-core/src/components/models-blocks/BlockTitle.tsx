'use client';

import {Stack, Typography} from '@mui/material';
import type {NormalizedBlock} from './types';

type BlockTitleProps = {
    block: NormalizedBlock;
    compact?: boolean;
};

export function BlockTitle({block, compact = false}: BlockTitleProps) {
    return (
        <Stack spacing={0.25}>
            <Typography
                variant={compact ? 'subtitle1' : 'h6'}
                sx={{
                    fontWeight: 700,
                    fontSize: compact ? '1rem' : undefined,
                    lineHeight: compact ? 1.2 : undefined,
                }}
            >
                {block.title}
            </Typography>
            {block.description && !compact ? (
                <Typography color="text.secondary" sx={{fontSize: compact ? 12 : 14, lineHeight: 1.3}}>
                    {block.description}
                </Typography>
            ) : null}
        </Stack>
    );
}
