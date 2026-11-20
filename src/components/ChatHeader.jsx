import { Menu } from 'lucide-react';
import ModelSelector from '../components/ModelSelector';
import NavHeader from './NavHeader';
import { useTheme } from '../contexts/ThemeContext';

// 设置入口已收纳到侧边栏底部的个人中心菜单，系统提示词入口移到输入框附近，
// 顶栏只保留侧边栏开关、模型切换与主题切换
const ChatHeader = ({ toggleSidebar }) => {
  const { classes } = useTheme();

  return (
    <div
      className={`h-16 border-b px-2 md:px-6 flex items-center justify-between ${classes.panel} ${classes.hairline} ${classes.themeTransition}`}
    >
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          aria-label="切换侧边栏"
          className={`${classes.iconBtn} ${classes.focusRing} ${classes.buttonText} ${classes.buttonHover} transition-colors duration-150 ease-out`}
        >
          <Menu size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <ModelSelector />
        <NavHeader />
      </div>
    </div>
  );
};

export default ChatHeader;
