'use client';

import {memo} from 'react';
import {usePathname} from 'next/navigation.js';
import {Box, ListItemButton, Typography} from '@mui/material';
import {useAdminTranslation} from '../../i18n';
import type {AdminModelMeta, AdminModelsBlockMeta} from '../../types';
import {ModelsBlocks} from '../ModelsBlocks';
import {NavLink} from '../NavLink';

type SidebarProps = {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    basePath: string;
};

export const Sidebar = memo(function Sidebar({models, blocks, basePath}: SidebarProps) {
    const t = useAdminTranslation();
    const pathname = usePathname();
    const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    const fallbackBasePath = normalizedBasePath.replace(/^\/(ru|en)(?=\/|$)/, '') || '/';
    const matchedBasePath = pathname.startsWith(normalizedBasePath)
        ? normalizedBasePath
        : pathname.startsWith(fallbackBasePath)
            ? fallbackBasePath
            : null;
    const relativePath = matchedBasePath ? pathname.slice(matchedBasePath.length) : '';
    const activeModelSlug = relativePath.split('/').filter(Boolean)[0] ?? null;
    const isOverviewActive = matchedBasePath !== null && (pathname === matchedBasePath || pathname === `${matchedBasePath}/`);

    return (
        <Box sx={{height: '100%', overflow: 'hidden'}}>
            <Box
                sx={{
                    height: '100%',
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    scrollbarGutter: 'stable',
                    direction: 'rtl',
                    ml: 0,
                    pl: 0,
                }}
            >
                <Box sx={{direction: 'ltr', pl: 1}}>
                    <NavLink href={basePath} style={{textDecoration: 'none', display: 'block'}}>
                        <ListItemButton
                            selected={isOverviewActive}
                            sx={{
                                mb: 2,
                                borderRadius: '8px',
                                backgroundColor: isOverviewActive
                                    ? 'rgba(255, 255, 255, 0.18)'
                                    : 'rgba(255, 255, 255, 0.035)',
                                boxShadow: isOverviewActive
                                    ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)'
                                    : 'none',
                                '&:hover': {
                                    backgroundColor: isOverviewActive
                                        ? 'rgba(255, 255, 255, 0.2)'
                                        : 'rgba(255, 255, 255, 0.055)',
                                },
                            }}
                        >
                            <Typography variant="subtitle1" sx={{fontWeight: 700}}>
                                {t('overview')}
                            </Typography>
                        </ListItemButton>
                    </NavLink>
                    <ModelsBlocks
                        models={models}
                        blocks={blocks}
                        basePath={basePath}
                        variant="sidebar"
                        activeModelSlug={activeModelSlug}
                    />
                </Box>
            </Box>
        </Box>
    );
});
