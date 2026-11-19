import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
const NotFound = () => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <div className={`flex items-center justify-center h-screen px-6 ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}`}>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tabular-nums tracking-normal">404</h1>
        <p className="mt-2 text-sm text-gray-500">{t('pageNotFound')}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-500 underline underline-offset-4 hover:text-blue-600">
          {t('backToHome')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;