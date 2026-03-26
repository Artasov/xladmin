import {createTheme} from '@mui/material/styles';

/**
 * Дефолтная тема админки.
 *
 * Проект может заменить её своей темой через проп `theme` у `AdminShell`.
 */
export const defaultAdminTheme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#0a0a0b',
            paper: '#121214',
        },
    },
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: ({theme}) => ({
                    backgroundImage: 'none',
                    borderRadius: 10,
                    backgroundColor: theme.palette.background.paper,
                }),
            },
        },
        MuiCard: {
            styleOverrides: {
                root: ({theme}) => ({
                    backgroundImage: 'none',
                    borderRadius: 10,
                    backgroundColor: '#18181b',
                    border: `1px solid ${theme.palette.divider}`,
                }),
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: ({theme}) => ({
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.025)',
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '& .MuiListItemText-secondary': {
                        color: theme.palette.text.secondary,
                    },
                }),
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: ({theme}) => ({
                    borderRadius: 10,
                    backgroundImage: 'none',
                    backgroundColor: theme.palette.background.paper,
                }),
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    minHeight: 36,
                    fontSize: 14,
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiFormControl: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiButton: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: ({theme}) => ({
                    transition: theme.transitions.create(['border-color', 'box-shadow', 'background-color'], {
                        duration: theme.transitions.duration.shorter,
                    }),
                    '& .MuiOutlinedInput-notchedOutline': {
                        transition: theme.transitions.create(['border-color', 'box-shadow'], {
                            duration: theme.transitions.duration.shorter,
                        }),
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.28)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.42)',
                        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.08)',
                    },
                }),
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: ({theme}) => ({
                    transition: theme.transitions.create(['color', 'transform'], {
                        duration: theme.transitions.duration.shorter,
                    }),
                }),
            },
        },
        MuiTableCell: {
            styleOverrides: {
                stickyHeader: {
                    backgroundColor: '#171719',
                    backgroundImage: 'none',
                },
            },
        },
    },
});
