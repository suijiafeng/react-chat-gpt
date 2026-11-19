import { useTheme } from '../contexts/ThemeContext';

const LoadingSpinner = () => {
  const { isDark, classes } = useTheme();

  return (
    <div className={`flex h-screen items-center justify-center ${classes.bg}`}>
      <div
        className={`h-5 w-5 animate-spin rounded-full border-2 ${
          isDark ? 'border-white/15 border-t-[#ececec]' : 'border-gray-200 border-t-gray-900'
        }`}
      />
    </div>
  );
};

export default LoadingSpinner;
