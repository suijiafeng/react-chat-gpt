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
        className={`${classes.iconBtn} ${classes.focusRing} ${classes.buttonText} ${classes.buttonHover} ${classes.themeTransition}`}
      >
        <span className="grid h-4 w-4 place-items-center select-none text-[13px] font-medium leading-none tracking-normal">
          {isZh ? '中' : 'EN'}
        </span>
      </button>
      <button
        onClick={toggleTheme}
        aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
        className={`${classes.iconBtn} ${classes.focusRing} ${isDark
          ? 'text-yellow-300 hover:bg-white/5 hover:text-yellow-100'
          : `${classes.buttonText} ${classes.buttonHover}`
        } ${classes.themeTransition}`}
      >
        {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </button>
    </div>
  )
}

export default NavHeader
