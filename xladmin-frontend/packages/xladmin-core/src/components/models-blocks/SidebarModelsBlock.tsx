'use client';

import {useEffect} from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    List,
    ListItemButton,
    ListItemText,
    Paper,
} from '@mui/material';
import type {NormalizedBlock} from './types';
import {BlockTitle} from './BlockTitle';
import {getBlockSurfaceSx} from './surface';
import {useBlockExpandedState} from './useBlockExpandedState';
import {NavLink} from '@xladmin-core/components/NavLink';

type SidebarModelsBlockProps = {
    block: NormalizedBlock;
    basePath: string;
    activeModelSlug: string | null;
    onModelNavigate?: (href: string) => void;
};

export function SidebarModelsBlock({block, basePath, activeModelSlug, onModelNavigate}: SidebarModelsBlockProps) {
    const [isExpanded, setIsExpanded] = useBlockExpandedState(block.slug, block.default_expanded);
    const hasActiveModel = block.models.some((model) => model.slug === activeModelSlug);

    useEffect(() => {
        if (hasActiveModel && !isExpanded) {
            setIsExpanded(true);
        }
    }, [hasActiveModel, isExpanded, setIsExpanded]);

    if (block.collapsible) {
        return (
            <Accordion
                expanded={isExpanded}
                onChange={(_, expanded) => setIsExpanded(expanded)}
                disableGutters
                elevation={0}
                data-xladmin-active-block={hasActiveModel ? 'true' : undefined}
                data-xladmin-block-origin={block.isAllModels ? 'all-models' : 'block'}
                sx={{
                    ...getBlockSurfaceSx(block, 'sidebar'),
                    borderRadius: '8px',
                    overflow: 'hidden',
                    '&::before': {
                        display: 'none',
                    },
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon fontSize="small"/>}
                    sx={{
                        minHeight: '42px',
                        pr: 1.25,
                        pl: 1.5,
                        backgroundColor: 'transparent',
                        '&.Mui-expanded': {
                            minHeight: '42px',
                        },
                        '& .MuiAccordionSummary-content': {
                            my: 0,
                        },
                        '& .MuiAccordionSummary-content.Mui-expanded': {
                            my: 0,
                        },
                    }}
                >
                    <BlockTitle block={block} compact/>
                </AccordionSummary>
                <AccordionDetails sx={{p: 0}}>
                    <SidebarModelsList
                        models={block.models}
                        basePath={basePath}
                        activeModelSlug={activeModelSlug}
                        modelOrigin={block.isAllModels ? 'all-models' : 'block'}
                        onModelNavigate={onModelNavigate}
                    />
                </AccordionDetails>
            </Accordion>
        );
    }

    return (
        <Paper
            data-xladmin-active-block={hasActiveModel ? 'true' : undefined}
            data-xladmin-block-origin={block.isAllModels ? 'all-models' : 'block'}
            sx={{
                ...getBlockSurfaceSx(block, 'sidebar'),
                borderRadius: '8px',
                overflow: 'hidden',
            }}
        >
            <Box sx={{px: 1.25, py: 1}}>
                <BlockTitle block={block} compact/>
            </Box>
            <SidebarModelsList
                models={block.models}
                basePath={basePath}
                activeModelSlug={activeModelSlug}
                modelOrigin={block.isAllModels ? 'all-models' : 'block'}
                onModelNavigate={onModelNavigate}
            />
        </Paper>
    );
}

type SidebarModelsListProps = {
    models: Array<{ slug: string; title: string }>;
    basePath: string;
    activeModelSlug: string | null;
    modelOrigin: 'block' | 'all-models';
    onModelNavigate?: (href: string) => void;
};

function SidebarModelsList({models, basePath, activeModelSlug, modelOrigin, onModelNavigate}: SidebarModelsListProps) {
    return (
        <List dense disablePadding sx={{display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.35}}>
            {models.map((model) => {
                const href = `${basePath}/${model.slug}`;
                const isActive = activeModelSlug === model.slug;

                return (
                    <NavLink
                        key={model.slug}
                        href={href}
                        style={{textDecoration: 'none', display: 'block'}}
                        onClick={() => onModelNavigate?.(href)}
                    >
                        <SidebarModelListItem title={model.title} isActive={isActive} modelOrigin={modelOrigin}/>
                    </NavLink>
                );
            })}
        </List>
    );
}

type SidebarModelListItemProps = {
    title: string;
    isActive: boolean;
    modelOrigin: 'block' | 'all-models';
};

function SidebarModelListItem({title, isActive, modelOrigin}: SidebarModelListItemProps) {
    return (
        <ListItemButton
            selected={isActive}
            data-xladmin-active-model={isActive ? 'true' : undefined}
            data-xladmin-model-origin={isActive ? modelOrigin : undefined}
            sx={{
                borderRadius: '8px',
                px: 1.4,
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)' : 'none',
                '&:hover': {
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                },
                '&.Mui-selected': {
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                },
                '&.Mui-selected:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
            }}
        >
            <ListItemText primary={title}/>
        </ListItemButton>
    );
}
