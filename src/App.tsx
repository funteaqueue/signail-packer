import React, { useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import QuizForm from './components/QuizForm';
import { LanguageProvider } from './i18n/LanguageContext';
import { AppThemeProvider } from './theme/ThemeContext';
import './App.css';

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
    <AppThemeProvider>
      <CssBaseline />
      <LanguageProvider>
        <div className="App">
          <QuizForm />
        </div>
      </LanguageProvider>
    </AppThemeProvider>
  );
};

export default App;
