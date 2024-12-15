import React from 'react'
import { Sun, Moon, Globe } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';

const NavHeader = () => {
  const { isDark, toggleTheme, classes } = useTheme();
  const { language, changeLanguage } = useLanguage();
  return (
    <div
      className="flex items-center justify-between"
    >
      <div className="flex items-center">
        <button
          onClick={() => changeLanguage(language === 'zh' ? 'en' : 'zh')}
          className={`${isDark
            ? 'text-gray-300 hover:bg-white/5 hover:text-white'
            : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'
            } ${classes.themeTransition} mr-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm uppercase`}
        >
          <Globe size={18} />
          {language}
        </button>
        <button
          onClick={toggleTheme}
          className={`${isDark
            ? 'text-yellow-300 hover:bg-white/5 hover:text-yellow-100'
            : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'
            } ${classes.themeTransition} rounded-lg p-2`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  )
}

export default NavHeader
