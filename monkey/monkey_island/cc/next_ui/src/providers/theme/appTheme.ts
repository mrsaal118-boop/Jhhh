import { Roboto } from 'next/font/google';
import { createTheme, ThemeOptions } from '@mui/material/styles';

export enum THEME_APPEARANCE {
    DARK_MODE = 'dark',
    LIGHT_MODE = 'light'
}

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'swap'
});

const themeOptions: ThemeOptions = {
    palette: {
        mode: THEME_APPEARANCE.DARK_MODE,
        primary: {
            main: '#00E676',
            light: '#66FF99',
            dark: '#00C853'
        },
        secondary: {
            main: '#7C4DFF',
            light: '#B388FF',
            dark: '#651FFF'
        },
        background: {
            default: '#0A0E17',
            paper: '#111827'
        },
        error: {
            main: '#FF5252'
        },
        warning: {
            main: '#FFB74D'
        },
        info: {
            main: '#40C4FF'
        },
        success: {
            main: '#00E676'
        },
        text: {
            primary: '#E0E0E0',
            secondary: '#9E9E9E'
        },
        divider: 'rgba(255, 255, 255, 0.08)'
    },
    typography: {
        fontFamily: roboto.style.fontFamily,
        h4: {
            fontWeight: 700,
            letterSpacing: '0.02em'
        },
        h5: {
            fontWeight: 600
        },
        h6: {
            fontWeight: 600
        },
        subtitle1: {
            fontWeight: 500
        },
        body2: {
            color: '#9E9E9E'
        }
    },
    shape: {
        borderRadius: 12
    },
    components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    transition: 'border-color 0.2s ease-in-out',
                    '&:hover': {
                        borderColor: 'rgba(0, 230, 118, 0.3)'
                    }
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 8,
                    padding: '8px 20px'
                },
                contained: {
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 230, 118, 0.3)'
                    }
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500
                }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none'
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    marginBottom: 2,
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 230, 118, 0.12)',
                        '&:hover': {
                            backgroundColor: 'rgba(0, 230, 118, 0.18)'
                        }
                    }
                }
            }
        }
    }
};

const appTheme = createTheme(themeOptions);

export default appTheme;
