import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ChatMessage = React.memo(({ message, isUser }) => {
  const { isDark } = useTheme();
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`${isDark ? "bg-gray-700 text-white" : "bg-gray-200 text-black"
          } rounded-lg px-4 py-2 max-w-[70%] transition-colors duration-300`}
      >
        {message}
      </div>
    </div>
  );
});


export default ChatMessage;