import React, { useState } from 'react'
import { Sun, Moon, Globe, Settings } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import SettingsModal from './SettingsModal';

const NavHeader = () => {
  const { isDark, toggleTheme, classes } = useTheme();
  const { language, changeLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
          onClick={() => setIsSettingsOpen(true)}
          className={`${isDark
            ? 'text-gray-300 hover:bg-white/5 hover:text-white'
            : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'
            } ${classes.themeTransition} mr-2 rounded-lg p-2`}
          title="Settings / 设置"
        >
          <Settings size={18} />
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
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default NavHeader
