'use client';

import {memo, useMemo, useState} from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    ButtonBase,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {useAdminTranslation} from '../i18n';
import type {AdminModelMeta, AdminModelsBlockMeta} from '../types';
import {NavLink} from './NavLink';

type AdminModelsBlocksProps = {
    basePath: string;
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    variant: 'sidebar' | 'dashboard';
};

export type ModelsBlocksProps = AdminModelsBlocksProps;

type NormalizedBlock = {
    slug: string;
    title: string;
    description?: string | null;
    color?: string | null;
    collapsible: boolean;
    default_expanded: boolean;
    models: AdminModelMeta[];
    isAllModels?: boolean;
};

export const ModelsBlocks = memo(function ModelsBlocks({
    basePath,
    models,
    blocks,
    variant,
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
                    <SidebarModelsBlock key={block.slug} block={block} basePath={basePath} />
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

export const AdminModelsBlocks = ModelsBlocks;

type SidebarModelsBlockProps = {
    block: NormalizedBlock;
    basePath: string;
};

function SidebarModelsBlock({block, basePath}: SidebarModelsBlockProps) {
    const [isExpanded, setIsExpanded] = useState(block.default_expanded);

    if (block.collapsible) {
        return (
            <Accordion
                expanded={isExpanded}
                onChange={(_, expanded) => setIsExpanded(expanded)}
                disableGutters
                elevation={0}
                sx={{
                    ...getBlockSurfaceSx(block, 'sidebar'),
                    borderRadius: '8px',
                    overflow: 'hidden',
                    '&::before': {display: 'none'},
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon fontSize="small" />}
                    sx={{
                        minHeight: '42px',
                        pr: 1.25,
                        pl: 1.85,
                        backgroundColor: 'transparent',
                        '&.Mui-expanded': {minHeight: '42px'},
                        '& .MuiAccordionSummary-content': {my: 0},
                        '& .MuiAccordionSummary-content.Mui-expanded': {my: 0},
                    }}
                >
                    <BlockTitle block={block} compact />
                </AccordionSummary>
                <AccordionDetails sx={{p: 0}}>
                    <SidebarModelsList models={block.models} basePath={basePath} />
                </AccordionDetails>
            </Accordion>
        );
    }

    return (
        <Paper
            sx={{
                ...getBlockSurfaceSx(block, 'sidebar'),
                borderRadius: '8px',
                overflow: 'hidden',
            }}
        >
            <Box sx={{px: 1.6, py: 1}}>
                <BlockTitle block={block} compact />
            </Box>
            <SidebarModelsList models={block.models} basePath={basePath} />
        </Paper>
    );
}

type SidebarModelsListProps = {
    models: AdminModelMeta[];
    basePath: string;
};

function SidebarModelsList({models, basePath}: SidebarModelsListProps) {
    return (
        <List dense disablePadding sx={{display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.6}}>
            {models.map((model) => (
                <NavLink
                    key={model.slug}
                    href={`${basePath}/${model.slug}`}
                    style={{textDecoration: 'none', backgroundColor: '#ffffff0a'}}
                >
                    <ListItemButton sx={{borderRadius: '8px', px: 1.55}}>
                        <ListItemText primary={model.title} />
                    </ListItemButton>
                </NavLink>
            ))}
        </List>
    );
}

type DashboardModelsBlockProps = {
    block: NormalizedBlock;
    basePath: string;
};

function DashboardModelsBlock({block, basePath}: DashboardModelsBlockProps) {
    const [isExpanded, setIsExpanded] = useState(block.default_expanded);

    return (
        <Accordion
            expanded={block.collapsible ? isExpanded : true}
            onChange={block.collapsible ? (_, expanded) => setIsExpanded(expanded) : undefined}
            disableGutters
            elevation={0}
            sx={{
                ...getBlockSurfaceSx(block, 'dashboard'),
                borderRadius: '10px',
                overflow: 'hidden',
                '&::before': {display: 'none'},
            }}
        >
            <AccordionSummary
                expandIcon={block.collapsible ? <ExpandMoreIcon fontSize="small" /> : undefined}
                sx={{
                    minHeight: '48px',
                    pr: 1.75,
                    pl: 2.25,
                    pt: 0.4,
                    pb: 0.82,
                    backgroundColor: 'transparent',
                    '&.Mui-expanded': {
                        minHeight: '48px',
                        pt: 0.4,
                        pb: 0.82,
                    },
                    '& .MuiAccordionSummary-content': {
                        mt: 0.75,
                        mb: 0.72,
                    },
                    '& .MuiAccordionSummary-content.Mui-expanded': {
                        mt: 0.75,
                        mb: 0.72,
                    },
                }}
            >
                <BlockTitle block={block} />
            </AccordionSummary>
            <AccordionDetails sx={{px: 1.55, pb: 1.35, pt: 0}}>
                <Stack spacing={0.5} sx={{px: 0.55}}>
                    {block.models.map((model) => (
                        <NavLink key={model.slug} href={`${basePath}/${model.slug}`} style={{textDecoration: 'none', display: 'block'}}>
                            <ButtonBase
                                sx={{
                                    width: '100%',
                                    textAlign: 'left',
                                    display: 'block',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                }}
                            >
                                <ListItemButton
                                    sx={{
                                        borderRadius: '8px',
                                        minHeight: 42,
                                        px: 1.25,
                                        py: 0.4,
                                    }}
                                >
                                    <ListItemText primary={model.title} />
                                </ListItemButton>
                            </ButtonBase>
                        </NavLink>
                    ))}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}

type BlockTitleProps = {
    block: NormalizedBlock;
    compact?: boolean;
};

function BlockTitle({block, compact = false}: BlockTitleProps) {
    return (
        <Stack spacing={0.25}>
            <Typography
                variant={compact ? 'subtitle1' : 'h6'}
                sx={{
                    fontWeight: 700,
                    fontSize: compact ? '1rem' : undefined,
                    lineHeight: compact ? 1.2 : undefined,
                }}
            >
                {block.title}
            </Typography>
            {block.description && !compact ? (
                <Typography color="text.secondary" sx={{fontSize: compact ? 12 : 14, lineHeight: 1.3}}>
                    {block.description}
                </Typography>
            ) : null}
        </Stack>
    );
}

function getBlockSurfaceSx(block: NormalizedBlock, variant: 'sidebar' | 'dashboard') {
    const neutralGradient = 'linear-gradient(180deg, rgba(255, 255, 255, 0.024) 0%, rgba(255, 255, 255, 0.018) 58%, rgba(255, 255, 255, 0.014) 100%)';
    const neutralSidebarColor = 'rgba(255, 255, 255, 0.018)';

    if (!block.color) {
        if (variant === 'sidebar') {
            return {backgroundColor: neutralSidebarColor};
        }

        return {
            backgroundColor: 'rgba(255, 255, 255, 0.008)',
            backgroundImage: neutralGradient,
        };
    }

    if (variant === 'sidebar') {
        return {backgroundColor: block.color};
    }

    return {
        backgroundColor: 'rgba(255, 255, 255, 0.008)',
        backgroundImage: `linear-gradient(180deg, ${block.color} 0%, color-mix(in srgb, ${block.color} 50%, transparent) 100%)`,
    };
}

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
