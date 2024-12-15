import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
const NotFound = () => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <div className={`flex items-center justify-center h-screen ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}`}>
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-xl mb-4">{t('pageNotFound')}</p>
        <Link to="/" className="text-blue-500 hover:text-blue-600">
          {t('backToHome')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;