import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next';
import i18n from './locales/i18n.js';
import Layout from './components/Layout.jsx'
import './style/global.css'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <Layout />
    </I18nextProvider>
  </StrictMode>,
)
