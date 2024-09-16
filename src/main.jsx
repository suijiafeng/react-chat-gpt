import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from './contexts/ThemeContext';

import i18n from './locales/i18n.js';
import Routes from './appRoutes'
import './style/global.css'


createRoot(document.getElementById('root')).render(
  <I18nextProvider i18n={i18n}>
    <ThemeProvider>
        <Routes />
    </ThemeProvider>
  </I18nextProvider>
)
