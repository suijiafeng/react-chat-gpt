import React, { useRef, useEffect } from 'react';
import { Send, CircleStop, Plus, Mic } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';

const ChatInput = ({ input, setInput, handleSubmit, isStreaming, isEmpty = false, suggestions = [], onSuggestionClick }) => {
  const { classes, isDark } = useTheme();
  const { t } = useLanguage();
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  return (
    <div
      className={`inset-x-0 z-20 px-4 ${classes.themeTransition} ${
        isEmpty
          ? 'absolute top-1/2 -translate-y-1/2'
          : // 缺一个 bg-gradient-to-t 方向类，from-/via- 色标就不会生效——
            // 之前整个容器其实是透明的，滚动的消息内容会从输入框周围穿透显示出来
            `absolute bottom-0 pb-6 pt-10 bg-gradient-to-t ${
                isDark
                  ? 'from-[#212121] via-[#212121]/90 to-transparent'
                  : 'from-[#f7f7f8] via-[#f7f7f8]/90 to-transparent'
              }`
      }`}
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div
          className={`flex items-end gap-3 rounded-[28px] border px-4 py-2 ${classes.input} ${classes.border} ${classes.themeTransition}`}
        >
          <button
            type="button"
            className={`rounded-full p-2 mb-0.5 ${isDark ? 'text-white/75 hover:bg-white/10' : 'text-gray-500 hover:bg-black/5'}`}
          >
            <Plus size={18} />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            className="flex-1 bg-transparent text-base outline-none resize-none overflow-y-auto py-2 h-[24px]"
            placeholder={t('enterMessage')}
            style={{ maxHeight: '160px' }}
          />
          <button
            type="button"
            className={`rounded-full p-2 mb-0.5 ${isDark ? 'text-white/75 hover:bg-white/10' : 'text-gray-500 hover:bg-black/5'}`}
          >
            <Mic size={18} />
          </button>
          <button
            type="submit"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${classes.themeTransition} ${
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
        {isEmpty && suggestions.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {suggestions.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onSuggestionClick?.(item.prompt)}
                className={`rounded-2xl border px-3 py-3 text-left text-sm ${classes.border} ${classes.themeTransition} ${
                  isDark
                    ? 'bg-white/[0.03] text-white/80 hover:bg-white/10'
                    : 'bg-white text-gray-600 hover:bg-black/5'
                }`}
              >
                <span className="mr-1.5">{item.icon}</span>
                {item.title}
              </button>
            ))}
          </div>
        )}
        <div className={`mt-3 text-center text-xs ${classes.mutedText}`}>
          AI 回复仅供参考，重要信息请自行核实。
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
