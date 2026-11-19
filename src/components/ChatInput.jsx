import { useRef, useEffect, useState } from 'react';
import { Send, CircleStop, Plus, X, FileText, Loader2, TriangleAlert, NotebookPen, Paperclip } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { IMAGE_ACCEPT, FILE_ACCEPT, formatFileSize } from '../utils/attachments';
import { shouldSubmitOnEnter } from '../utils/ime';

const ChatInput = ({
  input,
  setInput,
  handleSubmit,
  isStreaming,
  // 附件相关（由 ChatInterface 管理状态）
  pendingImages = [],
  pendingFiles = [],
  onAddFiles,
  onRemoveImage,
  onRemoveFile,
  isReadingFiles = false,
  visionWarning = false,
  // 每会话系统提示词入口（仅已持久化的会话展示；Modal 由 ChatInterface 管理）
  showSystemPrompt = false,
  hasSystemPrompt = false,
  onOpenSystemPrompt,
}) => {
  const { classes, isDark } = useTheme();
  const { t } = useLanguage();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  // + 按钮弹出菜单：附件与系统提示词入口统一收纳在这里
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef(null);

  useEffect(() => {
    if (!isPlusMenuOpen) return;
    const onPointerDown = (e) => {
      if (!plusMenuRef.current?.contains(e.target)) setIsPlusMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isPlusMenuOpen]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const fit = () => {
      // 容器宽度未就绪（初始隐藏、后台标签页恢复、窗口 resize 过程中）时跳过：
      // 零宽下 placeholder 会竖排换行，scrollHeight 虚高，一旦据此锁定高度，
      // 输入框会永久顶到 160px 上限
      if (!el.clientWidth) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [input]);

  const hasAttachments = pendingImages.length > 0 || pendingFiles.length > 0;

  // 粘贴图片（截图等）直接作为附件
  const handlePaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length) {
      e.preventDefault();
      onAddFiles?.(files);
    }
  };

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 border-t px-4 pb-4 pt-3 ${classes.bg} ${classes.border} ${classes.themeTransition}`}
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        {/* 视觉能力提示：软提醒，不拦截发送 */}
        {visionWarning && (
          <div
            className={`mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <TriangleAlert size={16} strokeWidth={1.75} />
            {t('visionWarning')}
          </div>
        )}
        <div
          className={`rounded-xl border px-3 py-1.5 ${classes.input} ${classes.border} ${classes.themeTransition}`}
        >
          {/* 附件预览区 */}
          {(hasAttachments || isReadingFiles) && (
            <div className="flex flex-wrap gap-2 px-1 pt-2 pb-1">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative group/thumb">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-14 w-14 rounded-md object-cover border border-black/10 dark:border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage?.(i)}
                    className="absolute -top-1.5 -right-1.5 rounded-md bg-black/70 text-white p-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-150 ease-out"
                    title={t('removeImage')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {pendingFiles.map((file, i) => (
                <div
                  key={i}
                  className={`relative group/thumb flex items-center gap-2 rounded-md border px-2.5 py-1.5 max-w-[220px] ${
                    isDark ? 'border-white/10 bg-white/[0.04]' : 'border-black/10 bg-black/[0.03]'
                  }`}
                >
                  <FileText size={16} strokeWidth={1.75} className="shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className={`text-[13px] tabular-nums ${classes.mutedText}`}>
                      {formatFileSize(file.size)}
                      {file.truncated ? ` · ${t('truncatedTag')}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFile?.(i)}
                    className="absolute -top-1.5 -right-1.5 rounded-md bg-black/70 text-white p-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-150 ease-out"
                    title={t('removeFile')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {isReadingFiles && (
                <div className="flex items-center gap-2 px-2 text-sm opacity-60">
                  <Loader2 size={16} strokeWidth={1.75} className="animate-spin" /> {t('parsingFiles')}
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={`${IMAGE_ACCEPT},${FILE_ACCEPT}`}
              className="hidden"
              onChange={(e) => {
                onAddFiles?.(e.target.files);
                e.target.value = ''; // 允许重复选择同一文件
              }}
            />
            {/* + 弹出菜单：附件上传与系统提示词入口 */}
            <div className="relative" ref={plusMenuRef}>
              <button
                type="button"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                title={t('moreActions')}
                aria-label={t('moreActions')}
                aria-expanded={isPlusMenuOpen}
                className={`rounded-md p-2 mb-0.5 transition-colors duration-150 ease-out ${
                  hasSystemPrompt
                    ? 'text-blue-500 hover:bg-blue-500/10'
                    : isDark
                      ? 'text-zinc-300 hover:bg-white/10'
                      : 'text-zinc-500 hover:bg-black/5'
                }`}
              >
                <Plus
                  size={16}
                  strokeWidth={1.75}
                  className={`transform transition-transform duration-150 ease-out ${isPlusMenuOpen ? 'rotate-45' : ''}`}
                />
              </button>
              {isPlusMenuOpen && (
                <div
                  className={`absolute bottom-full left-0 mb-2 z-30 w-48 rounded-lg p-1 ${classes.menu}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out ${
                      isDark
                        ? 'text-zinc-300 hover:bg-white/10 hover:text-white'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    <Paperclip size={16} strokeWidth={1.75} />
                    <span>{t('addFiles')}</span>
                  </button>
                  {showSystemPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        onOpenSystemPrompt?.();
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out ${
                        hasSystemPrompt
                          ? 'text-blue-500 hover:bg-blue-500/10'
                          : isDark
                            ? 'text-zinc-300 hover:bg-white/10 hover:text-white'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <NotebookPen size={16} strokeWidth={1.75} />
                      <span>{t('systemPrompt')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                // 输入法组字中的 Enter 只确认候选，不能当成发送
                if (!shouldSubmitOnEnter(e)) return;
                e.preventDefault();
                handleSubmit(e);
              }}
              className="flex-1 bg-transparent text-base outline-none resize-none overflow-y-auto py-2 h-[24px]"
              placeholder={t('enterMessage')}
              style={{ maxHeight: '160px' }}
            />
            <button
              type="submit"
              aria-label={isStreaming ? t('stopGen') : t('sendMsg')}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ease-out active:scale-[0.98] ${
                isStreaming || input.trim() || hasAttachments
                  ? classes.accentBtn
                  : isDark
                  ? 'bg-white/10 text-white/60'
                  : 'bg-black/10 text-black/40'
              }`}
            >
              {isStreaming ? <CircleStop size={16} strokeWidth={1.75} /> : <Send size={16} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
        {/* 小屏收起免责提示，把纵向空间留给对话内容 */}
        <div className={`mt-2 text-center text-[13px] hidden sm:block ${classes.mutedText}`}>
          {t('disclaimer')}
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
