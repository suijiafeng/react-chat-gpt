import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable app logo: 2×2 grid icon + name label.
 * Adapts automatically to light / dark theme.
 */
const AppLogo = ({ name }) => {
  const { isDark, classes } = useTheme();

  // Icon colours per theme
  const iconBorder = isDark ? 'border-white/10' : 'border-black/10';
  const iconBg = isDark ? 'bg-white/5' : 'bg-black/5';
  const dotBg = isDark ? 'bg-white/80' : 'bg-gray-700/80';

  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-xl border ${iconBorder} ${iconBg} ${classes.themeTransition} flex items-center justify-center`}>
        <div className="grid grid-cols-2 gap-0.5">
          <span className={`block w-2.5 h-2.5 ${dotBg} rounded-[2px]`} />
          <span className={`block w-2.5 h-2.5 ${dotBg} rounded-[2px]`} />
          <span className={`block w-2.5 h-2.5 ${dotBg} rounded-[2px]`} />
          <span className={`block w-2.5 h-2.5 ${dotBg} rounded-[2px]`} />
        </div>
      </div>
      {name && <div className="text-base font-semibold tracking-tight">{name}</div>}
    </div>
  );
};

export default AppLogo;
