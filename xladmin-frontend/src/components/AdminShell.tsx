'use client';

import type {ReactNode} from 'react';
import {Box, CssBaseline, GlobalStyles, Stack} from '@mui/material';
import {ThemeProvider, type Theme} from '@mui/material/styles';
import type {XLAdminClient} from '../client';
import type {AdminModelMeta} from '../types';
import {defaultAdminTheme} from '../theme/defaultAdminTheme';
import {Main} from './layout/Main';
import {Sidebar} from './layout/Sidebar';

type AdminShellProps = {
    client: XLAdminClient;
    models: AdminModelMeta[];
    basePath: string;
    children: ReactNode;
    /** Передайте свою MUI theme сюда, если хотите переопределить дефолтную тему библиотеки. */
    theme?: Theme;
};

export function AdminShell({client, models, basePath, children, theme}: AdminShellProps) {
    void client;

    return (
        <ThemeProvider theme={theme ?? defaultAdminTheme}>
            <CssBaseline/>
            <GlobalStyles
                styles={(theme) => ({
                    'html, body': {
                        backgroundColor: theme.palette.background.default,
                        backgroundImage: 'none',
                    },
                    '*': {
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#2b2b2f transparent',
                    },
                    '*::-webkit-scrollbar': {
                        width: '3px',
                        height: '3px',
                    },
                    '*::-webkit-scrollbar-track': {
                        background: 'transparent',
                    },
                    '*::-webkit-scrollbar-thumb': {
                        backgroundColor: '#2b2b2f',
                        borderRadius: '999px',
                    },
                    '[data-xladmin-root="true"]': {
                        backgroundColor: theme.palette.background.default,
                        backgroundImage: 'none',
                    },
                    '[data-xladmin-root="true"] .MuiAutocomplete-popper .MuiPaper-root, [data-xladmin-root="true"] .MuiMenu-paper, [data-xladmin-root="true"] .MuiPopover-paper, [data-xladmin-root="true"] .MuiPickersPopper-root .MuiPaper-root': {
                        backgroundImage: 'none',
                        backgroundColor: theme.palette.background.paper,
                        borderRadius: '10px',
                    },
                    '[data-xladmin-root="true"] .MuiMenuItem-root': {
                        minHeight: '36px',
                        fontSize: '14px',
                    },
                })}
            />
            <Box
                data-xladmin-root="true"
                sx={{
                    height: '100dvh',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    p: 2,
                    backgroundColor: 'background.default',
                    backgroundImage: 'none',
                }}
            >
                <Stack
                    direction={{xs: 'column', lg: 'row'}}
                    spacing={2}
                    sx={{height: '100%', minHeight: 0, alignItems: 'stretch'}}
                >
                    <Box sx={{width: {xs: '100%', lg: 320}, flexShrink: 0, minHeight: 0}}>
                        <Sidebar models={models} basePath={basePath}/>
                    </Box>
                    <Main>{children}</Main>
                </Stack>
            </Box>
        </ThemeProvider>
    );
}
