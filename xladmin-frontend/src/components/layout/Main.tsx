'use client';

import type {ReactNode} from 'react';
import {Box} from '@mui/material';

type MainProps = {
    children: ReactNode;
};

/**
 * Правая часть админки.
 *
 * Здесь живёт только текущий контент маршрута без дополнительной логики переходов.
 */
export function Main({children}: MainProps) {
    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {children}
        </Box>
    );
}
