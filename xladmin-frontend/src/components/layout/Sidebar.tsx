'use client';

import {memo} from 'react';
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
                    <NavLink href={basePath} style={{textDecoration: 'none'}}>
                        <ListItemButton
                            sx={{
                                mb: 2,
                                borderRadius: '8px',
                                backgroundColor: 'rgba(255, 255, 255, 0.035)',
                            }}
                        >
                            <Typography variant="subtitle1" sx={{fontWeight: 700}}>
                                {t('overview')}
                            </Typography>
                        </ListItemButton>
                    </NavLink>
                    <ModelsBlocks models={models} blocks={blocks} basePath={basePath} variant="sidebar" />
                </Box>
            </Box>
        </Box>
    );
});
