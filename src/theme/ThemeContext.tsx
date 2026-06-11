import React, { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { applyTheme, getTheme, DEFAULT_THEME } from './themes';
import { buildMuiTheme } from './muiTheme';

interface ThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME,
  setThemeId: () => undefined,
});

// Owns the selected design: keeps <html data-theme> + localStorage in sync
// (which drives the CSS variables) and rebuilds the MUI palette so Material
// components follow along.
export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<string>(() => getTheme());
  const muiTheme = useMemo(() => buildMuiTheme(themeId), [themeId]);

  const setThemeId = (id: string) => setThemeIdState(applyTheme(id));

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextValue => useContext(ThemeContext);
