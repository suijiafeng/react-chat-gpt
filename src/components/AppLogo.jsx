import { useTheme } from '../contexts/ThemeContext';

/**
 * 品牌标识：说话气泡 + 内部四角星。
 * 几何与 public/favicon.svg 一致。改这里请同步改那边。
 */
export const LogoMark = ({ size = 28, className = '' }) => {
  const { isDark } = useTheme();
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

const AppLogo = ({ name }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <LogoMark size={28} className="shrink-0" />
    {name && <div className="truncate text-base font-semibold tracking-normal">{name}</div>}
  </div>
);

export default AppLogo;
