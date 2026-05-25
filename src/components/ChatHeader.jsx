import { Menu, Settings, NotebookPen } from 'lucide-react';
import { useState } from 'react';
import ModelSelector from '../components/ModelSelector';
import NavHeader from './NavHeader';
import SettingsModal from './SettingsModal';
import SystemPromptModal from './SystemPromptModal';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';

const ChatHeader = ({ toggleSidebar, sessionId, systemPrompt, onSystemPromptChange }) => {
  const { classes } = useTheme();
  const { t } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);

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
        {/* 每会话系统提示词入口：仅已持久化的会话（有 sessionId）展示。
            已设置时高亮蓝色，让用户知道当前会话带着系统提示词在跑 */}
        {sessionId && (
          <button
            onClick={() => setIsSystemPromptOpen(true)}
            title={t('systemPrompt')}
            aria-label={t('systemPrompt')}
            className={`${systemPrompt ? 'text-blue-500' : classes.buttonText} ${classes.buttonHover} rounded-lg p-2`}
          >
            <NotebookPen size={18} />
          </button>
        )}
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
      {sessionId && (
        <SystemPromptModal
          isOpen={isSystemPromptOpen}
          onClose={() => setIsSystemPromptOpen(false)}
          value={systemPrompt}
          onSave={onSystemPromptChange}
        />
      )}
    </div>
  );
};

export default ChatHeader;
