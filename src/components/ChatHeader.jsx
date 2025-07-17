import React from 'react';
import { Menu } from 'lucide-react';
import ModelSelector from '../components/ModelSelector';
import NavHeader from './NavHeader';
import { useTheme } from '../contexts/ThemeContext';

const ChatHeader = ({ toggleSidebar }) => {
  const { classes } = useTheme();

  return (
    <div
      className={`h-16 border-b px-5 md:px-6 flex items-center justify-between ${classes.bg} ${classes.border} ${classes.themeTransition}`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className={`${classes.buttonText} ${classes.buttonHover} rounded-lg p-2`}
        >
          <Menu size={20} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        {/* <div className="hidden md:block">
          <ModelSelector />
        </div> */}
        <NavHeader />
      </div>
    </div>
  );
};

export default ChatHeader;
