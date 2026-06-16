import { Sun, Moon } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';

// 右上角全局开关：语言切换 + 主题切换（设置入口在模型下拉面板里）
const NavHeader = () => {
  const { isDark, toggleTheme, classes } = useTheme();
  const { language, changeLanguage } = useLanguage();
  const isZh = language?.startsWith('zh');

  return (
    <div className="flex items-center gap-1">
      {/* 语言切换：图标随当前语言变化（中 ⇄ EN），一眼可见当前状态 */}
      <button
        onClick={() => changeLanguage(isZh ? 'en' : 'zh')}
        aria-label={isZh ? 'Switch to English' : '切换到中文'}
        title={isZh ? 'English' : '中文'}
        className={`${classes.buttonText} ${classes.buttonHover} ${classes.themeTransition} rounded-lg p-2`}
      >
        <span
          className={`grid h-[18px] w-[18px] place-items-center select-none font-semibold leading-none ${
            isZh ? 'text-[13px]' : 'text-[10px] tracking-tight'
          }`}
        >
          {isZh ? '中' : 'EN'}
        </span>
      </button>
      <button
        onClick={toggleTheme}
        aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
        className={`${isDark
          ? 'text-yellow-300 hover:bg-white/5 hover:text-yellow-100'
          : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'
          } ${classes.themeTransition} rounded-lg p-2`}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  )
}

export default NavHeader
