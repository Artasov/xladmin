'use client';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    ButtonBase,
    ListItemButton,
    ListItemText,
    Stack,
} from '@mui/material';
import type {NormalizedBlock} from './types';
import {BlockTitle} from './BlockTitle';
import {getBlockSurfaceSx} from './surface';
import {useBlockExpandedState} from './useBlockExpandedState';
import {NavLink} from '../NavLink';

type DashboardModelsBlockProps = {
    block: NormalizedBlock;
    basePath: string;
};

export function DashboardModelsBlock({block, basePath}: DashboardModelsBlockProps) {
    const [isExpanded, setIsExpanded] = useBlockExpandedState(block.slug, block.default_expanded);

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
                '&::before': {
                    display: 'none',
                },
            }}
        >
            <AccordionSummary
                expandIcon={block.collapsible ? <ExpandMoreIcon fontSize="small" /> : undefined}
                sx={{
                    minHeight: '48px',
                    pr: 1.75,
                    pl: 2,
                    pt: 0.4,
                    pb: 0.95,
                    backgroundColor: 'transparent',
                    '&.Mui-expanded': {
                        minHeight: '48px',
                        pt: 0.4,
                        pb: 0.95,
                    },
                    '& .MuiAccordionSummary-content': {
                        mt: 0.75,
                        mb: 1.05,
                    },
                    '& .MuiAccordionSummary-content.Mui-expanded': {
                        mt: 0.75,
                        mb: 1.05,
                    },
                }}
            >
                <BlockTitle block={block} />
            </AccordionSummary>
            <AccordionDetails sx={{px: 1.35, pb: 1.35, pt: 0}}>
                <Stack spacing={0.5} sx={{px: 0.4}}>
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
