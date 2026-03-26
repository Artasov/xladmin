'use client';

import Link from 'next/link.js';
import {Alert, Box, Card, CardActionArea, CardContent, Grid, Paper, Stack, Typography} from '@mui/material';
import type {XLAdminClient} from '../client';
import {useAdminRequest} from '../hooks/useAdminRequest';

type AdminHomeProps = {
    client: XLAdminClient;
    basePath: string;
};

export function AdminHome({client, basePath}: AdminHomeProps) {
    const {data, error, isLoading} = useAdminRequest(() => client.getModels(), [client]);

    if (isLoading) {
        return <Typography sx={{p: 3}}>Загрузка моделей...</Typography>;
    }
    if (error || !data) {
        return <Alert severity="error">{error || 'Не удалось загрузить модели.'}</Alert>;
    }

    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <Paper sx={{p: 2.5, borderRadius: '10px', flexShrink: 0}}>
                <Typography variant="h4" sx={{fontWeight: 800}}>Админка</Typography>
                <Typography color="text.secondary">
                    Все подключённые модели доступны и в сайдбаре, и на этой стартовой странице.
                </Typography>
            </Paper>

            <Paper sx={{borderRadius: '10px', flex: 1, minHeight: 0, overflow: 'hidden'}}>
                <Box sx={{height: '100%', overflow: 'auto', p: 2}}>
                    <Grid container spacing={2}>
                        {data.items.map((model) => (
                            <Grid key={model.slug} size={{xs: 12, md: 6, xl: 4}}>
                                <Card sx={{borderRadius: '10px'}}>
                                    <Link href={`${basePath}/${model.slug}`} style={{textDecoration: 'none'}}>
                                        <CardActionArea>
                                            <CardContent>
                                                <Typography variant="h6" sx={{fontWeight: 700}}>
                                                    {model.title}
                                                </Typography>
                                                <Typography color="text.secondary">{model.slug}</Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </Link>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Paper>
        </Stack>
    );
}
