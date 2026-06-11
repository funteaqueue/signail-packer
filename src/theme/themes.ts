// Player-selectable visual designs. Mirrors the game app: same six themes,
// same ids and order, same localStorage key, applied as <html data-theme="...">
// so the CSS variable blocks in index.css take effect.
export interface ThemeOption {
  id: string;
  name: string;
}

export const THEMES: ThemeOption[] = [
  { id: 'party', name: 'Party Mix' },
  { id: 'neon', name: 'Neon Arcade' },
  { id: 'tidepool', name: 'Tide Pool' },
  { id: 'cardtable', name: 'Card Table' },
  { id: 'royal', name: 'Royal Court' },
  { id: 'daylight', name: 'Daylight' },
];

export const DEFAULT_THEME = 'party';

const STORAGE_KEY = 'theme';

export const getTheme = (): string => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && THEMES.some((t) => t.id === stored) ? stored : DEFAULT_THEME;
};

export const applyTheme = (id: string): string => {
  const theme = THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  return theme;
};

// Called before the first render so there is no flash of the default theme
export const initTheme = (): void => {
  document.documentElement.dataset.theme = getTheme();
};
