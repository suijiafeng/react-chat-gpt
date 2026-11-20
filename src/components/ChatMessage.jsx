import React, { useState, useRef, useEffect } from 'react';
import { Popconfirm } from 'antd';
import { useTheme } from '../contexts/ThemeContext';
import { Loader, Copy, Check, RefreshCw, Pencil, StepForward, AlertTriangle, ChevronDown, Trash2, FileText } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { formatFileSize } from '../utils/attachments';
import { shouldSubmitOnEnter } from '../utils/ime';
import { useLanguage } from '../hooks';

// 还没收到第一个字符前展示的等待动画；等待较久时升级为文字提示，
// 让用户知道请求还活着、并提示可以随时停止（30 秒无任何数据会被看门狗自动中止）
const SLOW_HINT_SECONDS = 8;

const LoadingIndicator = ({ classes, elapsed, t }) => (
  <div data-elapsed={elapsed} className={`flex items-center gap-2 text-sm ${classes.text}`}>
    <Loader size={18} className="animate-spin-slow" />
    {elapsed >= SLOW_HINT_SECONDS && (
      <span className={`text-[13px] tabular-nums ${classes.mutedText}`}>{t('slowResponse', { s: elapsed })}</span>
    )}
  </div>
);

// 秒数 → m′s″ 展示（文案走 i18n）
const formatSeconds = (s, t) =>
  s >= 60 ? t('timeMinSec', { m: Math.floor(s / 60), s: s % 60 }) : t('timeSec', { s });

