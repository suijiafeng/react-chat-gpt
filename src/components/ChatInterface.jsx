import React, { useCallback, useEffect, useState, useMemo, useLayoutEffect } from "react";
import { useChat } from '../hooks';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import { useTheme } from '../contexts/ThemeContext';

const ChatInterface = () => {
  const currentModel = localStorage.getItem('currentModel') || '';
  const {
    messages,
    input,
    setInput,
    isStreaming,
    handleChatCompletion,
    messagesEndRef,
    cancelChatCompletion
  } = useChat(currentModel);

  const { classes } = useTheme();
  const memoizedMessages = useMemo(() => messages, [messages]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (isStreaming) {
        cancelChatCompletion();
        return;
      }
      if (!input.trim()) return;

      const conversation = [
        ...messages.map((msg) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: input },
      ];

      handleChatCompletion(input, conversation);
    },
    [input, isStreaming, messages, handleChatCompletion]
  );

  // 初始状态设为 null，避免在界面加载时先展开再收起的问题
  const [isSidebarOpen, setIsSidebarOpen] = useState(null);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  useLayoutEffect(() => {
    // 检查当前窗口宽度并设置侧边栏状态
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);

    handleResize(); // 在初次加载时立即检测
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 如果 isSidebarOpen 仍然为 null，则不渲染 Sidebar，避免闪烁
  if (isSidebarOpen === null) {
    return null;
  }

  return (
    <div className={`flex h-screen ${classes.bg} ${classes.text} transition-colors duration-300`}>
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader toggleSidebar={toggleSidebar} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 pb-24">
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
        />
      </div>
    </div>
  );
};

export default ChatInterface;
