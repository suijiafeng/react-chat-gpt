import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
const NotFound = () => {
  const { classes } = useTheme();
  const { t } = useLanguage();

  return (
    <div className={`flex items-center justify-center h-screen px-6 ${classes.bg} ${classes.text}`}>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tabular-nums tracking-normal">404</h1>
        <p className={`mt-2 text-sm ${classes.mutedText}`}>{t('pageNotFound')}</p>
        <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">
          {t('backToHome')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;