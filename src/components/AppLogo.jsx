import { useTheme } from '../contexts/ThemeContext';

/**
 * 品牌标识：说话气泡 + 内部四角星（AI spark）。
 * 几何与 public/favicon.svg 完全一致——改这里请同步改那边，
 * 否则站内 logo 会和浏览器标签页图标长得不一样。
 */
export const LogoMark = ({ size = 32, className = '' }) => {
  const { isDark } = useTheme();
  // 暗色下用 indigo-500，深底上比 indigo-600 更透气
  const ink = isDark ? '#6366f1' : '#4f46e5';

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="logo"
    >
      <g fill={ink}>
        <rect x="1.5" y="2.5" width="29" height="21.5" rx="7.5" />
        <polygon points="9,18 9,29 18.5,22.5" />
      </g>
      <path
        fill="#fff"
        d="M16 6.5 q1.92 5.18 7.40 7.00 q-5.48 1.82 -7.40 7.00 q-1.92 -5.18 -7.40 -7.00 q5.48 -1.82 7.40 -7.00Z"
      />
    </svg>
  );
};

/**
 * Reusable app logo: brand mark + name label.
 * Adapts automatically to light / dark theme.
 */
const AppLogo = ({ name }) => (
  <div className="flex items-center gap-3">
    <LogoMark size={32} />
    {name && <div className="text-lg font-semibold tracking-tight">{name}</div>}
  </div>
);

export default AppLogo;
