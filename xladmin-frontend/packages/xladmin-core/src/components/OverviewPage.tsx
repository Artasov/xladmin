'use client';

import {useEffect, useMemo, useState} from 'react';
import {Alert, Box, Grid, Paper, Skeleton, Stack} from '@mui/material';
import type {XLAdminClient} from '../client';
import {useAdminDocumentTitle} from '../hooks/useAdminDocumentTitle';
import {useAdminTranslation} from '../i18n';
import type {AdminModelsResponse} from '../types';
import {useAdminData} from './layout/AdminDataContext';
import {ModelsBlocks} from './ModelsBlocks';
import {MainHeader, MainHeaderSkeleton} from './layout/MainHeader';

type AdminHomeProps = {
    client: XLAdminClient;
    basePath: string;
};

export type OverviewPageProps = AdminHomeProps;

let cachedModelsResponse: AdminModelsResponse | null = null;
let inFlightModelsRequest: Promise<AdminModelsResponse> | null = null;

export function OverviewPage({client, basePath}: OverviewPageProps) {
    const t = useAdminTranslation();
    useAdminDocumentTitle(t('admin_title'), t('overview_title'));
    const adminData = useAdminData();
    const shellModelsResponse = useMemo<AdminModelsResponse | null>(() => {
        if (adminData.models.length === 0 && adminData.blocks.length === 0) {
            return null;
        }
        return {
            locale: adminData.locale,
            items: adminData.models,
            blocks: adminData.blocks,
        };
    }, [adminData.blocks, adminData.locale, adminData.models]);
    const [data, setData] = useState<AdminModelsResponse | null>(shellModelsResponse ?? cachedModelsResponse);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(shellModelsResponse === null && cachedModelsResponse === null);

    useEffect(() => {
        let isMounted = true;

        if (shellModelsResponse !== null) {
            cachedModelsResponse = shellModelsResponse;
            setData(shellModelsResponse);
            setIsLoading(false);
            return () => {
                isMounted = false;
            };
        }

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
                if (!isMounted) return;
                setData(response);
            })
            .catch((reason: unknown) => {
                if (!isMounted) return;
                setError(reason instanceof Error ? reason.message : t('models_load_error'));
            })
            .finally(() => {
                if (inFlightModelsRequest === request) {
                    inFlightModelsRequest = null;
                }
                if (!isMounted) return;
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [client, shellModelsResponse, t]);

    if (isLoading && !data) {
        return <OverviewPageSkeleton />;
    }

    if (error || !data) {
        return <Alert severity="error">{error || t('models_load_error')}</Alert>;
    }

    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeader
                title={t('overview_title')}
                subtitle={t('overview_subtitle')}
            />

            <Paper
                sx={{
                    borderRadius: '10px',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box sx={{flex: 1, minHeight: 0, overflow: 'auto', p: 2}}>
                    <ModelsBlocks
                        models={data.items}
                        blocks={data.blocks}
                        basePath={basePath}
                        variant="dashboard"
                    />
                </Box>
            </Paper>
        </Stack>
    );
}

function OverviewPageSkeleton() {
    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeaderSkeleton titleWidth={220} subtitleWidth="58%" />

            <Paper
                sx={{
                    borderRadius: '10px',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box sx={{flex: 1, minHeight: 0, overflow: 'auto', p: 2}}>
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
