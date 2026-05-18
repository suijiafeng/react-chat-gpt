import { Menu, Settings } from 'lucide-react';
import { useState } from 'react';
import ModelSelector from '../components/ModelSelector';
import NavHeader from './NavHeader';
import SettingsModal from './SettingsModal';
import { useTheme } from '../contexts/ThemeContext';

const ChatHeader = ({ toggleSidebar }) => {
  const { classes } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div
      className={`h-16 border-b px-5 md:px-6 flex items-center justify-between ${classes.bg} ${classes.border} ${classes.themeTransition}`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          aria-label="切换侧边栏"
          className={`${classes.buttonText} ${classes.buttonHover} rounded-lg p-2`}
        >
          <Menu size={20} />
        </button>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <ModelSelector />
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="模型与 API 配置"
          aria-label="模型与 API 配置"
          className={`${classes.buttonText} ${classes.buttonHover} rounded-lg p-2`}
        >
          <Settings size={18} />
        </button>
        <NavHeader />
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default ChatHeader;
