'use client';

import Link from 'next/link.js';
import {Box, List, ListItemButton, ListItemText, Paper, Stack, Typography} from '@mui/material';
import type {AdminModelMeta} from '../types';

type AdminSidebarProps = {
    models: AdminModelMeta[];
    basePath: string;
};

export function AdminSidebar({models, basePath}: AdminSidebarProps) {
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
                    <Link href={basePath} style={{textDecoration: 'none'}}>
                        <ListItemButton sx={{borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.035)'}}>
                            <ListItemText primary="Все модели"/>
                        </ListItemButton>
                    </Link>
                    <List dense disablePadding sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                        {models.map((model) => (
                            <Link key={model.slug} href={`${basePath}/${model.slug}`} style={{textDecoration: 'none'}}>
                                <ListItemButton sx={{borderRadius: '8px'}}>
                                    <ListItemText primary={model.title} secondary={model.slug}/>
                                </ListItemButton>
                            </Link>
                        ))}
                    </List>
                </Stack>
            </Box>
        </Paper>
    );
}
