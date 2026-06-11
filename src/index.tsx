import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initTheme } from './theme/themes';

// Apply the saved design before the first paint to avoid a theme flash
initTheme();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

export {}; 