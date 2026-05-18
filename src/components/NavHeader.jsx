import { Sun, Moon } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';

// 设置入口已迁移到侧边栏底部的个人账号菜单里，这里只保留主题切换
const NavHeader = () => {
  const { isDark, toggleTheme, classes } = useTheme();

  return (
    <div className="flex items-center">
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
