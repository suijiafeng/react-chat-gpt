import { useCallback, useState, useLayoutEffect, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message as antdMessage } from 'antd';
import { useChat, toConversation } from '../hooks';
import {
  readImageFile,
  readAttachmentFile,
  buildUserContent,
  isSupportedFile,
} from '../utils/attachments';
import { isLikelyVisionModel } from '../utils/modelCapabilities';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import { useTheme } from '../contexts/ThemeContext';
import { createSession } from '../store/db';
import { useLlmConfig, resolveCurrentModel, resolveProviderName } from '../store/llmConfig';
import { DEMO_PROMPTS } from '../constants/demoReplies';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const ChatInterface = () => {
  const { chatId } = useParams(); // /c/:chatId 时有值，/new 时无值
  const navigate = useNavigate();
  // 直接从路由参数派生，天然避免"sessionId 先是 null 再变成 chatId"的中间态——
  // 那个中间态会让空会话欢迎页闪现一下再切回消息列表（页面抖动）
  const sessionId = chatId || null;
  // 用于触发 Sidebar 重新加载会话列表
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // 订阅配置中心：设置弹窗或模型切换器改动后，这里即时拿到新模型，无需刷新页面
  useLlmConfig();
  const currentModel = resolveCurrentModel();

  // 会话有更新（完成一次回复 / 取消时保存了部分内容）时，刷新 Sidebar 的会话列表
  const handleSessionTouched = useCallback(() => {
    setSidebarRefreshKey((k) => k + 1);
  }, []);

  const {
    messages,
    input,
    setInput,
    isStreaming,
    handleChatCompletion,
    messagesEndRef,
    cancelChatCompletion,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
    initialLoaded,
    canContinue,
    regenerate,
    editAndResend,
    continueGeneration,
    deleteMessage,
    autoFollowRef,
  } = useChat(currentModel, sessionId, handleSessionTouched);

  const { classes } = useTheme();

  // 待发送附件：图片（vision 输入）与文件（文本提取注入上下文）
  const [pendingImages, setPendingImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);

  const addFiles = useCallback(async (fileList) => {
    const MAX_IMAGES = 6;
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setIsReadingFiles(true);
    try {
      for (const file of files) {
        // 拖拽/粘贴可绕过 <input accept>，这里统一做格式白名单拦截
        if (!isSupportedFile(file)) {
          antdMessage.warning(`「${file.name}」格式不支持，已跳过（支持图片、PDF 与常见文本/代码文件）`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          antdMessage.warning(`「${file.name}」超过 20MB，已跳过`);
          continue;
        }
        if (file.type.startsWith('image/')) {
          const img = await readImageFile(file);
          setPendingImages((prev) => {
            if (prev.length >= MAX_IMAGES) {
              antdMessage.warning(`最多附带 ${MAX_IMAGES} 张图片`);
              return prev;
            }
            return [...prev, img];
          });
        } else {
          const att = await readAttachmentFile(file);
          setPendingFiles((prev) => [...prev, att]);
        }
      }
    } catch (error) {
      antdMessage.error(`附件解析失败：${error.message}`);
    } finally {
      setIsReadingFiles(false);
    }
  }, []);

  const removePendingImage = useCallback(
    (index) => setPendingImages((prev) => prev.filter((_, i) => i !== index)),
    []
  );
  const removePendingFile = useCallback(
    (index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index)),
    []
  );

  const sendMessage = useCallback(
    async (text) => {
      const hasAttachments = pendingImages.length > 0 || pendingFiles.length > 0;
      if (!text.trim() && !hasAttachments) return;

      // 超长输入前置拦截：十几万字的粘贴直接发出去只会浪费请求（多半被上游拒绝），
      // 渲染超长用户气泡也可能卡住页面。提示用户改走文件上传（有截断保护）
      const MAX_INPUT_CHARS = 60000;
      if (text.length > MAX_INPUT_CHARS) {
        antdMessage.warning(
          `消息过长（${text.length.toLocaleString()} 字，上限 ${MAX_INPUT_CHARS.toLocaleString()}）。超长内容请保存为 .txt 用附件上传，或拆分后分次发送。`
        );
        return;
      }

      // 如果是新对话，先在 DB 创建 session 再跳转
      let activeSessionId = sessionId;
      let isNewSession = false;
      if (!activeSessionId) {
        const session = await createSession('新对话', currentModel);
        activeSessionId = session.id;
        isNewSession = true;
        // 跳转到持久化 URL（路由变化会触发 useEffect 更新 sessionId state）
        navigate(`/c/${activeSessionId}`, { replace: true });
        setSidebarRefreshKey((k) => k + 1);
      }

      const conversation = [
        ...toConversation(messages),
        { role: 'user', content: buildUserContent(text, pendingImages, pendingFiles) },
      ];

      // 发送新消息时无条件恢复滚动跟随
      autoFollowRef.current = true;
      // 新建会话时直接传入 activeSessionId，绕过 state 异步更新避免竞态
      handleChatCompletion(text, conversation, isNewSession ? activeSessionId : undefined, {
        images: pendingImages,
        attachments: pendingFiles,
      });
      setPendingImages([]);
      setPendingFiles([]);
    },
    [
      messages,
      sessionId,
      currentModel,
      handleChatCompletion,
      navigate,
      setSidebarRefreshKey,
      pendingImages,
      pendingFiles,
      autoFollowRef,
    ]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (isStreaming) {
        cancelChatCompletion();
        return;
      }
      sendMessage(input);
    },
    [input, isStreaming, sendMessage, cancelChatCompletion]
  );

  // 点击默认提示词卡片：直接发送对应内容
  const handlePromptClick = useCallback(
    (prompt) => {
      if (isStreaming) return;
      sendMessage(prompt);
    },
    [isStreaming, sendMessage]
  );

  // 首屏加载完成（initialLoaded）之前不当作"空对话"处理，
  // 避免刷新会话页时欢迎页和居中输入框闪现后又跳回消息布局
  const showEmptyState =
    initialLoaded && !isLoadingMore && messages.length === 0 && !isStreaming;

  const [isSidebarOpen, setIsSidebarOpen] = useState(null);

  // 屏幕阅读器播报：不给流式区域挂 aria-live（每个字符都会触发一次播报，
  // 体验灾难），改为生成结束时在隐藏的 live region 播报一次完成事件
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setSrAnnouncement('AI 回复已生成完毕');
    } else if (!prevStreamingRef.current && isStreaming) {
      setSrAnnouncement('AI 正在生成回复');
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // 桌面端的收起/展开是用户的持久偏好，存 localStorage；
  // 移动端始终是临时抽屉（关闭态默认），不与桌面偏好混用
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (window.innerWidth >= 1024) {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!next));
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    // 按当前宽度决定初始/resize 后的展开态：桌面端读取用户上次的收起偏好，
    // 移动端一律收起为抽屉。之前这里无条件按宽度回填 true，导致用户在桌面端
    // 手动收起侧边栏后，只要触发一次 resize（比如拖动窗口边缘）就会被强制重新展开
    const applyForWidth = (width) => {
      if (width >= 1024) {
        const collapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
        setIsSidebarOpen(!collapsed);
      } else {
        setIsSidebarOpen(false);
      }
    };
    applyForWidth(window.innerWidth);
    const handleResize = () => applyForWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const shouldAdjustScrollRef = useRef(false);

  // 当加载更多历史消息时，记录当前滚动位置和容器高度
  const handleLoadMore = useCallback(async () => {
    const container = scrollContainerRef.current;
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
    }
    shouldAdjustScrollRef.current = true;
    const loadedCount = await loadMoreMessages();
    if (!loadedCount) {
      // 没有加载到新内容（已经是最后一页/请求失败），不需要做滚动校正
      shouldAdjustScrollRef.current = false;
    }
  }, [loadMoreMessages]);

  // 监听 sentinel 元素，实现向上滚动触底/触顶时加载更多
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, isLoadingMore, handleLoadMore]);

  // 在 DOM 重新渲染后执行，校正滚动高度，防跳动（滚动锚定）
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (container && shouldAdjustScrollRef.current) {
      shouldAdjustScrollRef.current = false;
      const newScrollHeight = container.scrollHeight;
      const heightDifference = newScrollHeight - prevScrollHeightRef.current;
      container.scrollTop = prevScrollTopRef.current + heightDifference;
    }
  }, [messages]);

  // 流式生成期间，跟随外层聊天窗口滚动到底部（窗口滚动效果）；
  // 用户向上滚动阅读时暂停跟随，回到底部附近后恢复
  useEffect(() => {
    if (!isStreaming || isLoadingMore || shouldAdjustScrollRef.current) return;
    if (!autoFollowRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isStreaming, isLoadingMore, autoFollowRef]);

  // 滚动跟随开关：
  // - 用户滚轮向上 / 触摸拖动 → 视为主动离开底部，停止跟随；
  // - 滚回底部附近（<48px）→ 恢复跟随。
  // 用 wheel/touchmove 区分"用户操作"与"程序化平滑滚动"，避免自动滚动自己把跟随关掉
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceToBottom = () =>
      container.scrollHeight - container.scrollTop - container.clientHeight;

    const onWheel = (e) => {
      if (e.deltaY < 0) autoFollowRef.current = false;
    };
    const onTouchMove = () => {
      if (distanceToBottom() > 120) autoFollowRef.current = false;
    };
    const onScroll = () => {
      if (distanceToBottom() < 48) autoFollowRef.current = true;
    };

    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('scroll', onScroll);
    };
  }, [autoFollowRef]);

  if (isSidebarOpen === null) return null;

  return (
    <div className={`flex app-full-height ${classes.bg} ${classes.text} ${classes.themeTransition}`}>
      {/* 移动端侧边栏遮罩：突出侧边栏本身，点击空白处收起（桌面端侧边栏为常驻布局，不需要） */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} refreshKey={sidebarRefreshKey} />
      <div aria-live="polite" role="status" className="sr-only">
        {srAnnouncement}
      </div>
      <div className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        <ChatHeader toggleSidebar={toggleSidebar} />
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_28%)] pointer-events-none" />
          <div ref={scrollContainerRef} className="h-full overflow-y-auto px-4 md:px-8">
            <div className="max-w-3xl mx-auto min-h-full pt-10 pb-44">
            {/* 加载更多的哨兵元素：只在首屏加载完成后渲染。
                首屏加载期间它会在消息上方占位，加载完成后消失导致内容上移（抖动） */}
            {initialLoaded && hasMore && <div ref={sentinelRef} className="h-px" />}
            {showEmptyState && (
              <div className="flex min-h-[50vh] items-center justify-center px-4">
                <div className="text-center select-none">
                  <div className={`text-lg md:text-4xl leading-relaxed ${classes.mutedText}`}>
                    今天想聊些什么呢？
                  </div>
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                messageId={message.id}
                message={message.text}
                reasoning={message.reasoning}
                isUser={message.isUser}
                isError={message.isError}
                isStreaming={isStreaming}
                isTyping={!message.isUser && index === messages.length - 1 && isStreaming}
                isLast={index === messages.length - 1}
                canContinue={canContinue}
                images={message.images}
                attachments={message.attachments}
                onRegenerate={regenerate}
                onContinue={continueGeneration}
                onEdit={editAndResend}
                onDelete={deleteMessage}
              />
            ))}
            <div ref={messagesEndRef} />
            </div>
          </div>
          <ChatInput
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isStreaming={isStreaming}
            isEmpty={showEmptyState}
            suggestions={resolveProviderName() === 'demo' ? DEMO_PROMPTS : []}
            onSuggestionClick={handlePromptClick}
            pendingImages={pendingImages}
            pendingFiles={pendingFiles}
            onAddFiles={addFiles}
            onRemoveImage={removePendingImage}
            onRemoveFile={removePendingFile}
            isReadingFiles={isReadingFiles}
            visionWarning={pendingImages.length > 0 && !isLikelyVisionModel(currentModel)}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
