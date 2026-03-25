import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('isDarkTheme');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  useEffect(() => {
    localStorage.setItem('isDarkTheme', JSON.stringify(isDark));
    // 同步 body 背景色 & CSS 变量，避免初始闪白/闪黑
    document.body.style.background = isDark ? '#212121' : '#f7f7f8';
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--cursor-color', isDark ? '#fff' : '#1f1f1f');
    document.documentElement.style.setProperty('--scrollbar-thumb', isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const theme = useMemo(() => ({
    isDark,
    toggleTheme,
    classes: {
      themeTransition: 'transition-[background-color,border-color,color,fill,stroke,box-shadow] duration-200 ease-out',
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
    },
  }), [isDark]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
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
