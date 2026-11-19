import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';

const ThemeContext = createContext();

const FONT_FAMILY = '"SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif';

// 主色回到改版前的蓝：设置里的主按钮、选中态、链接和焦点都是 #2563eb。
// 页面底色仍是原来的 #f7f7f8 / #212121，不是后来的锌黑。
const buildAntdTheme = (isDark) => ({
  algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorLink: '#2563eb',
    colorTextLightSolid: '#FFFFFF',
    colorSuccess: '#059669',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    colorBgBase: isDark ? '#212121' : '#FFFFFF',
    colorBgContainer: isDark ? '#18181B' : '#FFFFFF',
    colorBgElevated: isDark ? '#222222' : '#FFFFFF',
    colorBorder: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
    colorText: isDark ? '#ECECEC' : '#1F1F1F',
    colorTextSecondary: isDark ? '#A1A1AA' : '#6B7280',
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
      primaryColor: '#FFFFFF',
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
    const page = isDark ? '#212121' : '#f7f7f8';
    localStorage.setItem('isDarkTheme', JSON.stringify(isDark));
    document.body.style.background = page;
    document.documentElement.style.background = page;
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--cursor-color', isDark ? '#fff' : '#1f1f1f');
    document.documentElement.style.setProperty('--page-bg', page);
    document.documentElement.style.setProperty('--ink', isDark ? '#ececec' : '#1f1f1f');
    document.documentElement.style.setProperty(
      '--scrollbar-thumb',
      isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)'
    );
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#3b82f6');
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
      bg: isDark ? 'bg-[#212121]' : 'bg-[#f7f7f8]',
      panel: isDark ? 'bg-[#171717]' : 'bg-white',
      text: isDark ? 'text-[#ececec]' : 'text-[#1f1f1f]',
      mutedText: isDark ? 'text-[#a1a1aa]' : 'text-[#6b7280]',
      buttonText: isDark ? 'text-gray-300' : 'text-gray-500',
      buttonHover: isDark ? 'hover:bg-white/5 hover:text-white' : 'hover:bg-black/5 hover:text-gray-700',
      input: isDark
        ? 'bg-[#2f2f2f] text-[#ececec] border-white/10 placeholder:text-[#8e8ea0]'
        : 'bg-white text-black border-gray-300 placeholder:text-gray-400',
      border: isDark ? 'border-white/10' : 'border-gray-200',
      divide: isDark ? 'divide-white/10' : 'divide-gray-200',
      menu: isDark
        ? 'border border-white/10 bg-[#222222] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        : 'border border-gray-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
      accentBtn: isDark
        ? 'bg-white text-[#212121] hover:bg-[#f4f4f5]'
        : 'bg-[#1f1f1f] text-white hover:bg-black',
      accentSoft: isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600',
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
