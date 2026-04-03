'use client';

import type {ReactNode} from 'react';
import {Box} from '@mui/material';
import {useAdminLocation} from '@xladmin-core/router';
import {ModelPageSkeleton} from '../model-page/Skeletons';
import {useShellContext} from './ShellContext';

type MainProps = {
    children: ReactNode;
};

/**
 * Правая часть админки.
 *
 * Здесь живёт только текущий контент маршрута без дополнительной логики переходов.
 */
export function Main({children}: MainProps) {
    useAdminLocation();
    const {pendingPath, pendingView} = useShellContext();
    const isPendingNavigation = pendingPath !== null;

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
            {isPendingNavigation ? (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 5,
                        backgroundColor: 'background.default',
                    }}
                >
                    {pendingView === 'model' || pendingView === 'overview' ? <ModelPageSkeleton/> :
                        <ModelPageSkeleton/>}
                </Box>
            ) : null}
        </Box>
    );
}
