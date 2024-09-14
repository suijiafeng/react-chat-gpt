import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // 从 localStorage 读取主题设置，如果没有则默认为 false（亮色主题）
    const savedTheme = localStorage.getItem('isDarkTheme');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  useEffect(() => {
    // 当 isDark 状态改变时，将其保存到 localStorage
    localStorage.setItem('isDarkTheme', JSON.stringify(isDark));
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  const theme = {
    isDark,
    toggleTheme,
    bg: isDark ? 'bg-[#212121]' : 'bg-white',
    text: isDark ? 'text-white' : 'text-black',
    hoverText: isDark ? 'hover:text-white' : 'hover:text-gray-700',
    buttonText: isDark ? 'text-gray-300' : 'text-gray-500',
    buttonHover: isDark ? 'hover:text-white' : 'hover:text-gray-700',
    themeIcon: isDark ? 'text-yellow-300 hover:text-yellow-100' : 'text-gray-500 hover:text-gray-700',
    input: isDark ? "bg-[#2f2f2f] text-[#ececec] border-gray-700" : "bg-white text-black border-gray-300",
    border: isDark ? " border-gray-500" : "border-inherit"
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const withTheme = (Component) => {
  return (props) => {
    const theme = useTheme();
    return (
      <div className={`${theme.bg} ${theme.text} transition-colors duration-300`}>
        <Component {...props} />
      </div>
    );
  };
};