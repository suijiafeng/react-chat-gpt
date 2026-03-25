import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Loader, Copy, Check, RefreshCw, Pencil, StepForward, AlertTriangle, ChevronDown } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

// 还没收到第一个字符前展示的等待动画。
const LoadingIndicator = ({ classes }) => (
  <div className="flex justify-center text-sm">
    <Loader size={18} className={`${classes.text} animate-spin-slow`} />
  </div>
);

// 操作栏里的小图标按钮
const ActionButton = ({ title, onClick, isDark, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`flex items-center gap-1 rounded-md p-1.5 text-xs transition-colors ${
      isDark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-black/40 hover:text-black hover:bg-black/5'
    }`}
  >
    {children}
  </button>
);

const ChatMessage = React.memo(
  ({
    message,
    reasoning,
    messageId,
    isTyping,
    isUser,
    isError = false,
    isLast = false,
    isStreaming = false,
    canContinue = false,
    onRegenerate,
    onContinue,
    onEdit,
  }) => {
    const { isDark, classes } = useTheme();
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message);
    const [reasoningExpanded, setReasoningExpanded] = useState(false);
    const editRef = useRef(null);
    const reasoningScrollRef = useRef(null);

    // 进入编辑态时聚焦并自适应高度
    useEffect(() => {
      if (isEditing && editRef.current) {
        const el = editRef.current;
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, [isEditing]);

    // 正式内容出现后，自动折叠并进一步弱化思考过程
    useEffect(() => {
      if (message) {
        setReasoningExpanded(false);
      }
    }, [message]);

    // 思考区展开后，流式更新时始终跟随到最新内容
    useEffect(() => {
      if (!reasoningExpanded) return;
      const el = reasoningScrollRef.current;
      if (!el) return;

      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }, [reasoningExpanded, reasoning]);

    const handleCopy = () => {
      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const startEdit = () => {
      setEditText(message);
      setIsEditing(true);
    };

    const submitEdit = () => {
      const next = editText.trim();
      setIsEditing(false);
      if (next && next !== message) {
        onEdit?.(messageId, next);
      }
    };

    const containerClasses = `group flex mb-8 ${isUser ? 'justify-end' : 'justify-start'}`;
    const contentContainerClasses = `flex flex-col max-w-[min(720px,82%)] ${
      isUser ? 'items-end' : 'items-start'
    }`;
    const messageClasses = `
      px-5 py-2 text-[15px] leading-7
      ${
        isUser
          ? isDark
            ? 'rounded-[28px] bg-white/[0.06] text-white'
            : 'rounded-[28px] bg-black/[0.04] text-black'
          : isError
          ? isDark
            ? 'rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200'
            : 'rounded-2xl border border-red-200 bg-red-50 text-red-700'
          : 'bg-transparent text-inherit'
      }
    `;

    // 编辑态：气泡替换成编辑框
    if (isUser && isEditing) {
      return (
        <div className={containerClasses}>
          <div className="flex flex-col items-stretch w-[min(720px,82%)]">
            <div
              className={`rounded-[20px] border px-4 py-3 ${classes.border} ${
                isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]'
              }`}
            >
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitEdit();
                  }
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="w-full bg-transparent text-[15px] leading-7 outline-none resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`rounded-full px-4 py-1.5 text-sm ${
                    isDark ? 'text-white/70 hover:bg-white/10' : 'text-black/60 hover:bg-black/5'
                  }`}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={!editText.trim()}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-40 ${
                    isDark ? 'bg-white text-[#212121]' : 'bg-[#1f1f1f] text-white'
                  }`}
                >
                  保存并重发
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={containerClasses}>
        <div className={contentContainerClasses}>
          <div className={messageClasses}>
            {isUser ? (
              <span className="message-text whitespace-pre-wrap break-words">{message}</span>
            ) : message || reasoning ? (
              <>
                {isError && (
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-medium uppercase tracking-wide">
                    <AlertTriangle size={13} />
                    <span>出错了</span>
                  </div>
                )}
                {reasoning && (
                  <div
                    className={`mb-3 px-1 text-[11px] leading-5 ${
                      message
                        ? isDark
                          ? 'text-white/35'
                          : 'text-black/35'
                        : isDark
                        ? 'text-white/55'
                        : 'text-black/55'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setReasoningExpanded((v) => !v)}
                      className={`inline-flex items-center gap-1.5 select-none ${
                        isDark ? 'text-white/65 hover:text-white/90' : 'text-black/55 hover:text-black/80'
                      }`}
                    >
                      <span>{isTyping && !message ? '思考中' : '思考过程'}</span>
                      {isTyping && !message && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
                          <span
                            className="h-1 w-1 rounded-full bg-current animate-pulse"
                            style={{ animationDelay: '140ms' }}
                          />
                          <span
                            className="h-1 w-1 rounded-full bg-current animate-pulse"
                            style={{ animationDelay: '280ms' }}
                          />
                        </span>
                      )}
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${reasoningExpanded ? 'rotate-180' : 'rotate-0'}`}
                      />
                    </button>

                    {reasoningExpanded && (
                      <div
                        ref={reasoningScrollRef}
                        className="mt-1 max-h-44 overflow-y-auto whitespace-pre-wrap break-words"
                      >
                        {reasoning}
                      </div>
                    )}
                  </div>
                )}
                {message && <MarkdownRenderer content={message} isTyping={isTyping} />}
              </>
            ) : (
              isTyping && <LoadingIndicator classes={classes} />
            )}
          </div>
          {/* 操作栏：AI 最后一条常驻，其余消息 hover 时显示；生成中不显示 */}
          {!isTyping && !(isStreaming && isLast) && message && (
            <div
              className={`flex items-center gap-0.5 mt-1 px-2 transition-opacity ${
                !isUser && isLast ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <ActionButton title="复制" onClick={handleCopy} isDark={isDark}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </ActionButton>
              {isUser && !isStreaming && onEdit && (
                <ActionButton title="编辑并重发" onClick={startEdit} isDark={isDark}>
                  <Pencil size={14} />
                </ActionButton>
              )}
              {/* 外层守卫已排除 isStreaming && isLast，走到这里的 isLast 分支必然不在生成中 */}
              {!isUser && isLast && onRegenerate && (
                <ActionButton title="重新生成" onClick={onRegenerate} isDark={isDark}>
                  <RefreshCw size={14} />
                </ActionButton>
              )}
              {!isUser && isLast && canContinue && onContinue && (
                <ActionButton title="继续生成" onClick={onContinue} isDark={isDark}>
                  <StepForward size={14} />
                  <span>继续生成</span>
                </ActionButton>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
