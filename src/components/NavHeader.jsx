import React from 'react'
import { Send, Menu, Sun, Moon, Globe } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
const NavHeader = () => {
  const { isDark, toggleTheme } = useTheme();
  const { language, changeLanguage, t } = useLanguage();
  return (
    <div
      className={`px-4 flex items-center justify-between h-[65px] transition-colors duration-300`}
    >
      <div className="flex items-center">
        <button
          onClick={() => changeLanguage(language === 'zh' ? 'en' : 'zh')}
          className={`${isDark
            ? "text-gray-300 hover:text-white"
            : "text-gray-500 hover:text-gray-700"
            } mr-4 flex items-center w-[45px]`}
        >
          <Globe size={24} />
          {language}
        </button>
        <button
          onClick={toggleTheme}
          className={`${isDark
            ? "text-yellow-300 hover:text-yellow-100"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          {isDark ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>
    </div>
  )
}

export default NavHeader