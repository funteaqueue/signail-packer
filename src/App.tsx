import React, { useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import PackForm from './components/PackForm';
import { LanguageProvider } from './i18n/LanguageContext';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8b5cf6',
      light: '#a78bfa',
      dark: '#7c3aed',
    },
    secondary: {
      main: '#ec4899',
      light: '#f472b6',
      dark: '#db2777',
    },
    background: {
      default: '#0a0e27',
      paper: 'rgba(19, 26, 54, 0.8)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a8b2d1',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    h4: {
      fontWeight: 700,
      background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #ec4899 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    h6: {
      fontWeight: 600,
      color: '#ffffff',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(19, 26, 54, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
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
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #ec4899 100%)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #db2777 100%)',
          },
          '&:disabled': {
            background: 'rgba(139, 92, 246, 0.3)',
            color: 'rgba(255, 255, 255, 0.5)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(19, 26, 54, 0.5)',
            '& fieldset': {
              borderColor: 'rgba(139, 92, 246, 0.3)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(139, 92, 246, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#8b5cf6',
              boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#a8b2d1',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#8b5cf6',
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
          color: '#a8b2d1',
          '&.Mui-active': {
            color: '#ffffff',
            fontWeight: 600,
          },
          '&.Mui-completed': {
            color: '#8b5cf6',
          },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: 'rgba(139, 92, 246, 0.3)',
          '&.Mui-active': {
            color: '#8b5cf6',
          },
          '&.Mui-completed': {
            color: '#ec4899',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#a8b2d1',
          transition: 'all 0.2s ease',
          '&:hover': {
            color: '#8b5cf6',
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
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(139, 92, 246, 0.2)',
        },
      },
    },
  },
});

const App: React.FC = () => {
  useEffect(() => {
    // Stop all media elements when the page loads
    const stopAllMedia = () => {
      const mediaElements = document.querySelectorAll('video, audio');
      mediaElements.forEach((media) => {
        if (media instanceof HTMLMediaElement) {
          media.pause();
          media.currentTime = 0;
        }
      });
    };

    // Stop media on initial load
    stopAllMedia();

    // Also stop media when the page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        stopAllMedia();
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', stopAllMedia);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
        <div className="App">
          <PackForm />
        </div>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;