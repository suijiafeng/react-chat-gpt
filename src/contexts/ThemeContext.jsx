import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';

const ThemeContext = createContext();

const FONT_FAMILY = '"SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif';

// 浅色走干净的暖灰白，深色走中性锌黑。强调色只有墨色本身：
// 浅色主按钮是 zinc-900，深色主按钮反转为 zinc-100，文字用 colorTextLightSolid 压暗。
const buildAntdTheme = (isDark) => ({
  algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: isDark ? '#FAFAFA' : '#18181B',
    colorInfo: isDark ? '#FAFAFA' : '#18181B',
    colorLink: isDark ? '#FAFAFA' : '#18181B',
    colorTextLightSolid: isDark ? '#18181B' : '#FFFFFF',
    colorSuccess: '#059669',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    colorBgBase: isDark ? '#09090B' : '#FFFFFF',
    colorBgContainer: isDark ? '#18181B' : '#FFFFFF',
    colorBgElevated: isDark ? '#18181B' : '#FFFFFF',
    colorBorder: isDark ? 'rgba(255,255,255,0.08)' : '#E4E4E7',
    colorText: isDark ? '#FAFAFA' : '#18181B',
    colorTextSecondary: isDark ? '#A1A1AA' : '#71717A',
    borderRadius: 6,
    borderRadiusLG: 12,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    controlHeight: 36,
    wireframe: false,
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      primaryColor: isDark ? '#18181B' : '#FFFFFF',
    },
    Modal: {
      borderRadiusLG: 12,
    },
  },
});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('isDarkTheme');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  useEffect(() => {
    const page = isDark ? '#09090B' : '#FAFAFA';
    const ink = isDark ? '#FAFAFA' : '#18181B';
    localStorage.setItem('isDarkTheme', JSON.stringify(isDark));
    document.body.style.background = page;
    document.documentElement.style.background = page;
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--cursor-color', ink);
    document.documentElement.style.setProperty('--page-bg', page);
    document.documentElement.style.setProperty('--ink', ink);
    document.documentElement.style.setProperty(
      '--scrollbar-thumb',
      isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'
    );
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', page);
    ConfigProvider.config({ theme: buildAntdTheme(isDark) });
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const theme = useMemo(() => ({
    isDark,
    toggleTheme,
    classes: {
      themeTransition: 'transition-[background-color,border-color,color,fill,stroke] duration-150 ease-out',
      bg: isDark ? 'bg-[#09090B]' : 'bg-[#FAFAFA]',
      panel: isDark ? 'bg-[#18181B]' : 'bg-white',
      text: isDark ? 'text-zinc-100' : 'text-zinc-900',
      mutedText: isDark ? 'text-zinc-400' : 'text-zinc-500',
      buttonText: isDark ? 'text-zinc-400' : 'text-zinc-500',
      buttonHover: isDark ? 'hover:bg-white/[0.06] hover:text-zinc-100' : 'hover:bg-zinc-100/80 hover:text-zinc-800',
      input: isDark
        ? 'bg-[#09090B] text-zinc-100 border-white/[0.08] placeholder:text-zinc-500'
        : 'bg-white text-zinc-900 border-zinc-200 placeholder:text-zinc-400',
      border: isDark ? 'border-white/[0.08]' : 'border-zinc-200/80',
      divide: isDark ? 'divide-white/[0.08]' : 'divide-zinc-200/70',
      menu: isDark
        ? 'border border-white/[0.08] bg-[#18181B] shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
        : 'border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
      accentBtn: isDark
        ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
        : 'bg-zinc-900 text-white hover:bg-zinc-800',
      accentSoft: isDark ? 'bg-white/[0.08] text-zinc-100' : 'bg-zinc-100 text-zinc-900',
    },
  }), [isDark]);

  const antdThemeConfig = useMemo(() => buildAntdTheme(isDark), [isDark]);

  return (
    <ThemeContext.Provider value={theme}>
      <ConfigProvider theme={antdThemeConfig}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
