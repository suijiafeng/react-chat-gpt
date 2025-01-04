import React from 'react';
import { Send, CircleStop, Plus, Mic } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';

const ChatInput = ({ input, setInput, handleSubmit, isStreaming, isEmpty = false }) => {
  const { classes, isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      className={`inset-x-0 z-20 px-4 ${classes.themeTransition} ${
        isEmpty
          ? 'absolute top-1/2 -translate-y-1/2'
          : 'absolute bottom-0 pb-6 pt-10'
      } ${isDark ? 'from-[#212121] via-[#212121]/90' : 'from-[#f7f7f8] via-[#f7f7f8]/90'}`}
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div
          className={`flex items-center gap-3 rounded-[28px] border px-4 py-3 ${classes.input} ${classes.border} ${classes.themeTransition}`}
        >
          <button
            type="button"
            className={`rounded-full p-2 ${isDark ? 'text-white/75 hover:bg-white/10' : 'text-gray-500 hover:bg-black/5'}`}
          >
            <Plus size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit(e);
              }
            }}
            className="flex-1 bg-transparent text-base outline-none"
            placeholder={t('enterMessage')}
          />
          <button
            type="button"
            className={`rounded-full p-2 ${isDark ? 'text-white/75 hover:bg-white/10' : 'text-gray-500 hover:bg-black/5'}`}
          >
            <Mic size={18} />
          </button>
          <button
            type="submit"
            className={`flex h-11 w-11 items-center justify-center rounded-full ${classes.themeTransition} ${
              isStreaming || input.trim()
                ? isDark
                  ? 'bg-white text-[#212121]'
                  : 'bg-[#1f1f1f] text-white'
                : isDark
                ? 'bg-white/10 text-white/60'
                : 'bg-black/10 text-black/40'
            }`}
          >
            {isStreaming ? <CircleStop size={18} /> : <Send size={18} />}
          </button>
        </div>
        <div className={`mt-3 text-center text-xs ${classes.mutedText}`}>
          AI 回复仅供参考，重要信息请自行核实。
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
