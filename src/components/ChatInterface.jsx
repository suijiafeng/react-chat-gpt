import React, { useCallback, useState, useMemo, useLayoutEffect, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../hooks';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import { useTheme } from '../contexts/ThemeContext';
import { createSession } from '../store/db';

const ChatInterface = () => {
  const { chatId } = useParams(); // /c/:chatId 时有值，/new 时无值
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(null);
  // 用于触发 Sidebar 重新加载会话列表
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  const currentModel = localStorage.getItem('currentModel') || '';

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
  } = useChat(currentModel, sessionId, handleSessionTouched);

  const { classes } = useTheme();

  // 路由变化时同步 sessionId
  useEffect(() => {
    if (chatId) {
      // 加载已有会话
      setSessionId(chatId);
    } else {
      // /new：清空，等待第一次发送时创建新会话
      setSessionId(null);
    }
  }, [chatId]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (isStreaming) {
        cancelChatCompletion();
        return;
      }
      if (!input.trim()) return;

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
        ...messages.map((msg) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: input },
      ];

      // 新建会话时直接传入 activeSessionId，绕过 state 异步更新避免竞态
      handleChatCompletion(input, conversation, isNewSession ? activeSessionId : undefined);
    },
    [input, isStreaming, messages, sessionId, currentModel, handleChatCompletion, cancelChatCompletion, navigate, setSidebarRefreshKey]
  );

  const memoizedMessages = useMemo(() => messages, [messages]);
  // 加载中先不当作"空对话"处理，避免欢迎页和输入框位置在消息加载完成的瞬间跳动
  const showEmptyState = !isLoadingMore && memoizedMessages.length === 0 && !isStreaming;

  const [isSidebarOpen, setIsSidebarOpen] = useState(null);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  useLayoutEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);
    handleResize();
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

  if (isSidebarOpen === null) return null;

  return (
    <div className={`flex h-screen ${classes.bg} ${classes.text} ${classes.themeTransition}`}>
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} refreshKey={sidebarRefreshKey} />
      <div className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        <ChatHeader toggleSidebar={toggleSidebar} />
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_28%)] pointer-events-none" />
          <div ref={scrollContainerRef} className="h-full overflow-y-auto px-4 md:px-8">
            <div className="max-w-3xl mx-auto min-h-full pt-10 pb-44">
            {hasMore && (
              <div ref={sentinelRef} className="py-4 flex items-center justify-center text-xs text-neutral-400">
                {isLoadingMore ? (
                  <div className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-transparent"></span>
                    <span>加载中...</span>
                  </div>
                ) : (
                  <span></span>
                )}
              </div>
            )}
            {showEmptyState && (
              <div className="h-[40vh] flex items-end justify-center">
                <div className="text-center select-none pb-10">
                  <div className={`text-lg md:text-4xl ${classes.mutedText}`}>今天想聊些什么呢？</div>
                </div>
              </div>
            )}
            {memoizedMessages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message.text}
                isUser={message.isUser}
                isStreaming={isStreaming}
                isTyping={!message.isUser && index === messages.length - 1 && isStreaming}
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
          />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
