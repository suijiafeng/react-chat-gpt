import React, { useCallback, useState, useMemo, useLayoutEffect, useEffect } from 'react';
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

  const {
    messages,
    input,
    setInput,
    isStreaming,
    handleChatCompletion,
    messagesEndRef,
    cancelChatCompletion,
  } = useChat(currentModel, sessionId);

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
      if (conversation.length === 1) {
        setSidebarRefreshKey((k) => k + 1);
      }
    },
    [input, isStreaming, messages, sessionId, currentModel, handleChatCompletion, cancelChatCompletion, navigate, setSidebarRefreshKey]
  );

  const memoizedMessages = useMemo(() => messages, [messages]);

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

  if (isSidebarOpen === null) return null;

  return (
    <div className={`flex h-screen ${classes.bg} ${classes.text} ${classes.themeTransition}`}>
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} refreshKey={sidebarRefreshKey} />
      <div className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        <ChatHeader toggleSidebar={toggleSidebar} />
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_28%)] pointer-events-none" />
          <div className="h-full overflow-y-auto px-4 md:px-8">
            <div className="max-w-3xl mx-auto min-h-full pt-10 pb-44">
            {memoizedMessages.length === 0 && !isStreaming && (
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
            isEmpty={memoizedMessages.length === 0 && !isStreaming}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
