'use client';

import {useState} from 'react';
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
import {NavLink} from '../NavLink';

type SidebarModelsBlockProps = {
    block: NormalizedBlock;
    basePath: string;
};

export function SidebarModelsBlock({block, basePath}: SidebarModelsBlockProps) {
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
            <Box sx={{px: 1.25, py: 1}}>
                <BlockTitle block={block} compact />
            </Box>
            <SidebarModelsList models={block.models} basePath={basePath} />
        </Paper>
    );
}

type SidebarModelsListProps = {
    models: Array<{slug: string; title: string}>;
    basePath: string;
};

function SidebarModelsList({models, basePath}: SidebarModelsListProps) {
    return (
        <List dense disablePadding sx={{display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.35}}>
            {models.map((model) => (
                <NavLink
                    key={model.slug}
                    href={`${basePath}/${model.slug}`}
                    style={{textDecoration: 'none', backgroundColor: '#ffffff0a'}}
                >
                    <ListItemButton sx={{borderRadius: '8px', px: 1.4}}>
                        <ListItemText primary={model.title} />
                    </ListItemButton>
                </NavLink>
            ))}
        </List>
    );
}
