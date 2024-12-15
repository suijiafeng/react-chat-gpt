import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable app logo: 2×2 grid icon + optional name label.
 * Adapts automatically to light / dark theme.
 *
 * Props:
 *   showName {boolean} – render the app-name text beside the icon (default true)
 *   name     {string}  – override the label text
 *   size     {"sm"|"md"} – icon size preset (default "md")
 */
const AppLogo = ({ showName = true, name, size = 'md' }) => {
  const { isDark, classes } = useTheme();

  const iconSize   = size === 'sm' ? 'w-6 h-6 rounded-lg' : 'w-8 h-8 rounded-xl';
  const dotSize    = size === 'sm' ? 'w-1.5 h-1.5'        : 'w-2.5 h-2.5';
  const textSize   = size === 'sm' ? 'text-sm'             : 'text-base';

  // Icon colours per theme
  const iconBorder = isDark ? 'border-white/10'  : 'border-black/10';
  const iconBg     = isDark ? 'bg-white/5'        : 'bg-black/5';
  const dotBg      = isDark ? 'bg-white/80'       : 'bg-gray-700/80';

  return (
    <div className="flex items-center gap-3">
      <div className={`${iconSize} border ${iconBorder} ${iconBg} ${classes.themeTransition} flex items-center justify-center`}>
        <div className="grid grid-cols-2 gap-0.5">
          <span className={`block ${dotSize} ${dotBg} rounded-[2px]`} />
          <span className={`block ${dotSize} ${dotBg} rounded-[2px]`} />
          <span className={`block ${dotSize} ${dotBg} rounded-[2px]`} />
          <span className={`block ${dotSize} ${dotBg} rounded-[2px]`} />
        </div>
      </div>
      {showName && name && (
        <div className={`${textSize} font-semibold tracking-tight`}>{name}</div>
      )}
    </div>
  );
};

export default AppLogo;
