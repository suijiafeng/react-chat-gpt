import { useTheme } from '../contexts/ThemeContext';

/**
 * 品牌标识：单色对话气泡，两条短线表示正文。
 * 几何与 public/favicon.svg 一致。改这里请同步改那边。
 */
export const LogoMark = ({ size = 28, className = '' }) => {
  const { isDark } = useTheme();
  const ink = isDark ? '#FAFAFA' : '#18181B';
  const paper = isDark ? '#18181B' : '#FAFAFA';

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="logo"
    >
      <path
        fill={ink}
        d="M6 5h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H13.2L8 29.2V24H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z"
      />
      <path fill={paper} d="M9 12h14v1.6H9zM9 17h9v1.6H9z" />
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
