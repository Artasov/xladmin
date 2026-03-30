'use client';

import {memo, useMemo} from 'react';
import {Box, Stack, useMediaQuery, useTheme} from '@mui/material';
import {useAdminTranslation} from '../i18n';
import type {AdminModelMeta, AdminModelsBlockMeta} from '../types';
import {DashboardModelsBlock} from './models-blocks/DashboardModelsBlock';
import {SidebarModelsBlock} from './models-blocks/SidebarModelsBlock';
import type {ActiveModelSlug, NormalizedBlock} from './models-blocks/types';

type AdminModelsBlocksProps = {
    basePath: string;
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    variant: 'sidebar' | 'dashboard';
    activeModelSlug?: ActiveModelSlug;
};

export type ModelsBlocksProps = AdminModelsBlocksProps;

export const ModelsBlocks = memo(function ModelsBlocks({
    basePath,
    models,
    blocks,
    variant,
    activeModelSlug = null,
}: ModelsBlocksProps) {
    const t = useAdminTranslation();
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
    const isXlUp = useMediaQuery(theme.breakpoints.up('xl'));

    const normalizedBlocks = useMemo<NormalizedBlock[]>(() => ([
        ...blocks,
        {
            slug: 'all-models',
            title: t('all_models'),
            description: variant === 'dashboard' ? t('all_models_description') : null,
            color: null,
            collapsible: false,
            default_expanded: true,
            models,
            isAllModels: true,
        },
    ]), [blocks, models, t, variant]);

    const dashboardColumns = useMemo(() => {
        const columnCount = isXlUp ? 3 : isMdUp ? 2 : 1;
        return distributeBlocksByHeight(normalizedBlocks, columnCount);
    }, [isMdUp, isXlUp, normalizedBlocks]);

    if (variant === 'sidebar') {
        return (
            <Stack spacing={1}>
                {normalizedBlocks.map((block) => (
                    <SidebarModelsBlock
                        key={block.slug}
                        block={block}
                        basePath={basePath}
                        activeModelSlug={activeModelSlug}
                    />
                ))}
            </Stack>
        );
    }

    return (
        <Box sx={{display: 'flex', gap: 2, alignItems: 'flex-start'}}>
            {dashboardColumns.map((column, columnIndex) => (
                <Box key={columnIndex} sx={{flex: 1, minWidth: 0}}>
                    <Stack spacing={2}>
                        {column.map((block) => (
                            <DashboardModelsBlock key={block.slug} block={block} basePath={basePath} />
                        ))}
                    </Stack>
                </Box>
            ))}
        </Box>
    );
});

function distributeBlocksByHeight(blocks: NormalizedBlock[], columnCount: number) {
    const columns: NormalizedBlock[][] = Array.from({length: columnCount}, () => []);
    const columnWeights = Array.from({length: columnCount}, () => 0);

    for (const block of blocks) {
        let targetColumnIndex = 0;

        for (let index = 1; index < columnCount; index += 1) {
            if (columnWeights[index] < columnWeights[targetColumnIndex]) {
                targetColumnIndex = index;
            }
        }

        columns[targetColumnIndex].push(block);
        columnWeights[targetColumnIndex] += getBlockWeight(block);
    }

    return columns;
}

function getBlockWeight(block: NormalizedBlock) {
    return 3 + block.models.length + (block.description ? 1 : 0);
}
