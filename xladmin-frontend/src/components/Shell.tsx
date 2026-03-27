'use client';

import type {ReactNode} from 'react';
import {Box, CssBaseline, GlobalStyles, Stack} from '@mui/material';
import {ThemeProvider, type Theme} from '@mui/material/styles';
import type {XLAdminClient} from '../client';
import {AdminLocaleProvider} from '../i18n';
import type {AdminModelMeta, AdminModelsBlockMeta} from '../types';
import {defaultAdminTheme} from '../theme/defaultAdminTheme';
import {Main} from './layout/Main';
import {Sidebar} from './layout/Sidebar';

type AdminShellProps = {
    client: XLAdminClient;
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    basePath: string;
    locale?: string | null;
    children: ReactNode;
    theme?: Theme;
};

export type ShellProps = AdminShellProps;

export function Shell({client, models, blocks, basePath, locale, children, theme}: ShellProps) {
    void client;

    return (
        <ThemeProvider theme={theme ?? defaultAdminTheme}>
            <AdminLocaleProvider locale={locale}>
                <CssBaseline />
                <GlobalStyles
                    styles={(muiTheme) => ({
                        'html, body': {
                            backgroundColor: muiTheme.palette.background.default,
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
                            backgroundColor: muiTheme.palette.background.default,
                            backgroundImage: 'none',
                        },
                        '[data-xladmin-root="true"] .MuiAutocomplete-popper .MuiPaper-root, [data-xladmin-root="true"] .MuiMenu-paper, [data-xladmin-root="true"] .MuiPopover-paper, [data-xladmin-root="true"] .MuiPickersPopper-root .MuiPaper-root': {
                            backgroundImage: 'none',
                            backgroundColor: muiTheme.palette.background.paper,
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
                        backgroundColor: 'background.default',
                        backgroundImage: 'none',
                    }}
                >
                    <Stack
                        direction={{xs: 'column', lg: 'row'}}
                        spacing={0}
                        sx={{height: '100%', minHeight: 0, alignItems: 'stretch'}}
                    >
                        <Box
                            sx={{
                                width: {xs: '100%', lg: 320},
                                flexShrink: 0,
                                minHeight: 0,
                                py: 2,
                                pl: 0,
                                pr: {xs: 2, lg: 1},
                            }}
                        >
                            <Sidebar models={models} blocks={blocks} basePath={basePath} />
                        </Box>
                        <Box
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                px: 2,
                                py: 2,
                                pl: {xs: 2, lg: 1},
                            }}
                        >
                            <Main>{children}</Main>
                        </Box>
                    </Stack>
                </Box>
            </AdminLocaleProvider>
        </ThemeProvider>
    );
}

export const AdminShell = Shell;
