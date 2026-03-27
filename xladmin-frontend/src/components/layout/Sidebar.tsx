'use client';

import {memo} from 'react';
import {Box, List, ListItemButton, ListItemText, Paper, Stack, Typography} from '@mui/material';
import type {AdminModelMeta} from '../../types';
import {AdminNavLink} from '../AdminNavLink';

type SidebarProps = {
    models: AdminModelMeta[];
    basePath: string;
};

/**
 * Левая колонка админки со списком моделей.
 */
export const Sidebar = memo(function Sidebar({models, basePath}: SidebarProps) {
    return (
        <Paper
            sx={{
                p: 2,
                borderRadius: '10px',
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <Box sx={{height: '100%', overflow: 'auto', pr: 0.5}}>
                <Typography variant="h6" sx={{mb: 2, fontWeight: 700}}>
                    XLAdmin
                </Typography>
                <Stack spacing={1}>
                    <AdminNavLink href={basePath} style={{textDecoration: 'none'}}>
                        <ListItemButton sx={{borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.035)'}}>
                            <ListItemText primary="Все модели"/>
                        </ListItemButton>
                    </AdminNavLink>
                    <List dense disablePadding sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                        {models.map((model) => (
                            <AdminNavLink key={model.slug} href={`${basePath}/${model.slug}`} style={{textDecoration: 'none'}}>
                                <ListItemButton sx={{borderRadius: '8px'}}>
                                    <ListItemText primary={model.title} secondary={model.slug}/>
                                </ListItemButton>
                            </AdminNavLink>
                        ))}
                    </List>
                </Stack>
            </Box>
        </Paper>
    );
});
