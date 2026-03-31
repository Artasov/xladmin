'use client';

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
import {NavLink} from '../NavLink';

type SidebarModelsBlockProps = {
    block: NormalizedBlock;
    basePath: string;
    activeModelSlug: string | null;
    onModelNavigate?: (href: string) => void;
};

export function SidebarModelsBlock({block, basePath, activeModelSlug, onModelNavigate}: SidebarModelsBlockProps) {
    const [isExpanded, setIsExpanded] = useBlockExpandedState(block.slug, block.default_expanded);

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
                    '&::before': {
                        display: 'none',
                    },
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon fontSize="small" />}
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
                    <BlockTitle block={block} compact />
                </AccordionSummary>
                <AccordionDetails sx={{p: 0}}>
                    <SidebarModelsList
                        models={block.models}
                        basePath={basePath}
                        activeModelSlug={activeModelSlug}
                        onModelNavigate={onModelNavigate}
                    />
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
            <Box sx={{px: 1.25, py: 1}}>
                <BlockTitle block={block} compact />
            </Box>
            <SidebarModelsList
                models={block.models}
                basePath={basePath}
                activeModelSlug={activeModelSlug}
                onModelNavigate={onModelNavigate}
            />
        </Paper>
    );
}

type SidebarModelsListProps = {
    models: Array<{slug: string; title: string}>;
    basePath: string;
    activeModelSlug: string | null;
    onModelNavigate?: (href: string) => void;
};

function SidebarModelsList({models, basePath, activeModelSlug, onModelNavigate}: SidebarModelsListProps) {
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
                        <ListItemButton
                            selected={isActive}
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
                        <ListItemText primary={model.title} />
                        </ListItemButton>
                    </NavLink>
                );
            })}
        </List>
    );
}
