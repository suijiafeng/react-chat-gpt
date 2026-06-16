import { useRef, useEffect, useState } from 'react';
import { Send, CircleStop, Plus, X, FileText, Loader2, TriangleAlert, NotebookPen, Paperclip } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { IMAGE_ACCEPT, FILE_ACCEPT, formatFileSize } from '../utils/attachments';

const ChatInput = ({
  input,
  setInput,
  handleSubmit,
  isStreaming,
  isEmpty = false,
  suggestions = [],
  onSuggestionClick,
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
      className={`inset-x-0 z-20 px-4 ${classes.themeTransition} ${
        isEmpty
          ? 'absolute top-1/2 -translate-y-1/2'
          : `absolute bottom-0 pb-6 bg-gradient-to-t ${
                isDark
                  ? 'from-[#212121] via-[#212121]/90 to-transparent'
                  : 'from-[#f7f7f8] via-[#f7f7f8]/90 to-transparent'
              }`
      }`}
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        {/* 视觉能力提示：软提醒，不拦截发送 */}
        {visionWarning && (
          <div
            className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <TriangleAlert size={13} />
            {t('visionWarning')}
          </div>
        )}
        <div
          className={`rounded-[28px] border px-4 py-2 ${classes.input} ${classes.border} ${classes.themeTransition}`}
        >
          {/* 附件预览区 */}
          {(hasAttachments || isReadingFiles) && (
            <div className="flex flex-wrap gap-2 px-1 pt-2 pb-1">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative group/thumb">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-16 w-16 rounded-xl object-cover border border-black/10 dark:border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage?.(i)}
                    className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white p-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    title={t('removeImage')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {pendingFiles.map((file, i) => (
                <div
                  key={i}
                  className={`relative group/thumb flex items-center gap-2 rounded-xl border px-3 py-2 max-w-[220px] ${
                    isDark ? 'border-white/10 bg-white/[0.04]' : 'border-black/10 bg-black/[0.03]'
                  }`}
                >
                  <FileText size={16} className="shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-sm opacity-50">
                      {formatFileSize(file.size)}
                      {file.truncated ? ` · ${t('truncatedTag')}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFile?.(i)}
                    className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white p-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    title={t('removeFile')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {isReadingFiles && (
                <div className="flex items-center gap-2 px-2 text-sm opacity-60">
                  <Loader2 size={14} className="animate-spin" /> {t('parsingFiles')}
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
                className={`rounded-full p-2 mb-1 ${
                  hasSystemPrompt
                    ? 'text-blue-500 hover:bg-blue-500/10'
                    : isDark
                      ? 'text-white/75 hover:bg-white/10'
                      : 'text-gray-500 hover:bg-black/5'
                }`}
              >
                <Plus
                  size={18}
                  className={`transform transition-transform duration-150 ${isPlusMenuOpen ? 'rotate-45' : ''}`}
                />
              </button>
              {isPlusMenuOpen && (
                <div
                  className={`absolute bottom-full left-0 mb-2 z-30 w-44 rounded-xl border p-1 shadow-lg ${classes.border} ${
                    isDark ? 'bg-[#222222]' : 'bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      isDark
                        ? 'text-white/70 hover:bg-white/10 hover:text-white'
                        : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                    }`}
                  >
                    <Paperclip size={15} />
                    <span>{t('addFiles')}</span>
                  </button>
                  {showSystemPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        onOpenSystemPrompt?.();
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        hasSystemPrompt
                          ? 'text-blue-500 hover:bg-blue-500/10'
                          : isDark
                            ? 'text-white/70 hover:bg-white/10 hover:text-white'
                            : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                      }`}
                    >
                      <NotebookPen size={15} />
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
              type="submit"
              aria-label={isStreaming ? t('stopGen') : t('sendMsg')}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${classes.themeTransition} ${
                isStreaming || input.trim() || hasAttachments
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
        </div>
        {isEmpty && suggestions.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {suggestions.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onSuggestionClick?.(item)}
                className={`rounded-2xl border px-3 py-3 text-left text-base ${classes.border} ${classes.themeTransition} ${
                  isDark
                    ? 'bg-white/[0.03] text-white/80 hover:bg-white/10'
                    : 'bg-white text-gray-600 hover:bg-black/5'
                }`}
              >
                <item.icon size={14} className="mr-2 inline-block align-[-2px]" />
                {item.title}
              </button>
            ))}
          </div>
        )}
        {/* 小屏收起免责提示，把纵向空间留给对话内容 */}
        <div className={`mt-3 text-center text-sm hidden sm:block ${classes.mutedText}`}>
          {t('disclaimer')}
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
