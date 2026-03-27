'use client';

import {useEffect, useState} from 'react';
import {Alert, Box, Card, CardActionArea, CardContent, Grid, Paper, Skeleton, Stack, Typography} from '@mui/material';
import type {XLAdminClient} from '../client';
import type {AdminModelsResponse} from '../types';
import {AdminNavLink} from './AdminNavLink';
import {MainHeader, MainHeaderSkeleton} from './layout/MainHeader';

type AdminHomeProps = {
    client: XLAdminClient;
    basePath: string;
};

let cachedModelsResponse: AdminModelsResponse | null = null;
let inFlightModelsRequest: Promise<AdminModelsResponse> | null = null;

export function AdminHome({client, basePath}: AdminHomeProps) {
    const [data, setData] = useState<AdminModelsResponse | null>(cachedModelsResponse);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(cachedModelsResponse === null);

    useEffect(() => {
        let isMounted = true;

        if (cachedModelsResponse !== null) {
            setData(cachedModelsResponse);
            setIsLoading(false);
            return () => {
                isMounted = false;
            };
        }

        setIsLoading(true);
        setError(null);

        const request = inFlightModelsRequest ?? client.getModels();
        inFlightModelsRequest = request;

        request
            .then((response) => {
                cachedModelsResponse = response;
                if (!isMounted) {
                    return;
                }
                setData(response);
            })
            .catch((reason: unknown) => {
                if (!isMounted) {
                    return;
                }
                setError(reason instanceof Error ? reason.message : 'Не удалось загрузить модели.');
            })
            .finally(() => {
                if (inFlightModelsRequest === request) {
                    inFlightModelsRequest = null;
                }
                if (!isMounted) {
                    return;
                }
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [client]);

    if (isLoading && !data) {
        return <AdminHomeSkeleton />;
    }

    if (error || !data) {
        return <Alert severity="error">{error || 'Не удалось загрузить модели.'}</Alert>;
    }

    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeader
                title="Админка"
                subtitle="Все подключённые модели доступны и в сайдбаре, и на этой стартовой странице."
            />

            <Paper sx={{borderRadius: '10px', flex: 1, minHeight: 0, overflow: 'hidden'}}>
                <Box sx={{height: '100%', overflow: 'auto', p: 2}}>
                    <Grid container spacing={2}>
                        {data.items.map((model) => (
                            <Grid key={model.slug} size={{xs: 12, md: 6, xl: 4}}>
                                <Card sx={{borderRadius: '10px'}}>
                                    <AdminNavLink href={`${basePath}/${model.slug}`} style={{textDecoration: 'none'}}>
                                        <CardActionArea>
                                            <CardContent>
                                                <Typography variant="h6" sx={{fontWeight: 700}}>
                                                    {model.title}
                                                </Typography>
                                                <Typography color="text.secondary">{model.slug}</Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </AdminNavLink>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Paper>
        </Stack>
    );
}

function AdminHomeSkeleton() {
    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeaderSkeleton titleWidth={220} subtitleWidth="58%" />

            <Paper sx={{borderRadius: '10px', flex: 1, minHeight: 0, overflow: 'hidden'}}>
                <Box sx={{height: '100%', overflow: 'auto', p: 2}}>
                    <Grid container spacing={2}>
                        {Array.from({length: 8}).map((_, index) => (
                            <Grid key={index} size={{xs: 12, md: 6, xl: 4}}>
                                <Paper sx={{p: 2.5, borderRadius: '10px'}}>
                                    <Stack spacing={1}>
                                        <Skeleton variant="text" width="60%" height={36} />
                                        <Skeleton variant="text" width="40%" height={24} />
                                    </Stack>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Paper>
        </Stack>
    );
}
