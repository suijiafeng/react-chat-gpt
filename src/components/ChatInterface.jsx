import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Menu } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import Sidebar from '../components/Sidebar';
import ModelSelector from '../components/ModelSelector';
import ChatMessage from '../components/ChatMessage';
import NavHeader from "./NavHeader";
import { useTheme } from '../contexts/ThemeContext';
import { useModel } from '../contexts/ModelContext';
import { useLanguage } from '../hooks';
import { generateChatCompletion } from '../apis/chat';

const ChatHeader = React.memo(({ toggleSidebar }) => {
  const {classes} = useTheme();
  return (
    <div className={`px-4 flex items-center justify-between h-16 ${classes.headerBg}`}>
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className={`${classes.buttonText} ${classes.buttonHover} mr-4`}
        >
          <Menu size={24} />
        </button>
        <ModelSelector />
      </div>
      <NavHeader />
    </div>
  );
});

const ChatInput = React.memo(({ input, setInput, handleSubmit }) => {
  const {classes} = useTheme();
  const { t } = useLanguage();
  return (
    <div className="py-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={`flex-1 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500  border ${classes.border} ${classes.input}`}
            placeholder={t("enterMessage")}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white rounded-r-lg px-4 py-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
});

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const {classes} = useTheme();
  const { currentModel } = useModel();
  const { t } = useLanguage();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!input.trim()) return;

      const userMessageId = uuidv4();
      const aiMessageId = uuidv4();

      setMessages((prevMessages) => [
        ...prevMessages,
        { id: userMessageId, text: input, isUser: true },
        { id: aiMessageId, text: '', isUser: false },
      ]);

      setInput("");
      setIsStreaming(true);

      const conversation = [
        ...messages.map((msg) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: input },
      ];

      try {
        await generateChatCompletion(
          {
            stream: true,
            model: currentModel,
            messages: conversation,
            options: {},
            session_id: uuidv4(),
            chat_id: uuidv4(),
            id: uuidv4(),
          },
          (chunk) => {
            if (chunk === '[DONE]') {
              setIsStreaming(false);
              return;
            }

            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === aiMessageId
                  ? { ...msg, text: msg.text + chunk }
                  : msg
              )
            );
          }
        );
      } catch (error) {
        console.error('Error generating chat completion:', error);
        setIsStreaming(false);
        // Add error handling UI here
      }
    },
    [input, messages, currentModel]
  );

  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

  return (
    <div className={`flex h-screen ${classes.bg} ${classes.text} transition-colors duration-300`}>
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader toggleSidebar={toggleSidebar} />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 pb-24">
            {messages.map((message, index) => (
             <ChatMessage
             key={message.id}
             message={message.text}
             isUser={message.isUser}
             isTyping={!message.isUser && index === messages.length - 1 && isStreaming}
             avatar={message.avatar} // 如果有自定义头像，可以传入
             username={message.username} // 如果有自定义用户名，可以传入
           />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput input={input} setInput={setInput} handleSubmit={handleSubmit} isStreaming={isStreaming} />
      </div>
    </div>
  );
};

export default ChatInterface;