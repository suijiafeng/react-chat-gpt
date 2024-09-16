import React from 'react';
import { Menu } from 'lucide-react';
import ModelSelector from '../components/ModelSelector';
import NavHeader from './NavHeader';
import { useTheme } from '../contexts/ThemeContext';

const ChatHeader = ({ toggleSidebar }) => {
  const { classes } = useTheme();

  return (
    <div className={`px-4 flex items-center justify-between h-16 border-b transition-colors duration-300 ${classes.bg} ${classes.border} `}>
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className={`${classes.buttonText} ${classes.buttonHover} mr-4`}
        >
          <Menu size={24} />
        </button>
        <ModelSelector />
      </div>
      <NavHeader />
    </div>
  );
};

export default ChatHeader;
