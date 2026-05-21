import React, { useState, useRef, useEffect } from 'react';
import { Popconfirm } from 'antd';
import { useTheme } from '../contexts/ThemeContext';
import { Loader, Copy, Check, RefreshCw, Pencil, StepForward, AlertTriangle, ChevronDown, Trash2, FileText } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { formatFileSize } from '../utils/attachments';

// 还没收到第一个字符前展示的等待动画；等待较久时升级为文字提示，
// 让用户知道请求还活着、并提示可以随时停止（30 秒无任何数据会被看门狗自动中止）
const SLOW_HINT_SECONDS = 8;

const LoadingIndicator = ({ classes, elapsed }) => (
  <div data-elapsed={elapsed} className={`flex items-center gap-2 text-sm ${classes.text}`}>
    <Loader size={18} className="animate-spin-slow" />
    {elapsed >= SLOW_HINT_SECONDS && (
      <span className="text-xs opacity-60">
        模型响应较慢，已等待 {elapsed} 秒…（可点右下角停止按钮取消）
      </span>
    )}
  </div>
);

// 秒数 → m′s″ 展示
const formatSeconds = (s) => (s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`);

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
    images,
    attachments,
    onRegenerate,
    onContinue,
    onEdit,
    onDelete,
  }) => {
    const { isDark, classes } = useTheme();
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message);
    const [reasoningExpanded, setReasoningExpanded] = useState(false);
    const editRef = useRef(null);
    const reasoningScrollRef = useRef(null);

    // 正文出现前的等待/思考计时：驱动"响应较慢"提示与思考耗时展示
    const waiting = isTyping && !message;
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
      if (!waiting) {
        setElapsed(0);
        return;
      }
      const startedAt = Date.now();
      // 500ms 一跳、按真实时间差计算：即便浏览器对后台/繁忙页面节流定时器，
      // 显示的秒数也不会累积漂移
      const timer = setInterval(
        () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
        500
      );
      return () => clearInterval(timer);
    }, [waiting]);

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

    const containerClasses = `group message-row flex mb-8 ${isUser ? 'justify-end' : 'justify-start'}`;
    // 小屏给消息更宽的可读区域（90%），桌面维持 82% 的留白节奏
    const contentContainerClasses = `flex flex-col max-w-[90%] sm:max-w-[min(720px,82%)] ${
      isUser ? 'items-end' : 'items-start'
    }`;
    const messageClasses = `
      px-5 py-2 text-base leading-7
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
                className="w-full bg-transparent text-base leading-7 outline-none resize-none"
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
          {/* 用户消息的附件：图片缩略与文件卡片展示在气泡上方 */}
          {isUser && images?.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 mb-2">
              {images.map((img, i) => (
                <a key={i} href={img.dataUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={img.dataUrl}
                    alt={img.name || `图片 ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-48 max-w-[240px] rounded-2xl object-cover border border-black/10 dark:border-white/10"
                  />
                </a>
              ))}
            </div>
          )}
          {isUser && attachments?.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 mb-2">
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 max-w-[240px] ${
                    isDark ? 'border-white/10 bg-white/[0.04]' : 'border-black/10 bg-black/[0.03]'
                  }`}
                >
                  <FileText size={16} className="shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{file.name}</div>
                    <div className="text-xs opacity-50">{formatFileSize(file.size)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    className={`mb-3 px-1 text-xs leading-5 ${
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
                      <span>
                        {isTyping && !message
                          ? `思考中（已 ${formatSeconds(elapsed)}）`
                          : '思考过程'}
                      </span>
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
                      {isTyping && !message && elapsed >= 60 && (
                        <span className="opacity-60">思考较长，可随时点停止按钮中断并保留已有内容</span>
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
              isTyping && <LoadingIndicator classes={classes} elapsed={elapsed} />
            )}
          </div>
          {/* 操作栏：AI 最后一条常驻，其余消息 hover 时显示；生成中不显示 */}
          {!isTyping && !(isStreaming && isLast) && (message || images?.length > 0 || attachments?.length > 0) && (
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
              {onDelete && !isStreaming && (
                <Popconfirm
                  title="删除这条消息？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => onDelete(messageId)}
                >
                  <button
                    type="button"
                    title="删除消息"
                    className={`flex items-center gap-1 rounded-md p-1.5 text-xs transition-colors ${
                      isDark ? 'text-white/50 hover:text-red-300 hover:bg-white/10' : 'text-black/40 hover:text-red-500 hover:bg-black/5'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </Popconfirm>
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
