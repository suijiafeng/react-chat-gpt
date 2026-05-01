import { Menu, Download } from 'lucide-react';
import { message as antdMessage } from 'antd';
import ModelSelector from '../components/ModelSelector';
import NavHeader from './NavHeader';
import { useTheme } from '../contexts/ThemeContext';

const ChatHeader = ({ toggleSidebar, sessionId, canExport = false }) => {
  const { classes } = useTheme();

  const handleExport = async () => {
    try {
      const { exportSessionAsMarkdown } = await import('../utils/exportMarkdown');
      await exportSessionAsMarkdown(sessionId);
    } catch (error) {
      antdMessage.error(`导出失败：${error.message}`);
    }
  };

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
        {canExport && sessionId && (
          <button
            onClick={handleExport}
            title="导出当前会话为 Markdown"
            aria-label="导出当前会话为 Markdown"
            className={`${classes.buttonText} ${classes.buttonHover} rounded-lg p-2`}
          >
            <Download size={18} />
          </button>
        )}
        <ModelSelector />
        <NavHeader />
      </div>
    </div>
  );
};

export default ChatHeader;
