'use client';

import type {ReactNode} from 'react';
import {Box} from '@mui/material';
import {useXLAdminLocation} from '@xladmin-core/router';
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
    const {pathname} = useXLAdminLocation();
    const {pendingPath, pendingView} = useShellContext();
    const normalizeAdminPath = (path: string) => {
        const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
        return normalizedPath.replace(/^\/(ru|en)(?=\/|$)/, '') || '/';
    };
    const isPendingNavigation = pendingPath !== null && normalizeAdminPath(pathname) !== normalizeAdminPath(pendingPath);

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
