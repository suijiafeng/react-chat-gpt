import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('isDarkTheme');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  useEffect(() => {
    localStorage.setItem('isDarkTheme', JSON.stringify(isDark));
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const theme = useMemo(() => ({
    isDark,
    toggleTheme,
    classes: {
      bg: isDark ? 'bg-[#212121]' : 'bg-white',
      text: isDark ? 'text-white' : 'text-black',
      hoverText: isDark ? 'hover:text-white' : 'hover:text-gray-700',
      buttonText: isDark ? 'text-gray-300' : 'text-gray-500',
      buttonHover: isDark ? 'hover:text-white' : 'hover:text-gray-700',
      themeIcon: isDark ? 'text-yellow-300 hover:text-yellow-100' : 'text-gray-500 hover:text-gray-700',
      input: isDark ? 'bg-[#2f2f2f] text-[#ececec] border-gray-700' : 'bg-white text-black border-gray-300',
      border: isDark ? 'border-gray-500' : 'border-gray-300',
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
