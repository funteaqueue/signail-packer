import { createTheme, Theme } from '@mui/material';
import { DEFAULT_THEME } from './themes';

// MUI needs real color values at theme-creation time: palette colors feed
// derived states (ripples, hover tints, disabled shades) that cannot be
// computed from CSS variables. Component overrides below reference the CSS
// variables from index.css instead, so they follow <html data-theme> without
// a React re-render.
interface PaletteTokens {
  mode: 'dark' | 'light';
  primary: string;
  primaryLight: string;
  onPrimary: string;
  secondary: string;
  error: string;
  bgDefault: string;
  bgPaper: string;
  textPrimary: string;
  textSecondary: string;
}

const PALETTES: Record<string, PaletteTokens> = {
  party: {
    mode: 'dark',
    primary: '#2d7ff0',
    primaryLight: '#4f93f5',
    onPrimary: '#ffffff',
    secondary: '#e8485c',
    error: '#ff5470',
    bgDefault: '#14161e',
    bgPaper: 'rgba(30, 34, 46, 0.8)',
    textPrimary: '#f2f4f8',
    textSecondary: '#9aa3b2',
  },
  neon: {
    mode: 'dark',
    primary: '#8c6cff',
    primaryLight: '#a285ff',
    onPrimary: '#ffffff',
    secondary: '#ff4fd8',
    error: '#ff5470',
    bgDefault: '#0e0a23',
    bgPaper: 'rgba(28, 21, 62, 0.8)',
    textPrimary: '#f7f6ff',
    textSecondary: '#aaa3d4',
  },
  tidepool: {
    mode: 'dark',
    primary: '#f2d6a0',
    primaryLight: '#f8e3bd',
    onPrimary: '#2e2008',
    secondary: '#ff6b4a',
    error: '#ff5470',
    bgDefault: '#0a2228',
    bgPaper: 'rgba(13, 42, 49, 0.8)',
    textPrimary: '#eff7f4',
    textSecondary: '#8fb8bd',
  },
  cardtable: {
    mode: 'dark',
    primary: '#e9b53c',
    primaryLight: '#f3c45a',
    onPrimary: '#241803',
    secondary: '#e0532f',
    error: '#ff5470',
    bgDefault: '#0b2018',
    bgPaper: 'rgba(17, 42, 30, 0.8)',
    textPrimary: '#f2ebd4',
    textSecondary: '#a7bfa9',
  },
  royal: {
    mode: 'dark',
    primary: '#f5b62e',
    primaryLight: '#f8c452',
    onPrimary: '#2a1b00',
    secondary: '#2e63e7',
    error: '#ff5470',
    bgDefault: '#0a1228',
    bgPaper: 'rgba(18, 30, 58, 0.8)',
    textPrimary: '#f8f7f2',
    textSecondary: '#b8c6e8',
  },
  daylight: {
    mode: 'light',
    primary: '#3d6bf5',
    primaryLight: '#5d83f7',
    onPrimary: '#ffffff',
    secondary: '#f0454f',
    error: '#d22b44',
    bgDefault: '#faf5ea',
    bgPaper: 'rgba(255, 255, 255, 0.9)',
    textPrimary: '#20263b',
    textSecondary: '#6e7894',
  },
};

export const buildMuiTheme = (themeId: string): Theme => {
  const p = PALETTES[themeId] || PALETTES[DEFAULT_THEME];
  return createTheme({
    palette: {
      mode: p.mode,
      primary: { main: p.primary, light: p.primaryLight, contrastText: p.onPrimary },
      secondary: { main: p.secondary },
      error: { main: p.error },
      background: { default: p.bgDefault, paper: p.bgPaper },
      text: { primary: p.textPrimary, secondary: p.textSecondary },
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
      h4: {
        fontWeight: 700,
        background: 'var(--grad-text)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      },
      h6: {
        fontWeight: 600,
        color: 'var(--text-primary)',
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      // The aurora backdrop lives on body::before (index.css); a solid body
      // background from CssBaseline would paint over it
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: 'transparent' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '12px',
            padding: '10px 24px',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 0 20px var(--primary-glow)',
            },
          },
          contained: {
            background: 'var(--grad-primary)',
            color: 'var(--btn-primary-text)',
            boxShadow: '0 4px 14px var(--btn-shadow)',
            '&:hover': {
              background: 'var(--grad-primary)',
              filter: 'brightness(1.07)',
            },
            '&.Mui-disabled': {
              background: 'var(--surface-soft)',
              color: 'var(--text-muted)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'var(--input-bg)',
              '& fieldset': {
                borderColor: 'var(--glass-border)',
              },
              '&:hover fieldset': {
                borderColor: 'var(--hover-border)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'var(--primary)',
                boxShadow: '0 0 10px var(--ring)',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'var(--text-secondary)',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: 'var(--primary)',
            },
          },
        },
      },
      MuiStepper: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
          },
        },
      },
      MuiStepLabel: {
        styleOverrides: {
          label: {
            color: 'var(--text-secondary)',
            '&.Mui-active': {
              color: 'var(--text-primary)',
              fontWeight: 600,
            },
            '&.Mui-completed': {
              color: 'var(--primary)',
            },
          },
        },
      },
      MuiStepIcon: {
        styleOverrides: {
          root: {
            color: 'var(--track)',
            '&.Mui-active': {
              color: 'var(--primary)',
              '& .MuiStepIcon-text': {
                fill: 'var(--on-primary)',
              },
            },
            '&.Mui-completed': {
              color: 'var(--secondary)',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: 'var(--text-secondary)',
            transition: 'all 0.2s ease',
            '&:hover': {
              color: 'var(--primary)',
              transform: 'scale(1.1)',
            },
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            marginBottom: '8px',
            '&:hover': {
              backgroundColor: 'var(--surface-soft)',
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: 'var(--glass-border)',
          },
        },
      },
    },
  });
};