// 操作栏里的小图标按钮
const ActionButton = ({ title, onClick, isDark, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`inline-flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-[13px] transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
      isDark ? 'text-[#a1a1aa] hover:text-white hover:bg-white/10' : 'text-[#6b7280] hover:text-black hover:bg-black/5'
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
    const { t } = useLanguage();
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message);
    const [reasoningExpanded, setReasoningExpanded] = useState(false);
    // 手机没有 hover：点消息或长按才展开这一条的操作，避免每条都常驻三个图标
    const [actionsOpen, setActionsOpen] = useState(false);
    const editRef = useRef(null);
    const reasoningScrollRef = useRef(null);
    const rowRef = useRef(null);

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

    useEffect(() => {
      if (!actionsOpen) return;
      const onPointer = (e) => {
        if (!rowRef.current?.contains(e.target)) setActionsOpen(false);
      };
      document.addEventListener('pointerdown', onPointer);
      return () => document.removeEventListener('pointerdown', onPointer);
    }, [actionsOpen]);

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

    const containerClasses = `group message-row flex mb-6 min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`;
    // 窄屏 AI 回复占满消息列（左右都是滚动区的 px-4）。桌面仍是 82% / 720px。
    // min-w-0 让宽代码在代码块内横滑，而不是把页面撑出横向滚动。
    const contentContainerClasses = `relative flex min-w-0 flex-col ${
      isUser
        ? 'max-w-[90%] items-end sm:max-w-[min(720px,82%)]'
        : 'w-full items-stretch sm:max-w-[min(720px,82%)]'
    }`;
    const messageClasses = `
      min-w-0 max-w-full py-2 text-base leading-7
      ${
        isUser
          ? `px-4 ${isDark ? 'rounded-xl bg-white/[0.06] text-white' : 'rounded-xl bg-black/[0.04] text-black'}`
          : isError
          ? `px-4 ${
              isDark
                ? 'rounded-xl border border-red-500/30 bg-red-500/10 text-red-200'
                : 'rounded-xl border border-red-200 bg-red-50 text-red-700'
            }`
          : 'w-full bg-transparent px-0 text-inherit'
      }
    `;

    // 编辑态：气泡替换成编辑框
    if (isUser && isEditing) {
      return (
        <div className={containerClasses}>
          <div className="flex flex-col items-stretch w-[min(720px,82%)]">
            <div
              className={`rounded-xl border px-3 py-2.5 ${classes.border} ${
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
                  // 输入法组字中的 Enter 只确认候选，不能当成保存并重发
                  if (shouldSubmitOnEnter(e)) {
                    e.preventDefault();
                    submitEdit();
                  }
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="w-full bg-transparent text-base leading-7 outline-none resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`min-h-10 rounded-md px-3 text-sm transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
                    isDark ? 'text-white/70 hover:bg-white/10' : 'text-black/60 hover:bg-black/5'
                  }`}
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={!editText.trim()}
                  className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${classes.accentBtn}`}
                >
                  {t('saveResend')}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={rowRef}
        className={containerClasses}
        onClick={(e) => {
          if (e.target.closest('button, a, input, textarea')) return;
          if (window.getSelection?.()?.toString()) return;
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
          setActionsOpen((open) => !open);
        }}
        onContextMenu={(e) => {
          if (e.target.closest('button, a, input, textarea')) return;
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
          e.preventDefault();
          setActionsOpen(true);
        }}
      >
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
                    className="max-h-48 max-w-[240px] rounded-lg object-cover border border-black/10 dark:border-white/10"
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
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 max-w-[240px] ${
                    isDark ? 'border-white/10 bg-white/[0.04]' : 'border-black/10 bg-black/[0.03]'
                  }`}
                >
                  <FileText size={16} className="shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{file.name}</div>
                    <div className={`text-[13px] tabular-nums ${classes.mutedText}`}>{formatFileSize(file.size)}</div>
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
                  <div className="flex items-center gap-2 mb-1 text-[13px] font-medium tracking-normal">
                    <AlertTriangle size={13} />
                    <span>{t('errorOccurred')}</span>
                  </div>
                )}
                {reasoning && (
                  <div
                    className={`mb-3 px-1 text-[13px] leading-5 tabular-nums ${
                      message ? 'text-zinc-500' : isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setReasoningExpanded((v) => !v)}
                      className={`inline-flex items-center gap-2 select-none ${
                        isDark ? 'text-white/65 hover:text-white/90' : 'text-black/55 hover:text-black/80'
                      }`}
                    >
                      <span>
                        {isTyping && !message
                          ? t('thinking', { time: formatSeconds(elapsed, t) })
                          : t('thinkingProcess')}
                      </span>
                      {isTyping && !message && elapsed >= 60 && (
                        <span className="opacity-60">{t('thinkingHint')}</span>
                      )}
                      <ChevronDown
                        size={13}
                        className={`transition-transform duration-150 ease-out ${reasoningExpanded ? 'rotate-180' : 'rotate-0'}`}
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
              isTyping && <LoadingIndicator classes={classes} elapsed={elapsed} t={t} />
            )}
          </div>
          {/* 操作栏：最后一条常驻。更早的消息桌面 hover 显示，手机点按/长按显示。
              隐藏时绝对定位，不再占 40px 把消息间距撑开。 */}
          {!isTyping && !(isStreaming && isLast) && (message || images?.length > 0 || attachments?.length > 0) && (
            <div
              className={`flex items-center gap-0.5 transition-opacity duration-150 ease-out ${
                isLast
                  ? `mt-1 opacity-100 ${isUser ? '' : '-ml-3'}`
                  : `absolute z-10 top-[calc(100%-0.5rem)] ${isUser ? 'right-0' : 'left-0 -ml-3'} ${
                      actionsOpen
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100'
                    }`
              }`}
            >
              <ActionButton title={t('copy')} onClick={handleCopy} isDark={isDark}>
                {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
              </ActionButton>
              {isUser && !isStreaming && onEdit && (
                <ActionButton title={t('editResend')} onClick={startEdit} isDark={isDark}>
                  <Pencil size={16} strokeWidth={1.75} />
                </ActionButton>
              )}
              {/* 外层守卫已排除 isStreaming && isLast，走到这里的 isLast 分支必然不在生成中 */}
              {!isUser && isLast && onRegenerate && (
                <ActionButton title={t('regenerate')} onClick={onRegenerate} isDark={isDark}>
                  <RefreshCw size={16} strokeWidth={1.75} />
                </ActionButton>
              )}
              {!isUser && isLast && canContinue && onContinue && (
                <ActionButton title={t('continueGen')} onClick={onContinue} isDark={isDark}>
                  <StepForward size={16} strokeWidth={1.75} />
                  <span>{t('continueGen')}</span>
                </ActionButton>
              )}
              {onDelete && !isStreaming && (
                <Popconfirm
                  title={t('deleteMsgConfirm')}
                  okText={t('delete')}
                  cancelText={t('cancel')}
                  onConfirm={() => onDelete(messageId)}
                >
                  <button
                    type="button"
                    title={t('deleteMsg')}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
                      isDark ? 'text-[#a1a1aa] hover:text-red-300 hover:bg-white/10' : 'text-[#6b7280] hover:text-red-600 hover:bg-black/5'
                    }`}
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
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
