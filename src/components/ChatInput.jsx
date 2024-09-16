import React from 'react';
import { Send, CircleStop } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ChatInput = ({ input, setInput, handleSubmit, isStreaming }) => {
  const { classes, isDark } = useTheme();

  return (
    <div className="py-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={`flex-1 rounded-l-lg px-4 py-2 focus:outline-none border transition-colors duration-300 ${classes.border} ${classes.input}`}
            placeholder="输入消息"
          />
          <button
            type="submit"
            className={`${isDark ? 'bg-blue-500' : 'bg-blue-400'} text-white rounded-r-lg px-4 py-2`}
          >
            {isStreaming ?
              <CircleStop size={20} />
              :
              <Send size={20} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
